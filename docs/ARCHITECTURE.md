# KAVACH Architecture

## 1. Architectural decisions

| Decision | Rationale |
|---|---|
| Modular monolith first | Express + TypeScript + PostgreSQL gives consistent transaction boundaries and faster delivery. Feature modules retain a clean path to future extraction. |
| Ledger is historical truth | Append-only inventory events preserve reconstruction, correction history, and auditability. |
| Projections serve reads | Current balance, availability, dashboards, and search are rebuildable read models for performance. |
| Separate serialized/bulk domains | A serialized asset has identity and custody; bulk stock has quantity and allocation. One abstraction would create invalid calculations. |
| Server-side policy enforcement | Every action is authenticated, tenant/location-scoped, and authorized at the backend. |
| Database transaction for posting | Request state, ledger append, projections, asset state, idempotency record, and audit event commit or roll back together. |
| Async only after commit | Notifications, report exports, search indexing, and projection rebuilds consume an outbox event after database commit. |

## 2. Logical components

```text
React/Vite SPA
  └─ React Router, shadcn/ui, Axios, Recharts
        │ HTTPS + JWT
Express API (TypeScript)
  ├─ Auth & session/token services
  ├─ Authorization policy / location scope resolver
  ├─ Catalog and serialized asset module
  ├─ Bulk inventory ledger and projection module
  ├─ Transaction request / approval workflow module
  ├─ Maintenance and stocktake module
  ├─ Audit and reporting module
  └─ Outbox publisher
        │ Prisma transactions
PostgreSQL
  ├─ Operational records + immutable ledger/audit tables
  ├─ Read projections
  └─ Transactional outbox
        │
Worker (later R1 if needed): notifications, exports, projection rebuilds
```

## 3. Deployment baseline

- Serve the SPA as static assets through a CDN/reverse proxy; serve the API in a separately scalable container/process.
- Run PostgreSQL as a managed, encrypted, regularly backed-up service with point-in-time recovery.
- Store attachments outside the database in encrypted object storage; keep only metadata and immutable content hashes in PostgreSQL.
- Use a secrets manager for database URLs, JWT signing keys, and storage credentials; never commit them.
- Place API behind TLS termination, request-size limits, rate limiting, structured logging, health checks, and alerting.
- Begin with one region and explicit backup/restore drills before promising high availability or disaster-recovery objectives.

## 4. Identity, authentication, and authorization

- Authenticate users using short-lived signed access JWTs and refresh-token rotation or enterprise OIDC when selected.
- JWT claims carry subject, organization, session/version, and coarse roles only. Resolve current location grants and sensitive permissions server-side to prevent stale grants.
- Central policy evaluation receives actor, action, organization, target location(s), ownership/custody context, and record sensitivity.
- All list/report queries include a server-derived allowed-location predicate. Object-level reads independently re-check scope.
- Deny by default. Cross-location data requires an explicit grant; destination-location authorization is required for transfers.
- Record authentication, authorization denial, privilege changes, approval decisions, and sensitive exports in audit history.

## 5. Inventory model and calculations

Bulk ledger entries use signed effect fields or an immutable movement type mapped to signed quantity. A location/SKU balance at time `t` is the sum of entries effective at or before `t`:

```text
closing = opening + receipts + transfers_in - transfers_out - expenditures + approved_adjustments
available = total_on_hand - allocated
```

Opening balance must itself be an identifiable ledger event, never a hidden field. Allocation/deallocation events alter `allocated` projection only. They must not change `onHand` or organizational total. Negative quantity entries and balance violations are rejected by the posting service under row-level locking/serializable handling where required.

For individual assets, lifecycle events record state transitions and a current-state projection. A transfer may change location without changing owner; custody handover may change custodian without changing location; maintenance availability may change without either. These dimensions are intentionally independent.

## 6. Transaction posting pattern

1. Client creates or submits a request with an idempotency key and canonical payload hash.
2. API authenticates, resolves scope, validates Zod schema, and checks workflow policy.
3. Approver action records an immutable decision and verifies no self-approval or stale request version.
4. On final approval, a posting command starts one Prisma database transaction.
5. It locks/rechecks affected balances and asset versions, appends ledger/lifecycle events, updates projections, marks request posted, persists idempotency result, creates audit event and outbox record.
6. Transaction commits. Worker publishes notifications or rebuild/index work after commit.
7. Any failure rolls back the mutation. The request records a controlled failed-posting state only outside/after a fully rolled-back command with diagnostic correlation.

## 7. Historical reconstruction and projections

- Ledger entries have immutable `effectiveAt` and `postedAt`. Backdating needs explicit policy and a controlled accounting period; do not overwrite a past projection.
- A report “as of” date sums ledger events through the cutoff and should present `generatedAt`, cutoff timezone, and reconciliation state.
- Projections can be rebuilt into shadow tables and atomically swapped/marked with a checkpoint. The rebuild must be tested against ledger-derived expected balances.
- Audits use write-once application tables plus database access controls. If stronger tamper evidence is required, hash-chain events and anchor periodic roots externally; ordinary app-level immutability alone does not protect against privileged database administrators.

## 8. Security risks and mitigations

| Risk | Control |
|---|---|
| IDOR/cross-location leakage | Policy-scoped queries, object authorization, tenant predicates, tests for negative cases. |
| Stolen/replayed credentials | TLS, short-lived JWTs, refresh rotation, secure storage/cookies, revocation/session version, MFA/OIDC where required. |
| Duplicate/replayed stock commands | Required idempotency key + payload hash, unique constraint, transactionally stored response. |
| Race conditions/oversubscription | Database transactions, balance row locking/version checks, revalidation at approval and posting. |
| Ledger tampering | DB least privilege, append-only triggers/permissions, audit monitoring, backups, optional hash anchoring. |
| Privilege escalation | Deny-by-default RBAC, no client-trusted scopes, approval segregation, audited role changes. |
| Injection/XSS | Zod validation, Prisma parameterization, output encoding, CSP, secure headers, dependency scanning. |
| Attachment malware/data loss | Restricted upload types/sizes, malware scanning, encrypted object storage, signed URLs, content hashes. |
| Sensitive logging | Redaction, structured logs, access controls, bounded retention. |
| Availability/data loss | Rate limits, backups/PITR, restore tests, monitoring, recovery procedures. |

## 9. Non-functional targets to confirm

- Availability, RPO/RTO, maximum concurrent users, retention period, attachment capacity, expected SKUs/assets/ledger volume, report latency, audit-export needs, and integration identity provider are not yet specified.
- Establish performance budgets and service-level objectives only after expected scale is supplied.
