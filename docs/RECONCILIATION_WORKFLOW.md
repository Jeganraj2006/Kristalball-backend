# Physical reconciliation

Each count session snapshots expected on-hand quantities when created. Count observations retain their original expected and actual values; an uncounted line is `null`, while zero is an explicit count. Variance is `actual - expected`; reconciliation rate is matching counted records divided by total counted records.

Counts move from draft/counting to submitted without affecting inventory. An independent, location-scoped approver reviews discrepancies. Only `POST` after approval appends `RECONCILIATION_ADJUSTMENT` ledger entries and updates the balance projection in one transaction. The counter cannot approve or post their own restricted adjustment.

API: `POST /api/v1/reconciliations`, `POST /:id/counts`, `POST /:id/submit`, `POST /:id/approve`, `POST /:id/reject`, `POST /:id/post`, `GET /:id`, and `GET /:id/report`. Mutations require `Idempotency-Key`.
