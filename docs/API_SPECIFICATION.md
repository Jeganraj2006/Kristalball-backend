# KAVACH API Specification

## 1. API conventions

- Base path: `/api/v1`; JSON over HTTPS; UTF-8; timestamps are UTC ISO-8601.
- Authentication: `Authorization: Bearer <access-token>`. The server derives organization and permitted locations; callers cannot widen scope with headers or query parameters.
- State-changing POST/PATCH commands require `Idempotency-Key` and respond with a correlation ID. Reusing a key with a different payload returns `409`.
- Mutable resources use `version`/`If-Match` style optimistic concurrency. A stale version returns `409`.
- List endpoints are paginated (`cursor`, `limit`) and support only allow-listed filters/sorts. Responses include server-filtered data only.
- Use stable error shape: `{ "error": { "code", "message", "details", "correlationId" } }`. Never reveal authorization implementation details.

## 2. Auth and identity

| Method/path | Purpose | Required permission |
|---|---|---|
| `POST /auth/login` | Start approved local/demo login flow or exchange IdP code. | Public / rate limited |
| `POST /auth/refresh` | Rotate a refresh token/session. | Valid refresh session |
| `POST /auth/logout` | Revoke current session. | Authenticated |
| `GET /me` | Current user, roles, and effective scope summary. | Authenticated |

Production identity flow must be selected before implementation; password storage is not assumed by this specification.

Implementation note: access JWTs expire after 15 minutes and contain only session/identity claims. Refresh tokens are opaque, rotated server-side session tokens held in an `HttpOnly`, `SameSite=Strict` cookie; they are never returned in JSON or exposed to the frontend runtime.

## 3. Administration and reference data

| Method/path | Purpose |
|---|---|
| `GET, POST /locations` | List within scope or create a location. |
| `GET, PATCH /locations/:locationId` | Read/update location metadata. |
| `GET, POST /catalog-items` | List/create catalog item. |
| `GET, PATCH /catalog-items/:itemId` | Read/update permitted catalog metadata; tracking type is locked after use. |
| `GET, POST /users` | List/invite/provision user. |
| `GET, PATCH /users/:userId/roles` | View/assign roles under administration policy. |
| `GET, PATCH /users/:userId/location-grants` | View/assign location scope. |
| `GET /permissions` | Enumerate permissions available to caller. |

## 4. Serialized asset endpoints

| Method/path | Purpose |
|---|---|
| `GET, POST /assets` | Search scoped assets or register serialized asset. |
| `GET /assets/:assetId` | Asset details, current independent dimensions, lifecycle history, custody, and maintenance summary. |
| `PATCH /assets/:assetId` | Amend only non-historical metadata with version check; changes to ownership/location/custody/state use workflow endpoints. |
| `POST /assets/:assetId/transactions` | Create a governed serialized asset transaction request. |
| `GET /assets/:assetId/events` | Read append-only lifecycle events. |
| `POST /assets/:assetId/maintenance-work-orders` | Open maintenance work order. |
| `GET, PATCH /maintenance-work-orders/:workOrderId` | Read/update allowed work-order state; closure creates lifecycle/audit events. |

## 5. Bulk inventory and ledger endpoints

| Method/path | Purpose |
|---|---|
| `GET /inventory/balances` | Current scoped balance projections; returns on-hand, allocated, available, watermark. |
| `GET /inventory/balances/history` | Reconstruct balance at `asOf`, location, catalog item; reports completeness/watermark. |
| `GET /inventory/ledger` | Read-only filtered ledger entries with transaction link. |
| `POST /inventory/transactions` | Create a draft or submit receipt, issue, transfer, expenditure, allocation, deallocation, or adjustment request. |
| `GET /inventory/transactions/:transactionId` | Transaction, lines, approvals, post result, and audit references. |
| `PATCH /inventory/transactions/:transactionId` | Edit draft only, with version check. |
| `POST /inventory/transactions/:transactionId/submit` | Validate and submit draft. |
| `POST /inventory/transactions/:transactionId/cancel` | Cancel permitted unposted request. |
| `POST /inventory/transactions/:transactionId/receive` | Confirm destination receipt if two-step transfer policy is enabled. |

The server, not the client, maps transaction type to valid ledger deltas. `POST /inventory/ledger` is intentionally absent.

### Controlled transfer implementation

The implemented transfer endpoints are documented in [TRANSFER_WORKFLOW.md](TRANSFER_WORKFLOW.md). They are intentionally separate from the generic transaction endpoint so callers cannot select or bypass workflow states directly.

## 6. Approval endpoints

| Method/path | Purpose |
|---|---|
| `GET /approvals/inbox` | Scoped work awaiting caller’s decision. |
| `GET /inventory/transactions/:transactionId/approval-history` | Immutable decision history and policy snapshot. |
| `POST /inventory/transactions/:transactionId/approve` | Record an authorized approval; posts only on final approval. |
| `POST /inventory/transactions/:transactionId/reject` | Record rejection with required reason. |
| `POST /inventory/transactions/:transactionId/request-changes` | Return an unposted request to draft where policy permits. |

## 7. Stocktake and discrepancy endpoints

| Method/path | Purpose |
|---|---|
| `GET, POST /stocktakes` | List/create count session with location, scope, and book cutoff. |
| `GET /stocktakes/:stocktakeId` | Session, counters, reconstructed book values, counts, and variance. |
| `POST /stocktakes/:stocktakeId/lines` | Record count observation/scans; validates count session state. |
| `POST /stocktakes/:stocktakeId/complete` | Complete count; lock observations and calculate discrepancies. |
| `POST /stocktakes/:stocktakeId/discrepancies/:lineId/resolve` | Propose/approve controlled resolution; posts adjustment only after required approval. |

## 8. Audit, reporting, and attachments

| Method/path | Purpose |
|---|---|
| `GET /audit-events` | Read scoped immutable audit history; sensitive export is separately permissioned. |
| `GET /reports/dashboard` | Authorized aggregates only. |
| `GET /reports/assets` | Asset report by location, lifecycle, condition, custodian. |
| `GET /reports/inventory` | On-hand/allocated/available and as-of/reconciliation report. |
| `POST /exports` | Create an authorized asynchronous export; audit creation/download. |
| `POST /attachments/upload-intents` | Create constrained, authorized signed upload intent. |
| `GET /attachments/:attachmentId/download` | Issue time-limited authorized download URL. |

## 9. Command examples

Create a transfer request (not a raw movement):

```json
{
  "type": "TRANSFER",
  "sourceLocationId": "uuid",
  "destinationLocationId": "uuid",
  "lines": [{ "catalogItemId": "uuid", "quantity": 12, "reasonCode": "REPLENISHMENT" }],
  "effectiveAt": "2026-11-23T10:00:00Z"
}
```

Approval response:

```json
{ "decision": "APPROVE", "comment": "Verified against fictional demonstration requisition.", "version": 3 }
```

## 10. Status codes

`200/201/202` success; `400` malformed request; `401` unauthenticated; `403` unauthorized; `404` undiscoverable/unavailable resource; `409` duplicate key, stale version, invalid current state, or insufficient stock; `422` business validation failure; `429` rate limit; `500` unexpected error with correlation ID.
