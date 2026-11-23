# KAVACH Database Design

## 1. Data modeling principles

- PostgreSQL stores every business record under `organization_id`.
- UUID primary keys, UTC `timestamptz`, `created_at`, `created_by`, and immutable event identifiers are standard.
- Use lookup enums/check constraints for lifecycle states and movement types; do not infer semantics from free text.
- Apply foreign keys, unique constraints, and partial indexes at the database level. Service validation is necessary but insufficient.
- Do not place mutable current balance fields on the ledger as truth. Materialized projections are explicitly labeled read models.

## 2. Core entity model

```text
Organization ──< Location (parent/child)
Organization ──< User ──< UserRole >── Role ──< RolePermission >── Permission
User ──< LocationGrant >── Location

CatalogItem (SERIALIZED | BULK)
  ├─< Asset (serialized only) ──< AssetLifecycleEvent
  └─< InventoryLedgerEntry (bulk only) >── InventoryTransaction

InventoryTransaction ──< TransactionLine
InventoryTransaction ──< ApprovalDecision
InventoryTransaction ──< IdempotencyRecord

BulkBalanceProjection (organization, location, catalog item)
Allocation ──> bulk item/location or asset
Asset ──< MaintenanceWorkOrder
Stocktake ──< StocktakeLine ──< DiscrepancyResolution
AuditEvent; Attachment; OutboxEvent
```

## 3. Tables and essential columns

| Table | Essential columns and constraints |
|---|---|
| `organizations` | `id`, `name`, `status`. Unique normalized name if required. |
| `locations` | `id`, `organization_id`, `parent_id`, `code`, `name`, `type`, `status`. Unique `(organization_id, normalized_code)`. Enforce same-organization parent and prevent cycles. |
| `users` | `id`, `organization_id`, `external_subject`, `email`, `status`, `session_version`. Unique `(organization_id, external_subject)` and normalized email. |
| `roles`, `permissions`, `user_roles`, `role_permissions` | Role catalog and many-to-many grants; avoid a single unstructured permissions JSON field. |
| `location_grants` | `user_id`, `location_id`, `scope_mode`, `inherit_descendants`, `valid_from`, `valid_until`. Grant scope must be resolved server-side. |
| `catalog_items` | `id`, `organization_id`, `sku`, `name`, `tracking_type`, `base_unit`, `controlled`, `active`. Unique normalized SKU; `tracking_type` immutable after use. |
| `assets` | `id`, `organization_id`, `catalog_item_id`, `asset_tag`, `serial_number`, `owner_org_id`, `current_location_id`, `custodian_user_id`, `availability`, `condition`, `lifecycle_state`, `version`. Unique tag; partial unique serial where non-null. Serialized catalog only. |
| `asset_lifecycle_events` | Append-only: `id`, `asset_id`, `transaction_id`, `event_type`, prior/new independent state values, `effective_at`, `posted_at`, `actor_id`, `reason`, `correlation_id`. |
| `inventory_transactions` | `id`, `organization_id`, `type`, `status`, `source_location_id`, `destination_location_id`, `requester_id`, `submitted_at`, `approved_at`, `posted_at`, `version`, `correlation_id`. |
| `transaction_lines` | `id`, `transaction_id`, catalog or asset reference, `quantity`, `unit`, reason. Check exactly one correct tracking-domain reference. |
| `approval_decisions` | Append-only: `id`, `transaction_id`, `step`, `decision`, `approver_id`, `decided_at`, `comment`, `policy_snapshot`. Unique approved/rejected action per step/actor as policy requires. |
| `inventory_ledger_entries` | Append-only: `id`, `organization_id`, `transaction_id`, `transaction_line_id`, `catalog_item_id`, `location_id`, `movement_type`, `on_hand_delta`, `allocated_delta`, `effective_at`, `posted_at`, `actor_id`, `reversal_of_id`, `correlation_id`. Bulk item only; no update/delete grant. |
| `bulk_balance_projections` | `organization_id`, `location_id`, `catalog_item_id`, `on_hand`, `allocated`, `available`, `ledger_watermark`, `version`, `updated_at`. Unique triple; check `on_hand >= 0`, `allocated >= 0`, `available = on_hand - allocated`. |
| `allocations` | `id`, recipient/cost center reference, source location, catalog or asset reference, quantity, `status`, allocated/released timestamps, source transaction. Allocation requires available stock and is independent from expense. |
| `maintenance_work_orders` | `id`, `asset_id`, `status`, `priority`, `opened_at`, `scheduled_at`, `completed_at`, `condition_before`, `condition_after`, technician/provider, notes. |
| `stocktakes` | `id`, `organization_id`, `location_id`, `status`, `scope`, `book_cutoff_at`, `count_started_at`, `count_completed_at`, counters, approved_by. |
| `stocktake_lines` | `id`, `stocktake_id`, catalog/asset reference, `book_quantity`, `counted_quantity`, `variance`, evidence/notes. Book quantity is a captured reconstruction at cutoff, never a live balance reference. |
| `discrepancy_resolutions` | `id`, `stocktake_line_id`, `status`, `proposed_delta`, investigation, approved_by, posted_transaction_id`. |
| `idempotency_records` | `organization_id`, `actor_id`, `key`, `request_hash`, `resource_type`, `resource_id`, `response_status`, `response_body`, expiration. Unique `(organization_id, actor_id, key)`; different hash yields conflict. |
| `audit_events` | Append-only: `id`, organization, actor, action, entity type/id, correlation id, occurred at, request metadata, before/after hashes or safe snapshots. |
| `attachments` | Metadata only: owning entity, storage key, SHA-256, content type, size, upload status, uploader. |
| `outbox_events` | Event payload/version, occurred at, processed at/attempts. Written in the same database transaction as originating state. |

## 4. Integrity controls

1. `inventory_ledger_entries`, `asset_lifecycle_events`, `approval_decisions`, and `audit_events` receive no application `UPDATE` or `DELETE` permissions. Database triggers additionally reject those operations except a controlled archival process.
2. Every stock mutation references a posted `inventory_transaction`; a transaction line and ledger entries reconcile to its approved business intent.
3. Transfers have paired ledger entries with opposite `on_hand_delta`, shared `transaction_line_id`, and constrained source/destination locations. If two-stage transfers are chosen, source moves to `IN_TRANSIT` before destination receipt.
4. Post a compensating entry with `reversal_of_id` for correction; never mutate a ledger row.
5. Transaction posting locks affected `bulk_balance_projections` rows in deterministic order. It validates resulting non-negative stock and availability before commit.
6. Asset event insertion locks the asset/current version, validates permitted transition, and writes the new `assets` projection atomically.
7. Database indexes include `(organization_id, location_id, catalog_item_id)`, ledger `(organization_id, location_id, catalog_item_id, effective_at)`, transaction status/created time, asset tag/serial, audit entity/correlation, and location hierarchy support.

## 5. Calculation example

At a warehouse, bulk item `FIC-BATT-100` has opening 100, receipt 25, transfer in 10, transfer out 20, expenditure 5, and approved adjustment -2. Closing on-hand is `100 + 25 + 10 - 20 - 5 - 2 = 108`. If 18 are actively allocated, available quantity is `108 - 18 = 90`; organizational on-hand remains 108.

## 6. Prisma notes

- Prisma models express table relationships and simple constraints; write raw SQL migrations for append-only triggers, partial unique indexes, exclusion/check constraints, and row-level security if adopted.
- Wrap posting operations in interactive Prisma transactions. Keep them short, retry serialization failures safely, and derive retries from the idempotency record.
- Do not rely solely on `updatedAt` for conflict protection; persist an integer `version` and require it on mutable commands.
