import type { Prisma, StocktakeStatus as PrismaStatus } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import type {
  Command,
  ReconciliationRepository,
  Stocktake,
  StocktakeStatus,
} from './reconciliation.types.js';
const includeStocktake = {
  lines: true,
  events: { orderBy: { occurredAt: 'asc' } },
} satisfies Prisma.StocktakeInclude;

export class PrismaReconciliationRepository implements ReconciliationRepository {
  public async create(
    input: Command & { organizationId: string; locationId: string; itemIds: string[] },
  ): Promise<Stocktake> {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.stocktake.findUnique({
          where: { idempotencyKey: input.key },
          include: includeStocktake,
        });
        if (existing) {
          if (existing.requestHash !== input.hash) this.idempotencyConflict();
          return this.map(existing);
        }
        const items = await tx.catalogItem.findMany({
          where: {
            organizationId: input.organizationId,
            id: { in: input.itemIds },
            trackingType: 'BULK',
            active: true,
          },
        });
        if (items.length !== input.itemIds.length) this.invalid();
        const balances = await tx.inventoryBalance.findMany({
          where: {
            organizationId: input.organizationId,
            locationId: input.locationId,
            catalogItemId: { in: input.itemIds },
          },
        });
        const expected = new Map(
          balances.map((balance) => [balance.catalogItemId, balance.onHand]),
        );
        const created = await tx.stocktake.create({
          data: {
            organizationId: input.organizationId,
            locationId: input.locationId,
            counterId: input.actorId,
            idempotencyKey: input.key,
            requestHash: input.hash,
            lines: {
              create: input.itemIds.map((catalogItemId) => ({
                catalogItemId,
                expectedQuantity: expected.get(catalogItemId) ?? 0,
              })),
            },
            events: { create: { type: 'CREATED', toStatus: 'DRAFT', actorId: input.actorId } },
          },
          include: includeStocktake,
        });
        return this.map(created);
      },
      { isolationLevel: 'Serializable' },
    );
  }
  public async get(id: string): Promise<Stocktake | null> {
    const result = await prisma.stocktake.findUnique({ where: { id }, include: includeStocktake });
    return result ? this.map(result) : null;
  }
  public async count(
    id: string,
    input: Command & {
      lines: { lineId: string; actualQuantity: number; category?: string; notes?: string }[];
    },
  ): Promise<Stocktake> {
    return prisma.$transaction(
      async (tx) => {
        const stocktake = await tx.stocktake.findUnique({
          where: { id },
          include: includeStocktake,
        });
        if (!stocktake) this.notFound();
        if (!['DRAFT', 'COUNTING'].includes(stocktake.status)) this.conflict();
        for (const count of input.lines) {
          const line = stocktake.lines.find((value) => value.id === count.lineId);
          if (!line) this.invalid();
          const variance = count.actualQuantity - line.expectedQuantity;
          await tx.stocktakeLine.update({
            where: { id: count.lineId },
            data: {
              actualQuantity: count.actualQuantity,
              variance,
              category:
                variance === 0
                  ? 'MATCHED'
                  : (count.category ?? (variance < 0 ? 'SHORTAGE' : 'SURPLUS')),
              notes: count.notes ?? null,
            },
          });
        }
        if (stocktake.status === 'DRAFT')
          await this.change(tx, stocktake.id, stocktake.status, 'COUNTING', 'COUNT_STARTED', input);
        const updated = await tx.stocktake.findUnique({ where: { id }, include: includeStocktake });
        if (!updated) this.notFound();
        return this.map(updated);
      },
      { isolationLevel: 'Serializable' },
    );
  }
  public async transition(
    id: string,
    input: Command & { action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'POST' | 'CANCEL' },
  ): Promise<Stocktake> {
    return prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.stocktakeEvent.findUnique({
          where: { idempotencyKey: input.key },
        });
        if (duplicate) {
          if (duplicate.requestHash !== input.hash || duplicate.stocktakeId !== id)
            this.idempotencyConflict();
          const prior = await tx.stocktake.findUnique({ where: { id }, include: includeStocktake });
          if (!prior) this.notFound();
          return this.map(prior);
        }
        await tx.$queryRaw`SELECT id FROM stocktakes WHERE id = ${id}::uuid FOR UPDATE`;
        const stocktake = await tx.stocktake.findUnique({
          where: { id },
          include: includeStocktake,
        });
        if (!stocktake) this.notFound();
        const mapping = {
          SUBMIT: [['DRAFT', 'COUNTING'], 'SUBMITTED', 'SUBMITTED'],
          APPROVE: [['SUBMITTED'], 'APPROVED', 'APPROVED'],
          REJECT: [['SUBMITTED'], 'REJECTED', 'REJECTED'],
          POST: [['APPROVED'], 'POSTED', 'POSTED'],
          CANCEL: [['DRAFT', 'COUNTING'], 'CANCELLED', 'CANCELLED'],
        } as const;
        const [allowed, next, type] = mapping[input.action];
        if (!allowed.includes(stocktake.status as never)) this.conflict();
        if (input.action === 'POST')
          for (const line of stocktake.lines) {
            if (line.actualQuantity === null || line.variance === null || line.variance === 0)
              continue;
            const balance = await tx.inventoryBalance.upsert({
              where: {
                organizationId_locationId_catalogItemId: {
                  organizationId: stocktake.organizationId,
                  locationId: stocktake.locationId,
                  catalogItemId: line.catalogItemId,
                },
              },
              create: {
                organizationId: stocktake.organizationId,
                locationId: stocktake.locationId,
                catalogItemId: line.catalogItemId,
                onHand: line.actualQuantity,
              },
              update: { onHand: { increment: line.variance }, version: { increment: 1 } },
            });
            if (balance.onHand < 0) this.invalid();
            await tx.inventoryLedgerEntry.create({
              data: {
                organizationId: stocktake.organizationId,
                stocktakeLineId: line.id,
                catalogItemId: line.catalogItemId,
                locationId: stocktake.locationId,
                movementType: 'RECONCILIATION_ADJUSTMENT',
                onHandDelta: line.variance,
                actorId: input.actorId,
              },
            });
          }
        await this.change(tx, id, stocktake.status, next, type, input);
        const result = await tx.stocktake.findUnique({ where: { id }, include: includeStocktake });
        if (!result) this.notFound();
        return this.map(result);
      },
      { isolationLevel: 'Serializable' },
    );
  }
  private async change(
    tx: Prisma.TransactionClient,
    id: string,
    from: string,
    to: StocktakeStatus,
    type: string,
    input: Command,
  ): Promise<void> {
    await tx.stocktake.update({
      where: { id },
      data: {
        status: to as PrismaStatus,
        version: { increment: 1 },
        ...(to === 'SUBMITTED' ? { submittedAt: new Date() } : {}),
        events: {
          create: {
            type,
            fromStatus: from as PrismaStatus,
            toStatus: to as PrismaStatus,
            actorId: input.actorId,
            idempotencyKey: input.key,
            requestHash: input.hash,
            reason: input.reason ?? null,
          },
        },
      },
    });
  }
  private map(record: Prisma.StocktakeGetPayload<{ include: typeof includeStocktake }>): Stocktake {
    return {
      id: record.id,
      organizationId: record.organizationId,
      locationId: record.locationId,
      counterId: record.counterId,
      status: record.status as StocktakeStatus,
      lines: record.lines.map((line) => ({
        id: line.id,
        catalogItemId: line.catalogItemId,
        expectedQuantity: line.expectedQuantity,
        actualQuantity: line.actualQuantity,
        variance: line.variance,
        category: line.category,
        notes: line.notes,
      })),
      events: record.events.map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus as StocktakeStatus | null,
        toStatus: event.toStatus as StocktakeStatus,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        reason: event.reason,
      })),
    };
  }
  private invalid(): never {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_STOCKTAKE',
      message: 'The reconciliation data is invalid.',
    });
  }
  private conflict(): never {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_STOCKTAKE_STATE',
      message: 'The reconciliation command conflicts with the current state.',
    });
  }
  private idempotencyConflict(): never {
    throw new AppError({
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The idempotency key was already used for a different request.',
    });
  }
  private notFound(): never {
    throw new AppError({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource is unavailable.',
    });
  }
}
