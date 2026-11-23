import { createHash } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import {
  requireIndependentApproval,
  requireLocationScope,
  requirePermission,
  type AuthenticatedPrincipal,
  type Permission,
} from '../auth/authorization.js';
import type {
  CreateTransferInput,
  ReceiptLine,
  Transfer,
  TransferCommand,
  TransferRepository,
} from './transfer.types.js';

export class TransferService {
  public constructor(private readonly repository: TransferRepository) {}

  public async create(
    principal: AuthenticatedPrincipal,
    input: Omit<
      CreateTransferInput,
      'actorId' | 'requesterId' | 'organizationId' | 'requestHash'
    > & { requestHash: string },
  ): Promise<Transfer> {
    this.assertDifferentLocations(input.sourceLocationId, input.destinationLocationId);
    this.assertLines(input.lines);
    requirePermission(principal, 'inventory.transaction.create');
    requireLocationScope(principal, principal.scope.organizationId, input.sourceLocationId);
    requireLocationScope(principal, principal.scope.organizationId, input.destinationLocationId);
    return this.repository.createDraft({
      ...input,
      organizationId: principal.scope.organizationId,
      requesterId: principal.userId,
      actorId: principal.userId,
    });
  }

  public async submit(
    principal: AuthenticatedPrincipal,
    transferId: string,
    command: TransferCommand,
  ): Promise<Transfer> {
    const transfer = await this.requireTransferInScope(
      principal,
      transferId,
      'inventory.transaction.create',
    );
    this.requireSourceAndDestinationScope(principal, transfer);
    if (
      transfer.requesterId !== principal.userId &&
      !principal.roles.includes('ORGANIZATION_ADMIN') &&
      !principal.roles.includes('SUPER_ADMIN')
    )
      this.forbid();
    return this.repository.transition({
      ...command,
      actorId: principal.userId,
      transferId,
      action: 'SUBMIT',
    });
  }

  public async approve(
    principal: AuthenticatedPrincipal,
    transferId: string,
    command: TransferCommand,
  ): Promise<Transfer> {
    const transfer = await this.requireTransferInScope(principal, transferId);
    requireIndependentApproval(
      principal,
      transfer.requesterId,
      transfer.organizationId,
      transfer.sourceLocationId,
    );
    requireLocationScope(principal, transfer.organizationId, transfer.destinationLocationId);
    return this.repository.transition({
      ...command,
      actorId: principal.userId,
      transferId,
      action: 'APPROVE',
    });
  }

  public async reject(
    principal: AuthenticatedPrincipal,
    transferId: string,
    command: TransferCommand,
  ): Promise<Transfer> {
    const transfer = await this.requireTransferInScope(principal, transferId);
    requireIndependentApproval(
      principal,
      transfer.requesterId,
      transfer.organizationId,
      transfer.sourceLocationId,
    );
    requireLocationScope(principal, transfer.organizationId, transfer.destinationLocationId);
    return this.repository.transition({
      ...command,
      actorId: principal.userId,
      transferId,
      action: 'REJECT',
    });
  }

  public async dispatch(
    principal: AuthenticatedPrincipal,
    transferId: string,
    command: TransferCommand,
  ): Promise<Transfer> {
    const transfer = await this.requireTransferInScope(
      principal,
      transferId,
      'inventory.transaction.create',
    );
    requireLocationScope(principal, transfer.organizationId, transfer.sourceLocationId);
    return this.repository.transition({
      ...command,
      actorId: principal.userId,
      transferId,
      action: 'DISPATCH',
    });
  }

  public async receive(
    principal: AuthenticatedPrincipal,
    transferId: string,
    command: TransferCommand,
    receiptLines: ReceiptLine[],
  ): Promise<Transfer> {
    const transfer = await this.requireTransferInScope(
      principal,
      transferId,
      'inventory.transaction.create',
    );
    requireLocationScope(principal, transfer.organizationId, transfer.destinationLocationId);
    this.assertReceiptLines(transfer, receiptLines);
    return this.repository.transition({
      ...command,
      actorId: principal.userId,
      transferId,
      action: 'RECEIVE',
      receiptLines,
    });
  }

  public async cancel(
    principal: AuthenticatedPrincipal,
    transferId: string,
    command: TransferCommand,
  ): Promise<Transfer> {
    const transfer = await this.requireTransferInScope(
      principal,
      transferId,
      'inventory.transaction.create',
    );
    this.requireSourceAndDestinationScope(principal, transfer);
    if (
      transfer.requesterId !== principal.userId &&
      !principal.roles.includes('ORGANIZATION_ADMIN') &&
      !principal.roles.includes('SUPER_ADMIN')
    )
      this.forbid();
    return this.repository.transition({
      ...command,
      actorId: principal.userId,
      transferId,
      action: 'CANCEL',
    });
  }

  public async get(principal: AuthenticatedPrincipal, transferId: string): Promise<Transfer> {
    return this.requireTransferInScope(principal, transferId, 'inventory.balance.read');
  }

  private async requireTransferInScope(
    principal: AuthenticatedPrincipal,
    transferId: string,
    permission?: Permission,
  ): Promise<Transfer> {
    if (permission) requirePermission(principal, permission);
    const transfer = await this.repository.getTransfer(transferId);
    if (!transfer)
      throw new AppError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource is unavailable.',
      });
    this.requireTransferVisible(principal, transfer);
    return transfer;
  }
  private requireSourceAndDestinationScope(
    principal: AuthenticatedPrincipal,
    transfer: Transfer,
  ): void {
    requireLocationScope(principal, transfer.organizationId, transfer.sourceLocationId);
    requireLocationScope(principal, transfer.organizationId, transfer.destinationLocationId);
  }
  private requireTransferVisible(principal: AuthenticatedPrincipal, transfer: Transfer): void {
    if (
      principal.scope.organizationId !== transfer.organizationId ||
      (!principal.scope.organizationWide &&
        !principal.scope.locationIds.has(transfer.sourceLocationId) &&
        !principal.scope.locationIds.has(transfer.destinationLocationId))
    )
      throw new AppError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource is unavailable.',
      });
  }
  private assertDifferentLocations(source: string, destination: string): void {
    if (source === destination)
      throw new AppError({
        statusCode: 422,
        code: 'INVALID_TRANSFER',
        message: 'Source and destination locations must differ.',
      });
  }
  private assertLines(lines: { catalogItemId: string; quantity: number }[]): void {
    if (
      !lines.length ||
      lines.some((line) => !Number.isInteger(line.quantity) || line.quantity <= 0) ||
      new Set(lines.map((line) => line.catalogItemId)).size !== lines.length
    )
      throw new AppError({
        statusCode: 422,
        code: 'INVALID_TRANSFER_LINES',
        message: 'Transfer lines must have unique items and positive integer quantities.',
      });
  }
  private assertReceiptLines(transfer: Transfer, received: ReceiptLine[]): void {
    if (
      received.length !== transfer.lines.length ||
      new Set(received.map((line) => line.transferLineId)).size !== received.length ||
      received.some((line) => !Number.isInteger(line.receivedQuantity) || line.receivedQuantity < 0)
    )
      throw new AppError({
        statusCode: 422,
        code: 'INVALID_RECEIPT',
        message: 'A receipt must report every transfer line with a non-negative integer quantity.',
      });
    const requested = new Map(transfer.lines.map((line) => [line.id, line.dispatchedQuantity]));
    if (received.some((line) => (requested.get(line.transferLineId) ?? -1) < line.receivedQuantity))
      throw new AppError({
        statusCode: 422,
        code: 'OVER_RECEIPT_REQUIRES_ADJUSTMENT',
        message:
          'Receipt quantity cannot exceed dispatched quantity; record an approved adjustment separately.',
      });
  }
  private forbid(): never {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'You are not authorized to perform this action.',
    });
  }
}

export function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
