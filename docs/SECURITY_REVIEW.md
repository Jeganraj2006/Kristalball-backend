# KAVACH engineering and security review

Review date: 2026-11-23. Scope: repository source, Prisma schema/migrations, configuration, unit tests and production build. This is an engineering review, not a penetration test, certification, or production-readiness approval.

## Confirmed findings and disposition

| Severity | Finding | Disposition |
|---|---|---|
| High | Reconciliation create/transition paths did not consistently reject an idempotency key reused with a changed request. | Fixed: the Prisma repository compares request hashes and safely returns the original state only for an identical replay. |
| High | Reconciliation posting made transfer ledger references nullable without enforcing one owning workflow line. | Fixed: migration adds an exclusive source check, requiring exactly one of transfer line or stocktake line. |
| Medium | No global audit-event model is written for transfer/reconciliation authorization denials or reads. Workflow/security events exist, but they are not a complete compliance audit trail. | Open; implement an append-only audit-event service and database trigger/privileges. |
| Medium | Frontend login and workflow controls are intentionally demo-only and do not use the authenticated API. | Open; do not deploy the SPA as an authenticated operational UI until Axios interceptors, refresh handling, API error UX, and real forms are implemented. |
| Medium | No request rate limiting, account lockout, MFA/OIDC, or security-monitoring alerts are implemented. | Open; required before internet-facing deployment. |
| Medium | PostgreSQL integration, migration execution, and database privilege testing could not run because the configured local database is unavailable. | Open; validate migrations, RLS/least-privilege database roles, backup restore, and concurrency against disposable PostgreSQL. |
| Low | Browser build has a large initial JavaScript bundle warning. | Open; route/chart code-split before production scale. |

## Controls observed

- Access JWT verification checks algorithm/type, identity status, organization/session version, and a live non-revoked refresh-session record.
- Authorization resolves roles and location grants server-side; transfer object reads hide unauthorized records with `404`; source/destination actions are separately checked.
- Transfer and stocktake workflow transitions are backend-only and guarded by state checks, idempotency keys, independent approval, serializable Prisma transactions, and append-only event/ledger triggers.
- Zod schemas reject malformed route inputs; Helmet, request-size limits, structured/redacted logs, strict CORS allow-list and HttpOnly/SameSite refresh cookies are configured.

## Residual attack surface

Tests use in-memory repositories for core workflow tests. They demonstrate policy behavior but do not prove PostgreSQL locks, constraints, triggers, or migration behavior. A privileged database credential can bypass application authorization; production must use a restricted app role and audited administrative access.
