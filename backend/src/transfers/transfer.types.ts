export const transferStatuses = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'DISPATCHED',
  'RECEIVED',
  'DISCREPANCY',
  'CANCELLED',
] as const;
export type TransferStatus = (typeof transferStatuses)[number];
export type TransferEventType =
  | 'CREATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'DISCREPANCY_RECORDED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TransferLine {
  id: string;
  catalogItemId: string;
  requestedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
}
export interface TransferEvent {
  id: string;
  type: TransferEventType;
  fromStatus: TransferStatus | null;
  toStatus: TransferStatus;
  actorId: string;
  idempotencyKey: string | null;
  requestHash: string | null;
  reason: string | null;
  occurredAt: Date;
  payload?: Record<string, unknown>;
}
export interface Transfer {
  id: string;
  organizationId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  requesterId: string;
  status: TransferStatus;
  version: number;
  lines: TransferLine[];
  events: TransferEvent[];
}
export interface TransferCommand {
  actorId: string;
  idempotencyKey: string;
  requestHash: string;
  reason?: string;
}
export interface ReceiptLine {
  transferLineId: string;
  receivedQuantity: number;
}
export interface CreateTransferInput extends TransferCommand {
  organizationId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  requesterId: string;
  lines: { catalogItemId: string; quantity: number }[];
}
export interface TransferRepository {
  createDraft(input: CreateTransferInput): Promise<Transfer>;
  getTransfer(transferId: string): Promise<Transfer | null>;
  transition(
    input: TransferCommand & {
      transferId: string;
      action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'DISPATCH' | 'RECEIVE' | 'CANCEL';
      receiptLines?: ReceiptLine[];
    },
  ): Promise<Transfer>;
}
