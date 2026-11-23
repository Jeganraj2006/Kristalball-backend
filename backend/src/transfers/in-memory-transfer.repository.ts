import { randomUUID } from 'node:crypto';
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

interface Balance {
  onHand: number;
  allocated: number;
}

export class InMemoryTransferRepository implements TransferRepository {
  private readonly transfers = new Map<string, Transfer>();
  private readonly createKeys = new Map<string, { hash: string; transferId: string }>();
  private readonly commandKeys = new Map<string, { hash: string; transferId: string }>();
  private readonly balances = new Map<string, Balance>();
  private readonly locks = new Map<string, Promise<void>>();
  public readonly ledger: {
    transferId: string;
    lineId: string;
    locationId: string;
    delta: number;
    type: 'TRANSFER_OUT' | 'TRANSFER_IN';
  }[] = [];

  public setBalance(
    organizationId: string,
    locationId: string,
    catalogItemId: string,
    onHand: number,
    allocated = 0,
  ): void {
    this.balances.set(this.balanceKey(organizationId, locationId, catalogItemId), {
      onHand,
      allocated,
    });
  }
  public balance(organizationId: string, locationId: string, catalogItemId: string): Balance {
    return (
      this.balances.get(this.balanceKey(organizationId, locationId, catalogItemId)) ?? {
        onHand: 0,
        allocated: 0,
      }
    );
  }

  public async createDraft(input: CreateTransferInput): Promise<Transfer> {
    const prior = this.createKeys.get(input.idempotencyKey);
    if (prior) {
      if (prior.hash !== input.requestHash) this.conflict('IDEMPOTENCY_KEY_REUSED');
      return this.clone(this.transfers.get(prior.transferId)!);
    }
    const transfer: Transfer = {
      id: randomUUID(),
      organizationId: input.organizationId,
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      requesterId: input.requesterId,
      status: 'DRAFT',
      version: 1,
      lines: input.lines.map((line) => ({
        id: randomUUID(),
        catalogItemId: line.catalogItemId,
        requestedQuantity: line.quantity,
        dispatchedQuantity: 0,
        receivedQuantity: 0,
      })),
      events: [],
    };
    this.addEvent(transfer, 'CREATED', null, 'DRAFT', input.actorId, null, input.requestHash);
    this.transfers.set(transfer.id, transfer);
    this.createKeys.set(input.idempotencyKey, { hash: input.requestHash, transferId: transfer.id });
    return this.clone(transfer);
  }

  public async getTransfer(transferId: string): Promise<Transfer | null> {
    const transfer = this.transfers.get(transferId);
    return transfer ? this.clone(transfer) : null;
  }

  public async transition(
    input: TransferCommand & {
      transferId: string;
      action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'DISPATCH' | 'RECEIVE' | 'CANCEL';
      receiptLines?: ReceiptLine[];
    },
  ): Promise<Transfer> {
    return this.withLock(input.transferId, async () => {
      const prior = this.commandKeys.get(input.idempotencyKey);
      if (prior) {
        if (prior.hash !== input.requestHash || prior.transferId !== input.transferId)
          this.conflict('IDEMPOTENCY_KEY_REUSED');
        return this.clone(this.transfers.get(input.transferId)!);
      }
      const transfer = this.transfers.get(input.transferId);
      if (!transfer) this.notFound();
      this.apply(transfer, input);
      this.commandKeys.set(input.idempotencyKey, {
        hash: input.requestHash,
        transferId: transfer.id,
      });
      return this.clone(transfer);
    });
  }

  private apply(
    transfer: Transfer,
    input: TransferCommand & {
      action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'DISPATCH' | 'RECEIVE' | 'CANCEL';
      receiptLines?: ReceiptLine[];
    },
  ): void {
    const sourceStatus = transfer.status;
    if (input.action === 'SUBMIT')
      return this.move(transfer, ['DRAFT'], 'SUBMITTED', 'SUBMITTED', input);
    if (input.action === 'APPROVE')
      return this.move(transfer, ['SUBMITTED'], 'APPROVED', 'APPROVED', input);
    if (input.action === 'REJECT')
      return this.move(transfer, ['SUBMITTED'], 'REJECTED', 'REJECTED', input);
    if (input.action === 'CANCEL')
      return this.move(transfer, ['DRAFT', 'SUBMITTED'], 'CANCELLED', 'CANCELLED', input);
    if (input.action === 'DISPATCH') {
      this.requireStatus(transfer, ['APPROVED']);
      for (const line of transfer.lines) {
        const balance = this.balance(
          transfer.organizationId,
          transfer.sourceLocationId,
          line.catalogItemId,
        );
        if (balance.onHand - balance.allocated < line.requestedQuantity)
          this.conflict('INSUFFICIENT_INVENTORY');
      }
      for (const line of transfer.lines) {
        const balance = this.balance(
          transfer.organizationId,
          transfer.sourceLocationId,
          line.catalogItemId,
        );
        balance.onHand -= line.requestedQuantity;
        this.balances.set(
          this.balanceKey(transfer.organizationId, transfer.sourceLocationId, line.catalogItemId),
          balance,
        );
        line.dispatchedQuantity = line.requestedQuantity;
        this.ledger.push({
          transferId: transfer.id,
          lineId: line.id,
          locationId: transfer.sourceLocationId,
          delta: -line.requestedQuantity,
          type: 'TRANSFER_OUT',
        });
      }
      this.move(transfer, ['APPROVED'], 'DISPATCHED', 'DISPATCHED', input);
      return;
    }
    if (input.action === 'RECEIVE') {
      this.requireStatus(transfer, ['DISPATCHED']);
      const received = new Map(
        (input.receiptLines ?? []).map((line) => [line.transferLineId, line.receivedQuantity]),
      );
      let discrepancy = false;
      for (const line of transfer.lines) {
        const quantity = received.get(line.id);
        if (quantity === undefined)
          throw new AppError({
            statusCode: 422,
            code: 'INVALID_RECEIPT',
            message: 'Every transfer line must be received or reported short.',
          });
        line.receivedQuantity = quantity;
        discrepancy ||= quantity !== line.dispatchedQuantity;
        const balance = this.balance(
          transfer.organizationId,
          transfer.destinationLocationId,
          line.catalogItemId,
        );
        balance.onHand += quantity;
        this.balances.set(
          this.balanceKey(
            transfer.organizationId,
            transfer.destinationLocationId,
            line.catalogItemId,
          ),
          balance,
        );
        if (quantity > 0)
          this.ledger.push({
            transferId: transfer.id,
            lineId: line.id,
            locationId: transfer.destinationLocationId,
            delta: quantity,
            type: 'TRANSFER_IN',
          });
      }
      const target = discrepancy ? 'DISCREPANCY' : 'RECEIVED';
      this.move(transfer, ['DISPATCHED'], target, 'RECEIVED', input);
      if (discrepancy)
        this.addEvent(
          transfer,
          'DISCREPANCY_RECORDED',
          'DISCREPANCY',
          'DISCREPANCY',
          input.actorId,
          null,
          null,
        );
      else this.addEvent(transfer, 'COMPLETED', 'RECEIVED', 'RECEIVED', input.actorId, null, null);
      return;
    }
    throw new Error(`Unsupported action from ${sourceStatus}`);
  }

  private move(
    transfer: Transfer,
    allowed: TransferStatus[],
    next: TransferStatus,
    event: TransferEventType,
    input: TransferCommand,
  ): void {
    this.requireStatus(transfer, allowed);
    const previous = transfer.status;
    transfer.status = next;
    transfer.version += 1;
    this.addEvent(
      transfer,
      event,
      previous,
      next,
      input.actorId,
      input.idempotencyKey,
      input.requestHash,
      input.reason,
    );
  }
  private addEvent(
    transfer: Transfer,
    type: TransferEventType,
    fromStatus: TransferStatus | null,
    toStatus: TransferStatus,
    actorId: string,
    idempotencyKey: string | null,
    requestHash: string | null,
    reason?: string,
  ): void {
    transfer.events.push({
      id: randomUUID(),
      type,
      fromStatus,
      toStatus,
      actorId,
      idempotencyKey,
      requestHash,
      reason: reason ?? null,
      occurredAt: new Date(),
    });
  }
  private requireStatus(transfer: Transfer, allowed: TransferStatus[]): void {
    if (!allowed.includes(transfer.status)) this.conflict('INVALID_TRANSFER_STATE');
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
  private balanceKey(org: string, location: string, item: string): string {
    return `${org}:${location}:${item}`;
  }
  private clone(transfer: Transfer): Transfer {
    return structuredClone(transfer);
  }
  private async withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => next);
    this.locks.set(key, queued);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.locks.get(key) === queued) this.locks.delete(key);
    }
  }
}
