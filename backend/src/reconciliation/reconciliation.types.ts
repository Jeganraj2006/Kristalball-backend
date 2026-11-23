export const stocktakeStatuses = [
  'DRAFT',
  'COUNTING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
] as const;
export type StocktakeStatus = (typeof stocktakeStatuses)[number];
export interface StocktakeLine {
  id: string;
  catalogItemId: string;
  expectedQuantity: number;
  actualQuantity: number | null;
  variance: number | null;
  category: string | null;
  notes: string | null;
}
export interface StocktakeEvent {
  id: string;
  type: string;
  fromStatus: StocktakeStatus | null;
  toStatus: StocktakeStatus;
  actorId: string;
  occurredAt: Date;
  reason: string | null;
}
export interface Stocktake {
  id: string;
  organizationId: string;
  locationId: string;
  counterId: string;
  status: StocktakeStatus;
  lines: StocktakeLine[];
  events: StocktakeEvent[];
}
export interface Command {
  actorId: string;
  key: string;
  hash: string;
  reason?: string;
}
export interface ReconciliationRepository {
  create(
    input: Command & { organizationId: string; locationId: string; itemIds: string[] },
  ): Promise<Stocktake>;
  get(id: string): Promise<Stocktake | null>;
  count(
    id: string,
    input: Command & {
      lines: { lineId: string; actualQuantity: number; category?: string; notes?: string }[];
    },
  ): Promise<Stocktake>;
  transition(
    id: string,
    input: Command & { action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'POST' | 'CANCEL' },
  ): Promise<Stocktake>;
}
