# KAVACH Engineering Conventions

## Product boundary

KAVACH is a fictional, multi-location Asset Accountability & Lifecycle Management Platform. Use only fabricated organisations, locations, people, asset identifiers, and inventory. Do not add real military, government, personnel, or operational data.

## Architecture and source of truth

- TypeScript is required throughout the React/Vite frontend and Express backend.
- PostgreSQL is authoritative. Prisma migrations are the only supported production schema change mechanism.
- Inventory history is append-only. `InventoryLedgerEntry`, approval decisions, and audit events must never be updated or deleted after creation.
- Mutable read models may be rebuilt from the ledger. They are caches, not historical truth.
- Individual serialized assets and bulk stock are separate domains. Never represent serialized assets as a bulk quantity or vice versa.
- Keep ownership, physical location, availability state, and custodian as independent fields/relations; a change to one must not silently mutate another.
- All stock-affecting workflow completion occurs in one database transaction with idempotency enforcement and audit-event creation.

## Backend conventions

- Structure by feature: `auth`, `assets`, `inventory`, `transactions`, `maintenance`, `stocktakes`, `reports`, and shared platform modules.
- Validate every request boundary with Zod; reject unknown or malformed fields where appropriate.
- Authenticate first, then authorize server-side for every endpoint. Frontend guards are user experience only.
- Scope queries through a central authorization policy/service, never by a client-supplied location ID alone.
- Use UTC ISO-8601 timestamps; use database UUIDs; store quantities as non-negative integers in the smallest approved unit.
- Require `Idempotency-Key` for state-changing workflow submissions. Persist request hash and response for replay-safe retries.
- Use optimistic concurrency/version checks for mutable workflow drafts and asset records. Return `409 Conflict` on stale writes.
- Never hard-delete business records. Use explicit lifecycle states, correction events, or redaction procedures approved by governance.
- Do not log secrets, JWTs, passwords, or unnecessary personal data.

## Frontend conventions

- React + TypeScript with Vite, Tailwind CSS, shadcn/ui, Lucide, Recharts, React Router, and Axios.
- Keep API types generated or shared from a versioned contract where feasible; do not duplicate business calculations only in the UI.
- Treat all UI permissions and stock balances as informational; backend responses remain authoritative.
- Provide clear status, approval history, validation, idempotent retry, and conflict states for workflow forms.
- Follow accessible semantic markup, keyboard navigation, visible focus, and responsive layouts.

## Data integrity rules

- For a bulk item/location balance: `closing = opening + receipts + transfers_in - transfers_out - expenditures + approved_adjustments`.
- `available = total_on_hand - allocated`. Allocation changes availability only; it does not remove organizational stock.
- Disallow negative on-hand and allocated greater than on-hand unless a documented, approved discrepancy workflow explicitly records the exception.
- Transfers create paired out/in ledger entries tied by one immutable transaction ID; destination receipt must be explicit if in-transit custody is modeled.
- Corrections are compensating entries—never edits to posted ledger entries.
- Physical stocktakes create counted observations and approved discrepancy adjustments; they do not overwrite system balance.

## Testing and quality gates

- Unit test domain rules and authorization policy with Vitest.
- Integration test Express/Prisma endpoints and transactional mutations with Supertest against an isolated PostgreSQL database.
- Use Playwright for critical user journeys: login, approval, transfer, stocktake discrepancy, maintenance closure, and denied cross-location access.
- Before merging: format, lint, type-check, test, run migrations against a disposable database, and review authorization/ledger changes.
- Add regression tests for every corrected calculation, duplicate submission, authorization, or audit defect.

## Git and documentation

- Use branches prefixed `codex/` unless instructed otherwise.
- Keep commits focused; do not mix refactors with policy or schema changes.
- Update `docs/` when business rules, permissions, data models, or APIs change.
- Explicitly document assumptions and open decisions; do not invent policy thresholds or retention periods.
