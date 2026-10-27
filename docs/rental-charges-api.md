# Rental charges API (MVP backend)

This API records source-specific charges separately from payment attempts. All money is integer VND; the server supplies the amount for payment. Initial booking checkout remains unchanged. See [customer financial policy](./customer-financial-policy.md) and [database diagram](./db-diagram.md).

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `GET /api/rentals/:rentalId/charges` | Customer owner | List charges for the customer's rental with adjusted, paid, refunded, and outstanding amounts. |
| `POST /api/rentals/:rentalId/charges` | Assigned facility staff | Submit an extra charge with approved category, evidence, VND amount, and due date. |
| `POST /api/rental-charges/:chargeId/decision` | Assigned facility manager | Approve or reject a pending charge using `decision: "APPROVE" | "REJECT"`; creator cannot decide their own charge. |
| `POST /api/rental-charges/:chargeId/dispute` | Customer owner | Dispute an open charge within seven days of notice. |
| `POST /api/rental-charges/:chargeId/dispute/resolve` | Assigned facility manager | Uphold, reduce, or waive a disputed charge with a reason. |
| `POST /api/rental-charges/:chargeId/adjustments` | Business operations manager | Increase or reduce an unpaid open charge with audit reason. |
| `POST /api/rental-charges/:chargeId/payments` | Customer owner | Start a full amount SePay checkout; quote expires after 15 minutes. |
| `GET /api/rental-charge-refunds` | System admin / business operations manager | List source-linked manual refunds. |
| `POST /api/rental-charge-refunds/:refundId/confirm` | System admin / business operations manager | Confirm the manual transfer with its reference. |

Charge payment callbacks and reconciliation use the `rentalChargeId` source branch. They do not create or modify bookings, capacity, QR codes, handover, or rental lifecycle. Provider-confirmed `paidAt` must be before the quote expiry; late or inapplicable captures become refund due. Provider retries and webhook replays are idempotent.

Return settlement debt is created as a typed `RETURN_DEBT` obligation and linked to its settlement revision. Corrections append adjustments while unpaid; after collection, reductions create manual refund records and increases create a separate obligation. No customer wallet/credit is created.

## Remaining policy decisions

- Whether unpaid return debt blocks renewal belongs to issue #163 and remains TBD.
- Refund operator/SLA and Finance accounting labels still need operational validation.
- The seven-day dispute period currently uses the charge creation time; customer notification delivery/evidence is not yet implemented, so this clock needs a confirmed notice channel before production use.
- Return debt has no due date until the business policy defines one; extra charges require the due date supplied by facility staff.
- Legal validation of customer notice/acceptance evidence and the deployed role scopes remains open.

This is a backend contract. Web and Mobile screens are not included in issue #162.
