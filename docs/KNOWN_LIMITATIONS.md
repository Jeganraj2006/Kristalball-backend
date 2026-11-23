# Known limitations

- Not production-ready or security-certified. Independent penetration testing, threat modelling, dependency scanning, SAST/DAST, and deployment review remain required.
- Frontend pages are fictional demonstration UI and are not integrated with the backend authentication/workflow APIs.
- Physical reconciliation supports an approved compensating adjustment but not a separate investigation/disposition workflow or attachment evidence.
- Database migrations were not executed against a live PostgreSQL instance in this environment.
- There is no rate limiter, MFA/OIDC integration, password reset/verification flow, centralized audit-event service, outbox worker, database RLS, or restricted production database-role setup.
- Prisma serializable transactions do not yet have a bounded retry policy for PostgreSQL serialization failures.
- Transfers/reconciliations are bulk inventory only; serialized assets remain outside these modules.
- API list/search pagination and report export controls are not implemented.
