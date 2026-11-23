CREATE TYPE "StocktakeStatus" AS ENUM ('DRAFT', 'COUNTING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');
ALTER TYPE "InventoryMovementType" ADD VALUE 'RECONCILIATION_ADJUSTMENT';

ALTER TABLE "inventory_ledger_entries" ALTER COLUMN "transfer_id" DROP NOT NULL;
ALTER TABLE "inventory_ledger_entries" ALTER COLUMN "transfer_line_id" DROP NOT NULL;
ALTER TABLE "inventory_ledger_entries" ADD COLUMN "stocktake_line_id" UUID;
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_one_source" CHECK (("transfer_line_id" IS NOT NULL) <> ("stocktake_line_id" IS NOT NULL));

CREATE TABLE "stocktakes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "location_id" UUID NOT NULL REFERENCES "locations"("id"), "counter_id" UUID NOT NULL REFERENCES "users"("id"),
  "status" "StocktakeStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "idempotency_key" TEXT NOT NULL UNIQUE, "request_hash" TEXT NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(), "submitted_at" TIMESTAMPTZ(6)
);
CREATE TABLE "stocktake_lines" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "stocktake_id" UUID NOT NULL REFERENCES "stocktakes"("id"),
  "catalog_item_id" UUID NOT NULL REFERENCES "catalog_items"("id"), "expected_quantity" INTEGER NOT NULL CHECK ("expected_quantity" >= 0),
  "actual_quantity" INTEGER CHECK ("actual_quantity" >= 0), "variance" INTEGER, "discrepancy_category" TEXT, "notes" TEXT,
  UNIQUE("stocktake_id", "catalog_item_id")
);
CREATE TABLE "stocktake_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "stocktake_id" UUID NOT NULL REFERENCES "stocktakes"("id"), "type" TEXT NOT NULL,
  "from_status" "StocktakeStatus", "to_status" "StocktakeStatus" NOT NULL, "actor_id" UUID NOT NULL REFERENCES "users"("id"),
  "idempotency_key" TEXT UNIQUE, "request_hash" TEXT, "reason" TEXT, "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_stocktake_line_id_fkey" FOREIGN KEY ("stocktake_line_id") REFERENCES "stocktake_lines"("id") ON DELETE RESTRICT;
CREATE INDEX "stocktakes_organization_id_location_id_status_idx" ON "stocktakes"("organization_id", "location_id", "status");
CREATE INDEX "stocktake_events_stocktake_id_occurred_at_idx" ON "stocktake_events"("stocktake_id", "occurred_at");
CREATE OR REPLACE FUNCTION prevent_stocktake_history_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'stocktake history is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER stocktake_events_append_only BEFORE UPDATE OR DELETE ON "stocktake_events" FOR EACH ROW EXECUTE FUNCTION prevent_stocktake_history_mutation();
