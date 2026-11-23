import type {
  Prisma,
  TransferEventType as PrismaEventType,
  TransferStatus as PrismaStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import type {
  CreateTransferInput,
  ReceiptLine,
  Transfer,
  TransferCommand,
  TransferEventType,
  TransferRepository,
  TransferStatus,
} from './transfer.types.js';

const includeTransfer = {
  lines: true,
  events: { orderBy: { occurredAt: 'asc' } },
} satisfies Prisma.TransferRequestInclude;

export class PrismaTransferRepository implements TransferRepository {
  public async createDraft(input: CreateTransferInput): Promise<Transfer> {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.transferRequest.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: includeTransfer,
        });
        if (existing) {
          if (existing.requestHash !== input.requestHash) this.conflict('IDEMPOTENCY_KEY_REUSED');
          return this.map(existing);
        }
        await this.assertTransferReferences(
          tx,
          input.organizationId,
          input.sourceLocationId,
          input.destinationLocationId,
          input.lines.map((line) => line.catalogItemId),
        );
        const created = await tx.transferRequest.create({
          data: {
            organizationId: input.organizationId,
            sourceLocationId: input.sourceLocationId,
            destinationLocationId: input.destinationLocationId,
            requesterId: input.requesterId,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            lines: {
              create: input.lines.map((line) => ({
                catalogItemId: line.catalogItemId,
                requestedQuantity: line.quantity,
              })),
            },
            events: {
              create: {
                type: 'CREATED',
                toStatus: 'DRAFT',
                actorId: input.actorId,
                requestHash: input.requestHash,
              },
            },
          },
          include: includeTransfer,
        });
        return this.map(created);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public async getTransfer(transferId: string): Promise<Transfer | null> {
    const transfer = await prisma.transferRequest.findUnique({
      where: { id: transferId },
      include: includeTransfer,
    });
    return transfer ? this.map(transfer) : null;
  }

  public async transition(
    input: TransferCommand & {
      transferId: string;
      action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'DISPATCH' | 'RECEIVE' | 'CANCEL';
      receiptLines?: ReceiptLine[];
    },
  ): Promise<Transfer> {
    return prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.transferEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (duplicate) {
          if (
            duplicate.requestHash !== input.requestHash ||
            duplicate.transferId !== input.transferId
          )
            this.conflict('IDEMPOTENCY_KEY_REUSED');
          const prior = await tx.transferRequest.findUnique({
            where: { id: input.transferId },
            include: includeTransfer,
          });
          if (!prior) this.notFound();
          return this.map(prior);
        }
        await tx.$queryRaw`SELECT id FROM transfer_requests WHERE id = ${input.transferId}::uuid FOR UPDATE`;
        const transfer = await tx.transferRequest.findUnique({
          where: { id: input.transferId },
          include: includeTransfer,
        });
        if (!transfer) this.notFound();
        const current = this.map(transfer);
        if (input.action === 'SUBMIT')
          return this.changeStatus(tx, current, ['DRAFT'], 'SUBMITTED', 'SUBMITTED', input);
        if (input.action === 'APPROVE')
          return this.changeStatus(tx, current, ['SUBMITTED'], 'APPROVED', 'APPROVED', input);
        if (input.action === 'REJECT')
          return this.changeStatus(tx, current, ['SUBMITTED'], 'REJECTED', 'REJECTED', input);
        if (input.action === 'CANCEL')
          return this.changeStatus(
            tx,
            current,
            ['DRAFT', 'SUBMITTED'],
            'CANCELLED',
            'CANCELLED',
            input,
          );
        if (input.action === 'DISPATCH') return this.dispatch(tx, current, input);
        return this.receive(tx, current, input, input.receiptLines ?? []);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async dispatch(
    tx: Prisma.TransactionClient,
    transfer: Transfer,
    input: TransferCommand,
  ): Promise<Transfer> {
    this.requireStatus(transfer, ['APPROVED']);
    for (const line of transfer.lines) {
      await tx.$queryRaw`SELECT id FROM inventory_balances WHERE organization_id = ${transfer.organizationId}::uuid AND location_id = ${transfer.sourceLocationId}::uuid AND catalog_item_id = ${line.catalogItemId}::uuid FOR UPDATE`;
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          organizationId_locationId_catalogItemId: {
            organizationId: transfer.organizationId,
            locationId: transfer.sourceLocationId,
            catalogItemId: line.catalogItemId,
          },
        },
      });
      if (!balance || balance.onHand - balance.allocated < line.requestedQuantity)
        this.conflict('INSUFFICIENT_INVENTORY');
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { onHand: { decrement: line.requestedQuantity }, version: { increment: 1 } },
      });
      await tx.transferLine.update({
        where: { id: line.id },
        data: { dispatchedQuantity: line.requestedQuantity },
      });
      await tx.inventoryLedgerEntry.create({
        data: {
          organizationId: transfer.organizationId,
          transferId: transfer.id,
          transferLineId: line.id,
          catalogItemId: line.catalogItemId,
          locationId: transfer.sourceLocationId,
          movementType: 'TRANSFER_OUT',
          onHandDelta: -line.requestedQuantity,
          actorId: input.actorId,
        },
      });
    }
    return this.changeStatus(tx, transfer, ['APPROVED'], 'DISPATCHED', 'DISPATCHED', input);
  }

  private async receive(
    tx: Prisma.TransactionClient,
    transfer: Transfer,
    input: TransferCommand,
    receiptLines: ReceiptLine[],
  ): Promise<Transfer> {
    this.requireStatus(transfer, ['DISPATCHED']);
    const quantities = new Map(
      receiptLines.map((line) => [line.transferLineId, line.receivedQuantity]),
    );
    let discrepancy = false;
    for (const line of transfer.lines) {
      const quantity = quantities.get(line.id);
      if (quantity === undefined || quantity < 0 || quantity > line.dispatchedQuantity)
        this.invalidReceipt();
      discrepancy ||= quantity !== line.dispatchedQuantity;
      await tx.transferLine.update({
        where: { id: line.id },
        data: { receivedQuantity: quantity },
      });
      if (quantity > 0) {
        await tx.inventoryBalance.upsert({
          where: {
            organizationId_locationId_catalogItemId: {
              organizationId: transfer.organizationId,
              locationId: transfer.destinationLocationId,
              catalogItemId: line.catalogItemId,
            },
          },
          create: {
            organizationId: transfer.organizationId,
            locationId: transfer.destinationLocationId,
            catalogItemId: line.catalogItemId,
            onHand: quantity,
          },
          update: { onHand: { increment: quantity }, version: { increment: 1 } },
        });
        await tx.inventoryLedgerEntry.create({
          data: {
            organizationId: transfer.organizationId,
            transferId: transfer.id,
            transferLineId: line.id,
            catalogItemId: line.catalogItemId,
            locationId: transfer.destinationLocationId,
            movementType: 'TRANSFER_IN',
            onHandDelta: quantity,
            actorId: input.actorId,
          },
        });
      }
    }
    const target = discrepancy ? 'DISCREPANCY' : 'RECEIVED';
    const eventType: TransferEventType = 'RECEIVED';
    await this.changeStatus(tx, transfer, ['DISPATCHED'], target, eventType, input);
    await tx.transferEvent.create({
      data: {
        transferId: transfer.id,
        type: discrepancy ? 'DISCREPANCY_RECORDED' : 'COMPLETED',
        fromStatus: target,
        toStatus: target,
        actorId: input.actorId,
      },
    });
    const completed = await tx.transferRequest.findUnique({
      where: { id: transfer.id },
      include: includeTransfer,
    });
    if (!completed) this.notFound();
    return this.map(completed);
  }

  private async changeStatus(
    tx: Prisma.TransactionClient,
    transfer: Transfer,
    allowed: TransferStatus[],
    next: TransferStatus,
    eventType: TransferEventType,
    input: TransferCommand,
  ): Promise<Transfer> {
    this.requireStatus(transfer, allowed);
    const saved = await tx.transferRequest.update({
      where: { id: transfer.id },
      data: {
        status: next as PrismaStatus,
        version: { increment: 1 },
        events: {
          create: {
            type: eventType as PrismaEventType,
            fromStatus: transfer.status as PrismaStatus,
            toStatus: next as PrismaStatus,
            actorId: input.actorId,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        },
      },
      include: includeTransfer,
    });
    return this.map(saved);
  }
  private async assertTransferReferences(
    tx: Prisma.TransactionClient,
    organizationId: string,
    source: string,
    destination: string,
    itemIds: string[],
  ): Promise<void> {
    if (source === destination)
      throw new AppError({
        statusCode: 422,
        code: 'INVALID_TRANSFER',
        message: 'Source and destination locations must differ.',
      });
    const [locations, items] = await Promise.all([
      tx.location.findMany({ where: { organizationId, id: { in: [source, destination] } } }),
      tx.catalogItem.findMany({
        where: { organizationId, id: { in: itemIds }, trackingType: 'BULK', active: true },
      }),
    ]);
    if (locations.length !== 2 || items.length !== itemIds.length)
      throw new AppError({
        statusCode: 422,
        code: 'INVALID_TRANSFER',
        message: 'Transfer references invalid locations or inventory items.',
      });
  }
  private requireStatus(transfer: Transfer, allowed: TransferStatus[]): void {
    if (!allowed.includes(transfer.status)) this.conflict('INVALID_TRANSFER_STATE');
  }
  private invalidReceipt(): never {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_RECEIPT',
      message: 'Receipt quantities must be from zero to the dispatched quantity.',
    });
  }
  private conflict(code: string): never {
    throw new AppError({
      statusCode: 409,
      code,
      message: 'The transfer command conflicts with the current workflow state.',
    });
  }
  private notFound(): never {
    throw new AppError({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource is unavailable.',
    });
  }
  private map(
    record: Prisma.TransferRequestGetPayload<{ include: typeof includeTransfer }>,
  ): Transfer {
    return {
      id: record.id,
      organizationId: record.organizationId,
      sourceLocationId: record.sourceLocationId,
      destinationLocationId: record.destinationLocationId,
      requesterId: record.requesterId,
      status: record.status as TransferStatus,
      version: record.version,
      lines: record.lines.map((line) => ({
        id: line.id,
        catalogItemId: line.catalogItemId,
        requestedQuantity: line.requestedQuantity,
        dispatchedQuantity: line.dispatchedQuantity,
        receivedQuantity: line.receivedQuantity,
      })),
      events: record.events.map((event) => ({
        id: event.id,
        type: event.type as TransferEventType,
        fromStatus: event.fromStatus as TransferStatus | null,
        toStatus: event.toStatus as TransferStatus,
        actorId: event.actorId,
        idempotencyKey: event.idempotencyKey,
        requestHash: event.requestHash,
        reason: event.reason,
        occurredAt: event.occurredAt,
        ...(event.payload ? { payload: event.payload as Record<string, unknown> } : {}),
      })),
    };
  }
}
