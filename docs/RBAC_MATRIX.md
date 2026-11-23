# KAVACH RBAC and Location Access Matrix

## 1. Enforcement model

Permissions authorize an action; location grants constrain where the action applies; object-state rules constrain when it applies. The backend evaluates all three. UI navigation must not be treated as security.

Legend: `M` manage, `C` create/submit, `A` approve/post where policy allows, `V` scoped view, `O` own assigned records only, `—` no access.

| Capability | System admin | Asset manager | Storekeeper | Custodian | Approver | Maintenance tech | Auditor | Executive viewer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Users, roles, grants | M | — | — | — | — | — | V (audit scope) | — |
| Location hierarchy/catalog | M | M | V | V | V | V | V | V aggregate |
| Serialized asset register | M | M | V/C in scope | O/V | V for decision | V assigned | V | V aggregate |
| Custody handover request | M | C/A | C in scope | C/O acknowledge | A | — | V | — |
| Bulk receipt/issue/transfer request | M | C/A | C in scope | — | A | — | V | V aggregate |
| Bulk allocation/deallocation | M | C/A | C in scope | O view | A | — | V | V aggregate |
| Adjustment/expenditure | M | C | C if granted | — | A (separate actor) | — | V | V aggregate |
| Approval inbox/decision | M (exception only) | A if granted | A if granted | — | A | — | V history | — |
| Maintenance work orders | M | M | C/report | O report | V | M assigned scope | V | V aggregate |
| Stocktake/count observations | M | M/A | C/M in scope | — | A resolution | — | V | V aggregate |
| Ledger/audit history | V | V scope | V local | O only where justified | V decision scope | V assigned | V | V aggregate only |
| Sensitive exports | M | M if granted | — | — | — | — | V if granted | V aggregate only if granted |

## 2. Role constraints

- No role has implicit global access merely because it can approve. Every role still needs an organization and location grant.
- Requester and final approver must be distinct users. The system rejects self-approval even if the user holds both roles.
- The same person should not both count and approve their own discrepancy adjustment. Enforce this as a policy constraint for controlled categories.
- System administrator should not be an ordinary approver. Emergency override must be separate, break-glass, time-bounded, reasoned, and audited.
- Maintenance technicians access only assigned work orders/assets and cannot alter ownership, financial policy, or historical ledger records.
- Auditor is read-only and cannot view outside explicit location scope; audit entitlement is not a blanket privacy exception.

## 3. Location-scope rules

1. A grant is `(user, location, action scope, descendant inheritance, validity window)`.
2. The API expands inherited locations server-side using the validated location tree, then intersects it with each resource’s organization and relevant location.
3. Transfers require source-location authority to request/dispatch and destination authority to receive/accept, according to workflow stage.
4. Reports and search must filter the same way as detail endpoints. Aggregates that could reveal restricted location data are rounded/withheld or denied by policy.
5. Asset custody does not itself authorize access to all records at the asset’s location; it grants only the explicitly listed own-asset operations.

## 4. Permission vocabulary

Implement fine-grained permissions such as `asset.read`, `asset.create`, `asset.lifecycle.request`, `inventory.balance.read`, `inventory.transaction.create`, `inventory.transaction.approve`, `inventory.adjustment.request`, `stocktake.count`, `stocktake.resolve`, `maintenance.work_order.manage`, `audit.read`, `export.create`, `role.manage`, and `location.grant.manage`. Business rules layer on top of these permission strings rather than encoding all policy inside a role name.
