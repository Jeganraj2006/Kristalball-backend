# KAVACH Product Requirements Document

## 1. Purpose

KAVACH is a fictional enterprise platform for accountable management of organizational assets across multiple locations. It provides governed visibility of individually tracked assets and bulk inventory, records custody and maintenance, controls stock-affecting transactions through approvals, and preserves an auditable historical record.

The demonstration dataset must remain entirely fictional. It must not model actual military inventories, sensitive sites, people, or operational activity.

## 2. Product outcomes

1. Users can find what exists, where it is, who holds it, and its operational/lifecycle condition.
2. Authorized staff can receive, issue, transfer, allocate, return, expend, maintain, count, and adjust assets under policy controls.
3. Management can reconcile physical counts against reconstructed book balances and resolve discrepancies without rewriting history.
4. Administrators can enforce role and location scope centrally.
5. Auditors can trace every material business change to its actor, approval, source record, and immutable audit event.

## 3. Personas

| Persona | Goal |
|---|---|
| System administrator | Manages tenants, identities, roles, location hierarchy, catalog controls, and policy configuration. |
| Asset manager | Governs asset records, lifecycle changes, disposals, and custodial accountability. |
| Storekeeper | Receives and issues bulk stock, initiates transfers, performs counts, and manages local inventory. |
| Custodian | Views assigned assets and acknowledges/reports returns, losses, or condition changes within scope. |
| Approver | Reviews and approves/rejects controlled requests without self-approving. |
| Maintenance technician | Receives work orders, records labor/parts/condition, and returns assets to service. |
| Auditor | Read-only access to ledger, workflow, audit trail, and reconciliation evidence. |
| Executive viewer | Views authorized aggregate dashboards and reports only. |

## 4. Scope: release 1 demonstration

### In scope

- Organization, location hierarchy, users, roles, and scoped access.
- Asset catalog with serialized and bulk item definitions.
- Individual-asset registration, tagging, ownership, location, availability, custodian, condition, and lifecycle state.
- Bulk stock ledger, current balance projection, allocation tracking, stock transfers, receipt, issue/expenditure, approved adjustment, and balance reconstruction at a historical point.
- Request/approval workflow with segregation of duties and duplicate-submission protection.
- Maintenance work orders and asset maintenance history.
- Physical inventory counts, discrepancy calculation, approved reconciliation, and evidence attachments/notes.
- Immutable audit events, search, dashboards, exports, and test-ready fictional seed data.

### Explicitly out of scope for release 1

- Procurement, supplier invoicing, accounting depreciation, tax, payment, and general-ledger integration.
- Offline-first/mobile barcode scanning, RFID/IoT, GIS mapping, predictive maintenance, and automatic procurement.
- Inter-organization transfers, externally shared portals, and real-world sensitive data ingestion.
- Automatic disposal valuation and regulatory records retention rules until policy owners define them.

## 5. Core functional requirements

### Asset catalogue and classification

- Each catalog item has a unique SKU/code, type (`SERIALIZED` or `BULK`), unit of measure, controlled-category flag, and active status.
- The asset type is immutable once transactions exist. A catalog correction requires a successor item and migration workflow, not a silent type switch.
- Only serialized catalog items may create individual asset records; only bulk catalog items may create quantity ledger entries.

### Individual assets

- Track a unique asset tag and optionally serial number, both unique within organization under a defined normalization rule.
- Separately record legal/organizational owner, current physical location, availability, current custodian, condition, and lifecycle state.
- Lifecycle changes must be recorded through governed events, including commissioning, transfer, allocation/custody handover, return, maintenance hold, loss, and disposal.

### Bulk inventory

- Record all quantity movement in an append-only ledger with effective timestamp, posting timestamp, business transaction, location, direction, reason, and actor.
- Record `onHand`, `allocated`, and `available` as distinct balance projection values. `available = onHand - allocated`.
- `onHand` changes only via receipt, transfer in/out, expenditure, or approved adjustment. Allocation and deallocation do not change total organizational stock.
- Transfer-out and transfer-in are linked and traceable. In-transit handling is a required policy decision before build.

### Requests and approvals

- Requests must support draft, submitted, approved, rejected, cancelled, completed, and failed-posting states, with immutable decision history.
- The system must revalidate authorization, policy, and stock/asset state at approval and again at posting.
- The requestor cannot approve their own request. Approval requirements are configurable by item category, quantity/value threshold, transaction type, and source/destination location.
- A rejected or cancelled request must not mutate stock. Failed posting must be diagnosable and retry-safe.

### Maintenance

- Maintenance-capable serialized assets can enter `MAINTENANCE`; their availability becomes unavailable while physical location and custodian remain explicit.
- Work orders hold priority, description, provider/technician, scheduled and completed timestamps, condition before/after, cost (if later enabled), and evidence.
- Closing a work order requires a resulting condition and availability decision; it cannot backdate away prior custody/audit history.

### Stocktakes and reconciliation

- A stocktake specifies location, scope, count cutoff, count method, counters, and observed counts or scanned serialized assets.
- The book balance is reconstructed through the ledger as of the defined cutoff, not copied from a mutable balance field.
- Discrepancies are records with an investigation state. Only approved resolutions post compensating adjustment entries; discrepancies remain visible.

### Reporting

- Show balances, available quantity, allocations, assets by lifecycle/condition/location/custodian, pending approvals, maintenance backlog, stocktake variance, and full event history.
- Reports must apply server-side organization and location scope, include as-of timestamp where relevant, and disclose projection freshness.

## 6. Acceptance criteria

- A user outside a location scope receives no asset, balance, request, audit, attachment, or report data for that location.
- A posted bulk receipt/transfer/issue/adjustment is reconstructible from ledger entries and equals the projected balance.
- Allocation reduces available stock but not on-hand stock.
- Duplicate submission using the same idempotency key produces one business transaction and safely returns the prior result.
- A requester cannot approve their own request; approval and posting are auditable.
- A physical discrepancy remains an observation and is reconciled only with an approved compensating entry.
- Historic records and ledger entries cannot be silently altered through application APIs.

## 7. Assumptions and open decisions

| Topic | Proposed assumption | Decision required |
|---|---|---|
| Tenant model | One organization in the initial demo, with `organizationId` retained on all records. | Confirm single-tenant deployment versus true multi-tenant service. |
| Location hierarchy | Tree: region/site/store/room, with permissions inherited downward unless explicitly denied. | Confirm hierarchy and inheritance exceptions. |
| Units | Integer quantities in approved base units only in R1. | Define allowed units/conversions and whether fractional quantities are needed. |
| Transfer timing | A distinct `IN_TRANSIT` location/status prevents destination stock availability before receipt. | Confirm whether two-step receipt is required. |
| Approvals | Category/type/threshold rules with at least one approver; no self-approval. | Supply thresholds, delegations, quorum, escalation, and emergency policy. |
| Custody | Custody acknowledgement is required for serialized controlled items. | Define acknowledgment window and unresolved handover handling. |
| Attachments | Metadata stored in DB; encrypted object store holds files. | Select storage, malware scanning, types, size, retention, and legal hold policy. |
| Time and retention | UTC timestamps; records retained indefinitely in demo. | Define retention, purge, redaction, and audit export policy. |

## 8. Requirements that should not be accepted unchallenged

- “Immutable audit history” cannot mean no correction mechanism; corrections must be compensating, authorized, and linked to the original event.
- “Multi-location access” needs a formal hierarchy and delegation rules. A bare location ID in the UI is not authorization.
- “Approval-based transactions” needs explicit approval matrices, segregation rules, and what approval snapshot remains valid when stock changes.
- “Inventory reconciliation” needs a count cutoff and posting clock; otherwise a moving book balance creates false discrepancies.
- “Asset ownership” must distinguish owner from custodian and location. Treating them as one field destroys accountability.
