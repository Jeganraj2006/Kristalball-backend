# Authentication and Authorization

## Authentication flow

- Passwords are stored only as bcrypt hashes (cost 12 in the production service).
- `POST /api/v1/auth/login` validates a strict payload, returns a 15-minute HS256 access JWT, and sets a seven-day, opaque refresh token in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`.
- Access tokens contain only subject, organization, session ID, session version, issuer/audience, and expiry. They contain no trusted location grants or effective permissions.
- `POST /api/v1/auth/refresh` rotates the opaque refresh token: it creates a new session, revokes the prior session, then returns a new access token.
- `POST /api/v1/auth/logout` requires a valid bearer token and revokes the associated refresh session.
- `GET /api/v1/auth/me` resolves the current identity, roles, permissions, and server-authorized location scope.

The frontend must retain access tokens in memory only and use `withCredentials` only for the refresh endpoint. It must never store refresh tokens, passwords, JWT signing keys, or database values in browser storage.

## Authorization flow

1. Middleware verifies JWT signature, issuer, audience, expiry, and token type.
2. Middleware re-loads the current active identity and refresh-session record from PostgreSQL, so session revocation invalidates the associated access token immediately.
3. The server derives permissions from stored roles and derives authorized location IDs from valid `location_grants`, expanding descendant grants with a server-side recursive query.
4. Feature services load a target record first, then call `requireLocationScope` with the record's organization/location. They do not trust a body, query, or URL location identifier as proof of access.
5. Restricted approval flows call `requireIndependentApproval`, which requires approval permission, in-scope location access, and a different requester/approver identity.

## Role mapping

| Role | Intent |
|---|---|
| `SUPER_ADMIN` | Full administrative permissions, still constrained to server-provided organization scope. |
| `ORGANIZATION_ADMIN` | Organization administration, including roles and grants. |
| `BASE_COMMANDER` | In-scope operational approval and command functions. |
| `LOGISTICS_OFFICER` | In-scope asset and inventory request functions; no approval permission. |
| `INVENTORY_OFFICER` | In-scope balance, transaction-request, and stocktake-count functions. |
| `AUDITOR` | Read-only asset, inventory, and audit access. No mutation or approval permission. |
| `MAINTENANCE_OFFICER` | In-scope maintenance management and asset-read access. |

## Security events

The authentication service records successful and failed login, refresh, and logout events with a request correlation ID. Passwords, access tokens, refresh tokens, and raw credentials are not logged.

## Remaining controls before production

- Add a distributed login-rate-limit store (Redis or API gateway) before multiple API instances are deployed; an in-memory limiter is not cluster-safe.
- Define account lockout, MFA, password reset, password rotation, and identity-provider/OIDC policy with security owners.
- Add refresh-token reuse detection that revokes all user sessions transactionally, plus device/session management.
- Apply the migration to an isolated PostgreSQL database and add integration tests for real RLS/grant hierarchy behavior.
- Put TLS/HSTS, a secret manager, key rotation, centralized audit retention, and monitoring/alerting in the deployment baseline.
