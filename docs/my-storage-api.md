# My Storage — read APIs

These rental read APIs are implemented alongside the return APIs documented in
[returns-api.md](returns-api.md). Contract issuance/access and handover gate are documented in [rental-contracts-api.md](rental-contracts-api.md).
Automated overdue lifecycle and durable notification workflows are documented in
[returns-api.md](returns-api.md).
The read endpoints themselves need no schema migration.

All routes require an ACTIVE authenticated CUSTOMER. Rental ownership is derived
from `bookings.user_id`, never contact email. Guest bookings are not automatically
claimed by a matching account. Responses use the existing success/error envelopes.

| Method/path | Response `data` |
| --- | --- |
| `GET /api/rentals/mine` | `{ items, nextCursor }`; defaults to current view, ACTIVE/RETURN_PENDING/OVERDUE, nearest expiry then UUID ascending |
| `GET /api/rentals/mine?view=history` | Same paginated DTO, CLOSED only |
| `GET /api/rentals/:rentalId` | Existing rental detail; owners may also read their CLOSED rental |
| `GET /api/rentals/:rentalId/payments` | Checkout payment history linked through the rental's booking, oldest creation time then UUID; empty array if no payments |

Only actual rental rows appear in lists: payment/booking confirmation does not create
a rental. Handover does. `/mine/page` and `/history` have been removed; there is one
list route. `/mine` changes from an array to `{ items, nextCursor }`. API client/Web/
Mobile are outside this backend change; existing array consumers need migration.
The shared API client currently types `rentals.mine()` as an array, and Web's list
and mock still consume that shape. They must read `data.items`, supply the selected
view, and implement Load More before using this new contract. No working UI
integration or browser verification is claimed by this backend-only change.

## Pagination

Query: `view` (`current` or `history`, default `current`), `limit` (integer 1–100,
default 20), optional `afterEndAt` (ISO date-time with
timezone), optional `afterId` (UUID). Both cursor fields must be supplied together.

Example `nextCursor` value (null when no further page exists):

```json
{
  "afterEndAt": "2032-02-01T03:00:00.123456Z",
  "afterId": "12000000-0000-4000-8000-000000000001"
}
```
Send the returned cursor values unchanged as the next request's query parameters.
Keep `view` unchanged while loading more; reset both cursor fields when switching
views. Example: `/api/rentals/mine?view=history&limit=20&afterEndAt=...&afterId=...`.
Dates in item DTOs retain the existing millisecond ISO representation; the cursor
preserves PostgreSQL microseconds to avoid repeats. The UUID breaks equal-expiry ties.
Each query rechecks ownership/status and does not need the cursor row to still exist.
This is keyset pagination over live data, not a frozen snapshot across requests;
expiry/status changes between requests can change membership/order.

## Payment history

Each item exposes only `id`, `paymentCode`, `provider`, `status`, `totalAmount`,
`currency`, `paidAt`, `refundAmount`, `refundReason`, `refundedAt`, `createdAt`.
Money is serialized as stored decimal strings without floating-point conversion;
dates are ISO strings or null. PENDING/FAILED are retained as historical facts,
not counted as collected funds. This endpoint does not call SePay or mark payments
successful. Credentials, provider payment IDs and idempotency keys are not returned.
The successful response carries `Cache-Control: private, no-store`.

Legacy refund fields retain the payment row's meaning and are not overwritten.
Each payment also includes `returnRefunds` for independent confirmed return refunds
with settlement references; full settlement revisions are in return-request detail.
Null fields are not fabricated into a successful refund.

## Errors

- 400: invalid UUID, limit, timestamp, or incomplete cursor pair.
- 401: missing authentication.
- 403: wrong role or inactive account.
- 404: rental missing or not owned, including payment history requests. The API
  does not disclose whether another customer's rental exists.

## Refund integration audit

The current adapter (`apps/api/src/modules/payments/sepay.gateway.ts`) uses SePay
Payment Gateway checkout and order lookup; it has no refund-create/status methods.
Existing refunds are manual confirmations on the payment record.

SePay publishes separate [API v2 refund endpoints](https://developer.sepay.vn/vi/sepay-api/v2/hoan-tien/hoan-tien-giao-dich)
and [refund status listing](https://developer.sepay.vn/vi/sepay-api/v2/hoan-tien/danh-sach).
These use a different API/auth model and have bank/account eligibility requirements;
their existence does not establish that the currently integrated PG merchant can
use them. Until merchant capability/linkage is verified, the confirmed manual
fallback requires actor, reference and evidence; submission alone is not success.
The existing refund routes remain unchanged. The new return module grants only
facility FM the confirmed manual return-settlement/refund actions.

## Verification

The new suite uses the existing local Compose PostgreSQL database, creates UUID
fixtures and removes only its own data. No database/Redis container is created,
no broad seed/reset is run, and cron/mail workers are not registered by the fixture.

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/metastorage MY_STORAGE_LOCAL_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/metastorage bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rentals-read.test.ts
```

Tests cover active/history ownership, equal-expiry microsecond cursors, nearest
expiry ordering, malformed pagination, role guards, guest exclusion and payment
privacy. Existing booking regression additionally requires the pricing schema and
unambiguous checkout slots; it is not replaced by the rental-read suite.

Observed results on 2026-10-20:

- Rental-read integration: 5 passed, 0 failed, 67 assertions on existing local DB.
- Contracts tests: 12 passed. API/contracts/database typecheck and lint passed;
  Biome also passed on the new integration test and affected TS files.
- Existing `booking-identity.test.ts`: 2 passed, 6 failed. Local DB has no
  `pricing_settings` relation (verified by read-only query); draft creation returns
  500. Legacy checkout test also reports CHECK_IN_SLOT_CHANGED, with its fixture
  slot overlapping the existing seeded schedule. No shared schedule/configuration
  was changed to make these tests pass.
- `git diff --check` passed; fixture facility count was zero after cleanup.
- GitNexus detect-changes reports medium risk for 15 symbols/4 rental flows. Index
  generation warns of process/callee truncation, so this is a limited graph review,
  not proof that all possible callers are covered.

No UI verification, full monorepo test/build or deployment was performed. New return
migrations and their local application are documented in `returns-api.md`.

## Unified list verification (current implementation)

`GET /api/rentals/mine?view=current|history` now always paginates. Defaults are
current/20; invalid views and malformed/incomplete cursors return 400. Ownership,
status groups and microsecond expiry/UUID keyset ordering remain unchanged.

The updated rental-read integration suite passes 6 tests / 78 assertions on the
existing local PostgreSQL container, including default 20-item pagination across
25 current rentals, history pagination, ownership/role guards and invalid filters.
No schema migration, database reset, global scheduler or frontend changes required.
