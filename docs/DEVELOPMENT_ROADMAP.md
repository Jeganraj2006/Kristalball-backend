# KAVACH Phased Development Roadmap

## Phase 0 — Decision and control baseline

Deliverables: approved PRD, location hierarchy, approval matrix, controlled categories, units, transfer timing, lifecycle states, retention/RPO/RTO, identity approach, threat model, fictional-data policy, and measurable scale assumptions.

Exit: product owner and security/data owners resolve the open decisions in `PRD.md`; no implementation begins with assumed financial or approval thresholds.

## Phase 1 — Foundation and security

Deliverables: monorepo or clearly separated frontend/backend packages; TypeScript/Vite/React/Tailwind/shadcn setup; Express/Prisma/PostgreSQL setup; migrations; Zod request validation; JWT/OIDC-ready authentication; RBAC and location-scope policy service; audit middleware; fictional seed generator; CI for lint/typecheck/Vitest.

Exit: authenticated user sees only test data from their granted fictional locations; authorization denial tests pass.

## Phase 2 — Master data and serialized asset accountability

Deliverables: organization/location tree, catalog, roles/grants UI/API, serialized asset registration, independent ownership/location/availability/custody projections, lifecycle-event append model, asset search and history, basic custody workflow.

Exit: lifecycle changes generate immutable events; duplicate tags/serials and unauthorized cross-location reads fail; custody does not overwrite owner/location.

## Phase 3 — Bulk ledger and safe transaction engine

Deliverables: inventory transaction drafts, idempotency middleware/table, approval decisions, database-transaction posting service, ledger, balance projections, receipt/issue/transfer/expenditure/allocation flows, as-of reconstruction, projection rebuild tool and reconciliation tests.

Exit: mathematical rules hold under concurrency and retry tests; duplicate command creates one posted result; allocation changes available but not on-hand.

## Phase 4 — Maintenance, stocktakes, and discrepancies

Deliverables: work orders, availability/condition lifecycle integration, physical count sessions, count capture, book-balance cutoff calculation, discrepancy investigation and approved compensating adjustments, evidence metadata.

Exit: a completed stocktake cannot rewrite ledger history; only authorized resolution posts an adjustment; maintenance closure preserves history.

## Phase 5 — UX, reporting, and operational hardening

Deliverables: dashboards/Recharts, approval inbox, accessible responsive workflows, server-scoped reports, async export, audit search, attachment security, structured logs/metrics/tracing, backup/restore drill, security testing, Playwright critical-path suite.

Exit: user acceptance with fictional data; performance/security test targets met; operational runbook approved.

## Phase 6 — Pilot and controlled expansion

Deliverables: limited fictional/pilot rollout, data migration/import plan, feedback loop, error-budget monitoring, post-implementation audit, prioritized backlog for barcode/RFID, integrations, accounting, or mobile use.

Exit: reconciliation confidence and authorization review meet governance criteria before broader deployment.

## Cross-phase quality gates

| Gate | Required evidence |
|---|---|
| Domain correctness | Unit tests for formulas, lifecycle transitions, allocation semantics, and compensating corrections. |
| Transaction safety | Supertest/integration tests for idempotency, atomic rollback, stale versions, and concurrent stock attempts. |
| Authorization | Positive and negative location/role tests for every endpoint and report/export. |
| Auditability | Test proves each material mutation records actor, timestamp, correlation, source command, and decision history. |
| Database safety | Migration review, backup/restore test, append-only trigger test, projection-to-ledger reconciliation. |
| UX/accessibility | Playwright paths plus keyboard, focus, validation, and error-state review. |
| Security | Dependency scan, secret scan, rate-limit/security-header validation, attachment handling assessment, threat-model review. |

## Dependencies and risks to retire early

- Decide organization/tenant boundary and identity provider before designing session/token operations.
- Decide transfer receipt/in-transit behavior before writing ledger posting logic.
- Obtain approval matrix and controlled-item policy before creating workflow defaults.
- Measure data volumes before committing to report/query latency targets or materialized-view strategy.
- Select attachment storage/scanning and audit-retention policy before accepting production evidence files.
