# Controlled inventory transfers

## State machine

`DRAFT → SUBMITTED → APPROVED → DISPATCHED → RECEIVED`

`SUBMITTED → REJECTED`; `DRAFT | SUBMITTED → CANCELLED`; and `DISPATCHED → DISCREPANCY` when any acknowledged quantity is short. Terminal states cannot be changed through the API. `COMPLETED` and `DISCREPANCY_RECORDED` are immutable events, not extra statuses, because the approved status list has no `COMPLETED` state.

## Posting rules

- Draft, submission, approval, rejection and cancellation never change stock.
- Dispatch locks and rechecks source availability (`onHand - allocated`), appends a `TRANSFER_OUT` ledger entry, and debits source on-hand stock.
- Receipt records every dispatched line. It credits the destination only by the acknowledged received quantity and appends `TRANSFER_IN` entries. A short receipt becomes `DISCREPANCY`; missing quantity is never manufactured.
- Transfer events and ledger entries are append-only at the database layer. Commands require an `Idempotency-Key`; reusing it with a changed request hash returns `409`.

## API

All routes are below `/api/v1/inventory/transfers`, require a bearer token, and derive organization/location scope from that identity.

| Method/path | Operation |
|---|---|
| `POST /` | Create DRAFT transfer: `{ sourceLocationId, destinationLocationId, lines: [{ catalogItemId, quantity }] }` |
| `GET /:transferId` | Read transfer visible at either endpoint |
| `GET /:transferId/events` | Read its immutable events |
| `POST /:transferId/submit` | Submit a draft |
| `POST /:transferId/approve` | Independently approve a submitted request |
| `POST /:transferId/reject` | Independently reject a submitted request; a reason may be supplied |
| `POST /:transferId/dispatch` | Post source-side dispatch after approval |
| `POST /:transferId/receive` | Record every line: `{ lines: [{ transferLineId, receivedQuantity }] }` |
| `POST /:transferId/cancel` | Cancel only an unsubmitted or submitted request |

Submission/cancellation need requester (or organization administrator) authority over both endpoints. Dispatch is source-scoped; receipt is destination-scoped. Approval/rejection needs approval permission, destination scope and separation from the requester. Auditors have no mutation permission.

## Deliberate follow-up

Discrepancy investigation, disposition and any compensating adjustment are separate controlled workflows. They must not revise transfer lines or ledger entries. The production database transaction uses serializable isolation and row locks; production deployment should additionally apply a bounded retry policy for PostgreSQL serialization failures.
