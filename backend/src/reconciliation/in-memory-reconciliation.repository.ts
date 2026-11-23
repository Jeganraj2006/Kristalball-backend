import { AppError } from '../errors/app-error.js';
import { newId } from './reconciliation.service.js';
import type {
  Command,
  ReconciliationRepository,
  Stocktake,
  StocktakeStatus,
} from './reconciliation.types.js';

export class InMemoryReconciliationRepository implements ReconciliationRepository {
  private readonly stocktakes = new Map<string, Stocktake>();
  private readonly balances = new Map<string, number>();
  public readonly ledger: { stocktakeId: string; lineId: string; delta: number }[] = [];
  public setBalance(org: string, location: string, item: string, quantity: number): void {
    this.balances.set(`${org}:${location}:${item}`, quantity);
  }
  public balance(org: string, location: string, item: string): number {
    return this.balances.get(`${org}:${location}:${item}`) ?? 0;
  }
  public async create(
    input: Command & { organizationId: string; locationId: string; itemIds: string[] },
  ): Promise<Stocktake> {
    const stocktake: Stocktake = {
      id: newId(),
      organizationId: input.organizationId,
      locationId: input.locationId,
      counterId: input.actorId,
      status: 'DRAFT',
      lines: input.itemIds.map((catalogItemId) => ({
        id: newId(),
        catalogItemId,
        expectedQuantity: this.balance(input.organizationId, input.locationId, catalogItemId),
        actualQuantity: null,
        variance: null,
        category: null,
        notes: null,
      })),
      events: [],
    };
    this.event(stocktake, 'CREATED', null, 'DRAFT', input.actorId);
    this.stocktakes.set(stocktake.id, stocktake);
    return structuredClone(stocktake);
  }
  public async get(id: string): Promise<Stocktake | null> {
    const value = this.stocktakes.get(id);
    return value ? structuredClone(value) : null;
  }
  public async count(
    id: string,
    input: Command & {
      lines: { lineId: string; actualQuantity: number; category?: string; notes?: string }[];
    },
  ): Promise<Stocktake> {
    const stocktake = this.must(id);
    if (!['DRAFT', 'COUNTING'].includes(stocktake.status)) this.conflict();
    for (const inputLine of input.lines) {
      const line = stocktake.lines.find((candidate) => candidate.id === inputLine.lineId);
      if (!line) this.invalid();
      line.actualQuantity = inputLine.actualQuantity;
      line.variance = inputLine.actualQuantity - line.expectedQuantity;
      line.category =
        line.variance === 0
          ? 'MATCHED'
          : (inputLine.category ?? (line.variance < 0 ? 'SHORTAGE' : 'SURPLUS'));
      line.notes = inputLine.notes ?? null;
    }
    if (stocktake.status === 'DRAFT')
      this.move(stocktake, 'COUNTING', 'COUNT_STARTED', input.actorId);
    return structuredClone(stocktake);
  }
  public async transition(
    id: string,
    input: Command & { action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'POST' | 'CANCEL' },
  ): Promise<Stocktake> {
    const stocktake = this.must(id);
    const target: Record<typeof input.action, [StocktakeStatus[], StocktakeStatus, string]> = {
      SUBMIT: [['DRAFT', 'COUNTING'], 'SUBMITTED', 'SUBMITTED'],
      APPROVE: [['SUBMITTED'], 'APPROVED', 'APPROVED'],
      REJECT: [['SUBMITTED'], 'REJECTED', 'REJECTED'],
      POST: [['APPROVED'], 'POSTED', 'POSTED'],
      CANCEL: [['DRAFT', 'COUNTING'], 'CANCELLED', 'CANCELLED'],
    };
    const [allowed, status, type] = target[input.action];
    if (!allowed.includes(stocktake.status)) this.conflict();
    if (input.action === 'POST')
      for (const line of stocktake.lines) {
        if (line.actualQuantity === null || line.variance === null || line.variance === 0) continue;
        this.balances.set(
          `${stocktake.organizationId}:${stocktake.locationId}:${line.catalogItemId}`,
          line.actualQuantity,
        );
        this.ledger.push({ stocktakeId: id, lineId: line.id, delta: line.variance });
      }
    this.move(stocktake, status, type, input.actorId, input.reason);
    return structuredClone(stocktake);
  }
  private move(
    stocktake: Stocktake,
    status: StocktakeStatus,
    type: string,
    actorId: string,
    reason?: string,
  ): void {
    const from = stocktake.status;
    stocktake.status = status;
    this.event(stocktake, type, from, status, actorId, reason);
  }
  private event(
    stocktake: Stocktake,
    type: string,
    fromStatus: StocktakeStatus | null,
    toStatus: StocktakeStatus,
    actorId: string,
    reason?: string,
  ): void {
    stocktake.events.push({
      id: newId(),
      type,
      fromStatus,
      toStatus,
      actorId,
      occurredAt: new Date(),
      reason: reason ?? null,
    });
  }
  private must(id: string): Stocktake {
    const value = this.stocktakes.get(id);
    if (!value)
      throw new AppError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource is unavailable.',
      });
    return value;
  }
  private conflict(): never {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_STOCKTAKE_STATE',
      message: 'The reconciliation command conflicts with the current state.',
    });
  }
  private invalid(): never {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_STOCKTAKE',
      message: 'The reconciliation line is invalid.',
    });
  }
}
