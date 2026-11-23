import { createHash, randomUUID } from 'node:crypto';
import {
  requireIndependentApproval,
  requireLocationScope,
  requirePermission,
  type AuthenticatedPrincipal,
} from '../auth/authorization.js';
import { AppError } from '../errors/app-error.js';
import type { Command, ReconciliationRepository, Stocktake } from './reconciliation.types.js';

export class ReconciliationService {
  public constructor(private readonly repository: ReconciliationRepository) {}
  public async create(
    principal: AuthenticatedPrincipal,
    locationId: string,
    itemIds: string[],
    command: Command,
  ): Promise<Stocktake> {
    requirePermission(principal, 'stocktake.count');
    requireLocationScope(principal, principal.scope.organizationId, locationId);
    if (!itemIds.length || new Set(itemIds).size !== itemIds.length) this.invalid();
    return this.repository.create({
      ...command,
      actorId: principal.userId,
      organizationId: principal.scope.organizationId,
      locationId,
      itemIds,
    });
  }
  public async count(
    principal: AuthenticatedPrincipal,
    id: string,
    command: Command & {
      lines: { lineId: string; actualQuantity: number; category?: string; notes?: string }[];
    },
  ): Promise<Stocktake> {
    const stocktake = await this.scoped(principal, id, 'stocktake.count');
    if (stocktake.counterId !== principal.userId) this.forbid();
    if (
      !command.lines.length ||
      command.lines.some(
        (line) => !Number.isInteger(line.actualQuantity) || line.actualQuantity < 0,
      )
    )
      this.invalid();
    return this.repository.count(id, { ...command, actorId: principal.userId });
  }
  public async submit(
    principal: AuthenticatedPrincipal,
    id: string,
    command: Command,
  ): Promise<Stocktake> {
    const stocktake = await this.scoped(principal, id, 'stocktake.count');
    if (stocktake.counterId !== principal.userId) this.forbid();
    if (!stocktake.lines.some((line) => line.actualQuantity !== null))
      this.invalid('At least one item must be counted before submission.');
    return this.repository.transition(id, {
      ...command,
      actorId: principal.userId,
      action: 'SUBMIT',
    });
  }
  public async approve(
    principal: AuthenticatedPrincipal,
    id: string,
    command: Command,
  ): Promise<Stocktake> {
    const stocktake = await this.scoped(principal, id);
    requireIndependentApproval(
      principal,
      stocktake.counterId,
      stocktake.organizationId,
      stocktake.locationId,
    );
    return this.repository.transition(id, {
      ...command,
      actorId: principal.userId,
      action: 'APPROVE',
    });
  }
  public async reject(
    principal: AuthenticatedPrincipal,
    id: string,
    command: Command,
  ): Promise<Stocktake> {
    const stocktake = await this.scoped(principal, id);
    requireIndependentApproval(
      principal,
      stocktake.counterId,
      stocktake.organizationId,
      stocktake.locationId,
    );
    return this.repository.transition(id, {
      ...command,
      actorId: principal.userId,
      action: 'REJECT',
    });
  }
  public async post(
    principal: AuthenticatedPrincipal,
    id: string,
    command: Command,
  ): Promise<Stocktake> {
    const stocktake = await this.scoped(principal, id);
    requireIndependentApproval(
      principal,
      stocktake.counterId,
      stocktake.organizationId,
      stocktake.locationId,
    );
    return this.repository.transition(id, {
      ...command,
      actorId: principal.userId,
      action: 'POST',
    });
  }
  public async get(principal: AuthenticatedPrincipal, id: string): Promise<Stocktake> {
    return this.scoped(principal, id, 'inventory.balance.read');
  }
  public async report(
    principal: AuthenticatedPrincipal,
    id: string,
  ): Promise<{
    stocktake: Stocktake;
    countedRecords: number;
    matchingRecords: number;
    reconciliationRate: number;
  }> {
    const stocktake = await this.get(principal, id);
    const counted = stocktake.lines.filter((line) => line.actualQuantity !== null);
    const matching = counted.filter((line) => line.variance === 0).length;
    return {
      stocktake,
      countedRecords: counted.length,
      matchingRecords: matching,
      reconciliationRate: counted.length ? (matching / counted.length) * 100 : 0,
    };
  }
  private async scoped(
    principal: AuthenticatedPrincipal,
    id: string,
    permission?: 'stocktake.count' | 'inventory.balance.read',
  ): Promise<Stocktake> {
    if (permission) requirePermission(principal, permission);
    const stocktake = await this.repository.get(id);
    if (!stocktake)
      throw new AppError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource is unavailable.',
      });
    requireLocationScope(principal, stocktake.organizationId, stocktake.locationId);
    return stocktake;
  }
  private invalid(message = 'The supplied reconciliation data is invalid.'): never {
    throw new AppError({ statusCode: 422, code: 'INVALID_STOCKTAKE', message });
  }
  private forbid(): never {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'You are not authorized to perform this action.',
    });
  }
}
export function reconciliationHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export const newId = (): string => randomUUID();
