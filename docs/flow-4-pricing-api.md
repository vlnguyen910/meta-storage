# Flow 4 — global pricing and deposit policy API

Implemented scope: global unit-type monthly prices and one shared deposit-month
policy, BOM configuration/audit API, and existing Booking draft integration.
Revenue/refund reporting is documented separately in [Reports API](flow-4-reports-api.md).
Configurable fees and fee waivers remain unconfirmed. No frontend, mobile, API
client or mock adapter is changed.

## Setup

Review and apply the generated migration to the intended development database:

```sh
bun run db:migrate
bun run db:seed
```

The explicit seed establishes the approved initial one-month deposit policy.
It never overwrites an existing policy, version or actor. Regular `db:seed` also
initializes it. No startup handler/quote silently inserts or assumes a policy.
Missing settings return HTTP 503 with the existing numeric error.code 503 and
a feature message (internal AppError reason: PRICING_NOT_CONFIGURED). Production credentials
must be selected explicitly; implementation verification used a separate local
test database, not the configured application database.

## API (BOM session required)

| Method/path | Input | Result |
|---|---|---|
| GET `/api/business-rules/pricing` | limit/offset, defaults 20/0, max limit 100 | shared version/depositMonths, ISO updatedAt, nullable updatedBy, paginated type prices |
| PATCH `/api/business-rules/pricing` | `{ "expectedVersion": 1, "depositMonths": 2 }` | `{ "version": 2 }` |
| PATCH `/api/business-rules/pricing/:unitTypeId` | `{ "expectedVersion": 2, "monthlyPrice": 900000 }` | `{ "version": 3 }` |
| GET `/api/business-rules/pricing/history` | limit/offset | changes descending by version: actor, timestamp, operation, before/after |

All use the existing success/error envelope. Guests receive 401; other roles,
including SA and FM, receive 403. Body fields are allowlisted; client cannot set
actor/time/version directly. Unknown type is 404, stale expectedVersion is 409,
invalid input is 400. Deposit months are positive integers; prices retain the
existing nonnegative integer VND representation and PostgreSQL integer bounds.
Quotes exceeding the existing NUMERIC(14,2) whole-VND limit return 422.

The version covers the entire pricing configuration, not a single type. Refresh
GET after a conflicting update; do not retry blindly with an incremented version.
Both configuration mutation and audit append commit or roll back together.
The API has no audit update/delete operation. The original
`unit_types.monthlyPrice` remains the only current price; no duplicate price table.

## Booking behavior

Existing `POST /api/bookings/drafts` reads current price and deposit policy in
one database statement. Rental fee = monthly price × requested months;
deposit = monthly price × stored depositMonths. Calculation uses integer
arithmetic and serializes the existing money strings. Currency remains VND.

Every draft retains its monetary snapshot, including a draft created before a
configuration change that starts payment afterwards. Pending payments, paid
bookings, cancellation/no-show and manual refund retain the existing lifecycle
and captured amounts. No booking/payment is repriced by configuration mutation.

## Validation

```sh
bun test --preload ./apps/api/tests/setup.ts ./apps/api/tests/integration/pricing.test.ts
# Use an empty migrated isolated DB, never the application DB:
# DATABASE_URL=<test-url> PRICING_TEST_DATABASE_URL=<same-test-url>
bun test --preload ./apps/api/tests/setup.ts ./apps/api/tests/integration/pricing-postgres.test.ts
```

The PostgreSQL suite requires empty pricing tables and cleans only its fixtures.
It covers real quote/draft persistence, immutable old snapshots, before/after
audit, stale concurrent writers, rollback and explicit idempotent initialization.
Booking regressions use BOOKING_TEST_DATABASE_URL matching DATABASE_URL.
