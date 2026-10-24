# Facility Manager rental monitoring and charge review

All new reads require an ACTIVE `FACILITY_MANAGER` session and active, unexpired
assignment at the requested facility. Other roles receive 403; unauthenticated
requests receive 401. JSON uses the existing `{success, data, timestamp}` envelope
and `Cache-Control: private, no-store`.

| GET endpoint | Query / response |
| --- | --- |
| `/api/facilities/:facilityId/rentals` | `status`, `unitTypeId`, `limit`, `offset`; returns `{items,total,limit,offset}` |
| `/api/facilities/:facilityId/rentals/:rentalId` | One rental with booking contact, physical unit, current term, initial-payment facts and current issued-contract metadata |
| `/api/facilities/:facilityId/rentals/:rentalId/payments` | `limit`, `offset`; paginated booking and charge payment attempts with confirmed return/charge refund records |
| `/api/facilities/:facilityId/rentals/:rentalId/renewals` | `limit`, `offset`; paginated renewal quote/acceptance/application history |
| `/api/facilities/:facilityId/rental-charges` | `status`, `source`, `rentalId`, `limit`, `offset`; paginated charge review records with customer/unit/rental context |
| `/api/rental-charges/:chargeId` | Charge review record plus events, adjustments and refund history |

Pagination defaults to `limit=20&offset=0`; limit is 1–100 and offset is nonnegative.
Invalid UUIDs, pagination, enum values or unsupported filters return 400.
Rental status supports ACTIVE, RETURN_PENDING, OVERDUE and CLOSED. Unfiltered
lists include all statuses; `status=PENDING_APPROVAL` selects charges awaiting FM
approval, and `status=DISPUTED` selects disputes. Charge sources are EXTRA,
RETURN_DEBT and RENEWAL.

Rental lists sort by current expiry then ID; histories and charge queues sort by
creation time descending then ID. Filtering precedes pagination; total and page
use one read-only repeatable snapshot. An out-of-scope facility returns 403; a
rental not belonging to an authorized facility returns 404. A charge at another
facility returns 403. Guest contacts come from the booking and have nullable
`customer.userId`; equal email addresses never grant account ownership.

`expectedEndAt` and `version` are current rental facts. Booking and issued contract
snapshots remain unchanged after renewal. `initialPayment` selects the most recent
captured booking payment, or the latest attempt when none was captured; its status
is explicit and must not be inferred from `paidAt`. `currentIssuedContract` is the
latest ISSUED version; a later upload alone does not replace it. Use the existing
`GET /api/rentals/:rentalId/contracts` and authenticated PDF endpoint for versions
and bytes. No storage object keys, session/checkout tokens or provider secrets are
included in these DTOs.

Payment history identifies BOOKING versus EXTRA/RETURN_DEBT/RENEWAL and preserves
each attempt's actual status, currency and amount. Cancellation refund fields are
separate from confirmed return/charge transfers; do not count them twice.
Charge `capturedAmount` includes captured attempts, while `paidAmount` identifies
applied receipts, excluding late/duplicate captures only owed a refund.
`adjustedAmount` includes signed adjustments; `refundedAmount` includes confirmed
charge transfers. `outstandingAmount` is adjusted amount minus applied receipts,
floored at zero (VOID is zero). Pending approval and disputed statuses remain
explicit; the read API does not approve or collect money.

Existing POST `/api/rental-charges/:chargeId/decision` and
`/api/rental-charges/:chargeId/dispute/resolve` retain their current authorization,
evidence and self-approval rules. This work grants no new price/fee override,
routine-renewal approval, refund confirmation or Customer permissions.

## Verification

55 curl response checks passed using the real Fastify/auth routes and a disposable
PostgreSQL database. Cases cover guest/current rental detail, current expiry after
renewal, issued-versus-uploaded contracts, every payment source, refund history,
adjustment totals, late/duplicate captures, pagination/filtering, empty/missing
records, wrong-role/foreign-facility/expired/revoked assignment access, validation,
private response headers and queue-to-approval behavior. The temporary server,
fixtures and database were removed.

The read-API increment adds no tables. Task 5 schema and write APIs are documented below.

## Facility-owned catalog and BOM price ranges

Task 5 is implemented with `rental_price_ranges` and facility-owned `unit_types`.
No `unit_type_changes` table or new fee-policy engine is introduced.

| Endpoint | Permission and behavior |
| --- | --- |
| `GET /api/business-rules/rental-price-ranges` | BOM/FM; `limit`, `offset`; returns ranges including configuration, active flag, version and actor/timestamps |
| `POST /api/business-rules/rental-price-ranges` | BOM; `code`, `name`, positive integer-VND `minMonthlyPrice`, `maxMonthlyPrice`; returns 201 |
| `PATCH /api/business-rules/rental-price-ranges/:priceRangeId` | BOM; `expectedVersion`, both bounds, optional `name`, `isActive`; rejects bounds excluding any linked local price |
| `GET /api/unit-types` | BOM/Admin global read, FM assigned-facility read; optional `facilityId`, `isActive`, `limit`, `offset` |
| `POST /api/unit-types` | Assigned FM; `facilityId`, `priceRangeId`, `code`, `name`, `sizeLabel`, meter dimensions and `monthlyPrice`; returns 201 |
| `PATCH /api/unit-types/:id` | Assigned FM; `expectedVersion` plus editable local metadata, dimensions, range, price or active flag |
| `GET /api/facilities/:facilityId/unit-types/management` | BOM/Admin or assigned FM; returns local type DTOs |
| `PATCH /api/facilities/:facilityId/unit-types/:unitTypeId` | Assigned FM; `expectedVersion`, `isActive` |
| `PATCH /api/business-rules/pricing/:unitTypeId` | Assigned FM; `expectedVersion`, `monthlyPrice`; returns the local type version |

Local type DTOs include `facilityId`, `priceRangeId`, `version`, `updatedBy` in
addition to the existing catalog fields. Version starts at zero; stale writes
return 409. Prices must be within an active configured range, inclusive of both
bounds. Code uniqueness is per facility. The deposit policy and global audit
history remain BOM-owned. Local type versions differ from the shared pricing
audit revision; clients must use the version of the object being edited.

Dimensions cannot change after a booking or reservation draft references the type
(409); create another type instead. Price changes apply to future quotes. Existing
booking payments and accepted renewal quotes retain their saved amounts.
Physical unit creation, location updates and lifecycle transitions retain their
existing endpoints and state rules.

Migration must run through `bun run db:migrate`, which performs the data transfer
and generated DDL in one transaction. It retains the original type UUID for the
first facility and clones types for other facilities, remapping bookings, drafts,
physical units and capacity allocations. Legacy orphan or nonpositive-price types
must be resolved explicitly before migration. Existing monetary/audit/PDF snapshots
are preserved. Migrated/seeded ranges have null bounds until BOM configures them;
new sale/renewal quotes for those ranges are unavailable during that interval.

Frontend, mobile and API-client integration are outside this delivery. Existing
management callers must adopt the FM write role, local versions, required ownership
fields and the new local management response shape.

Task 5 verification: 74 curl checks with real login/session and PostgreSQL passed;
checks include range boundaries, version conflicts, cross-facility access, guest
rental reads and pending/disputed charge queues. Populated migration checks passed
for rollback, idempotency, four reference remaps and unchanged monetary snapshots.

Final focused verification: 197 existing PostgreSQL integration cases passed across
pricing, FM management, settings, returns, renewals, checkout, reports, booking
drafts, rental reads, customer bookings and rental charges; two optional Redis/mail
end-to-end cases were skipped. API/contracts/database type checks, focused Biome
and diff checks passed. Seed ran successfully on a disposable database.

GitNexus was reindexed and change analysis rerun with a larger result limit. It
rates the tracked change critical because it reaches checkout, renewal and
financial workflows. Structured graph checks were also run for every staged commit group without
partial or truncated results. The process index remains bounded, so this is not
evidence that every caller is covered. The workflows above were checked directly.
No production migration, frontend/browser verification, full monorepo suite or
push was performed.
