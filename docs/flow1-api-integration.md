# Flow 1 API integration (#120)

Customer browse and checkout use the existing `/api/facilities`,
`/api/facilities/:facilityId/unit-types`, `/api/bookings/check-in-slots`,
`/api/bookings/drafts`, `/api/bookings/:bookingId/pay`, and payment status routes.

The original facility API returns array `data`, paged by `limit`/`offset`, without a
server pagination total or catalog aggregate fields. The shared client exposes that
existing shape through `facilities.listActive`; the Web retrieves the pages and derives
search, city filtering, name/price sorting and pagination locally in its feature hook.
Starting price is the minimum actual monthly price from the existing Unit Type API.
Unit Type queries are cached and reused by browse/detail/checkout. Facility details are
selected from the same list, rather than calling an unregistered detail endpoint.

The added backend `public-facilities.*` files and contracts, facility-detail and
availability endpoints, pagination extension and shared booking-schedule extraction have
been removed. The original booking service and catalog endpoint behavior are restored.
Frontend view models live only in the facilities feature, not in API contracts.

Period availability and physical-inventory totals are not exposed by the existing
browse endpoints. The Web does not invent counts or derive capacity from Unit Type rows.
It shows dimensions/prices and explains that capacity is checked when creating the draft
and starting payment. A dedicated availability API remains a backend dependency if that
acceptance criterion from #120 is required later.

The browser keeps contact only in form memory. Draft creation snapshots pricing but
does not hold capacity. Start-payment sends contact, draft access token, and an
idempotency key and starts the existing ten-minute hold. Network retries reuse the key.
Only the authorized server payment status can supply confirmation; redirect parameters
and the browser countdown cannot finalize payment.

Checkout credentials and the pricing/schedule snapshot are stored in `sessionStorage`
under `metastorage.booking-checkout`, scoped to the current tab. Contact is excluded.
The token is sent in `x-booking-access-token`, never in the URL or query cache key.
The gateway form posts in the same tab to preserve this credential for return/refresh.
Missing credentials require the original tab or a verified account owner session.
The new return route is `/bookings/payment-result`; the old route redirects only
`paymentId`, `bookingId`, and `status`. Web code has no sandbox finalizer client method.

Facility Manager gets active assignments from `/api/facilities/my-assignments`, then
uses existing facility-scoped booking/eligible-unit/assignment endpoints. A failed
assignment reloads booking and unit choices. Success returns to the dispatch dashboard.

## Repeatable verification

Use separate, migrated PostgreSQL databases for integration and browser tests. The
integration suite expects an otherwise empty database: seeded bookings can interfere
with its global no-show sweep assertions. Never point either suite at development data.

Required environment:

- `NODE_ENV=test`; matching `DATABASE_URL` and `BOOKING_TEST_DATABASE_URL`, with the
  database name ending in `test` for browser fixtures.
- A dedicated `REDIS_URL` for API/browser tests and isolated `REDIS_TEST_URL` for the
  existing integration queue tests. Keep Redis separate from development queues.
- `CORS_ORIGIN=http://127.0.0.1:3000`, `AUTH_TRUSTED_ORIGINS=http://127.0.0.1:3000`,
  and `BETTER_AUTH_URL=http://127.0.0.1:4000/api/auth`.
- Test-only `BETTER_AUTH_SECRET`, `QR_TOKEN_SECRET`, and `BOOKING_MAGIC_LINK_SECRET`
  of at least 32 characters; `WEB_URL` and `PUBLIC_APP_URL` at port 3000.
- `PAYMENT_PROVIDER=sepay`, `SEPAY_ENV=sandbox`, `SEPAY_MERCHANT_ID=flow1-test-merchant`
  and a test-only secret. The test entrypoint `apps/api/tests/fixtures/flow1-server.ts`
  stubs only the outbound SePay order API. Its provider control route exists only in
  that entrypoint, guarded by isolated DB/test configuration. Browser tests use no IPN
  or `confirm-sandbox`; payment persistence and booking transactions use real PostgreSQL.

From the repository root, with those environment variables exported:

```sh
bun run db:migrate
bun test apps/api/tests/integration/facilities.test.ts apps/api/tests/integration/booking-drafts.test.ts apps/api/tests/integration/booking-payment-start.test.ts
```

For the **separate browser database**, migrate it, then:

```sh
bun apps/api/tests/fixtures/flow1-web.ts
bun run --filter web test:e2e --config playwright.api.config.ts
```

The browser fixture creates its own facility, offerings, units, slot and manager.
Its email is `flow1-manager@example.test`; password is `Flow1-browser-test-123!`.
These credentials are only for the isolated test database. Fixtures can be rerun;
use a fresh browser database after repeatedly consuming its test inventory.
Playwright runs its isolated API fixture server at port 4000 and Web in API mode at
port 3000. Stop other servers on port 4000 first; the test API is never reused.

Coverage includes guest payment, same booking ID, provider-delayed return, refresh,
lost start-payment response/replay, last-capacity conflict, assignment conflict and
recovery, credential-free return URLs, validation, local countdown expiry, desktop/mobile
screenshots and axe. Database integration additionally verifies allocation/email-job
uniqueness, authorization, transactions, provider replay and actual hold expiration.
Unit/component tests remain under Vitest; `e2e-api` is excluded from its discovery.

## External sandbox acceptance

Automated provider responses prove application behavior, not actual SePay payment.
A separate real sandbox run requires valid merchant credentials and outbound access
to the SePay order API; no IPN, domain or inbound callback is required. Use the normal
API entrypoint for that run, never the E2E fixture server. A real email send
also needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, an authorized test recipient, and the
worker using the same Redis database and mail encryption secret as the API.

Do not mark external sandbox/email acceptance complete on the strength of an enqueued
job or a browser `status=success` redirect. Preserve the provider event, same Booking ID,
allocation, QR and worker delivery evidence from that run.

Legacy Reservation client methods remain because Mobile and non-Flow-1 consumers still
reference them. The Web Flow 1 path does not use them. OTP tracking, My Storage, staff
assignment, check-in and final schema cleanup from #113 are outside this integration.

## Backend changes retained

- `GET /api/facilities/my-assignments`: absent from the original route registrations;
  reuses the existing assignment service/repository and authenticated current user.
- Eligible-unit responses include `floor` and `locationDescription`, both already
  declared in the original database schema and optional shared DTO fields.
- Earlier requested local demo seed and login-credential changes are retained.

No schema or migration changes are needed for this cleanup. Existing Flow 1 checkout,
guest token, payment polling, confirmation and assignment changes remain in place.
Previous test totals describe the earlier implementation and are not acceptance evidence
for this revision. Type checks and static checks are used for the cleanup; automated
suites are not rerun under the user's preference to skip test steps.
