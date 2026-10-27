# Customer rental integration — #190

Web customer pages and the Expo customer workspace consume shared Booking/Rental DTOs and the centralized API client. `/customer/reservations/*` remains a compatible UI URL; it no longer represents a Reservation backend model.

## New read contracts

- `GET /api/facilities/:facilityId/availability?unitTypeId=&checkInDate=&checkInSlotId=&durationMonths=` is anonymous. It shares draft schedule/operating-hours validation and capacity calculation. The response contains `facilityId`, `unitTypeId`, `period.startsAt`, `period.endsAt`, `availableCount`, and `asOf`. Dates are ISO UTC. Zero means unavailable; missing input or a failed lookup remains unknown. This read creates neither drafts nor holds. Checkout still rechecks under its existing locks.
- `GET /api/bookings/mine/:id` adds nullable `rentalId` and `confirmation`. Confirmation is recovered from an owned successful payment on a CONFIRMED/CHECKED_IN booking. QR credentials never enter the list DTO. Staff endpoints retain their existing access restrictions.
- `GET /api/support/contexts?category=&limit=&cursor=` returns owned booking contexts suitable for creating that category. PAYMENT includes DRAFT/cancelled/failed-payment contexts. Physical categories require a matching open rental, completed handover and matching physical unit/facility. Create rechecks eligibility transactionally.
- `GET /api/support/contexts/:bookingId/payments?limit=&cursor=` returns owned direct/charge payment attempts, including FAILED/PENDING, with source and amount. It does not expose provider payloads or checkout credentials.
- Customer rental payment history includes `source`, `chargeId` and confirmed `chargeRefunds`, while preserving existing checkout refunds and `returnRefunds`. Attempts remain individual records; the UI does not aggregate them into collected revenue.

All private reads use the existing CUSTOMER/owner guard and error conventions. Context/message pagination uses opaque cursors. Booking/rental pagination keeps its existing cursor shape. No schema/migration is needed.

## Web behavior

- Dashboard shows recent bookings, appointments and current rentals, with no fabricated facility counts or account-wide money totals.
- Checkout name/email reflect the account used by the backend; only the supported contact phone is submitted. Pricing comes from the draft snapshot. Recovery is scoped to the authenticated account, and uncertain retries preserve command key/payload.
- Pending payment result pages remain interactive. Return URL status cannot confirm payment. The old reservation result URL and booking result URL use the same status/confirmation flow; rental charges have a separate result page.
- Rental detail includes renewal quote/terms/accept/pay/history and charge pay/dispute. Only APPLIED confirms a new rental term. Expired/refund-required responses remain visible. Existing return-storage screens are reused.
- `/customer/support`, `/customer/support/new`, and `/customer/support/:ticketId` provide owner-only conversations/private images. `/support` enters the guarded customer route. Reply/upload errors retain the pending input; 409 reloads version without silently retrying a new command.

## Expo API mode

Configure reachable device URLs, not the development machine's localhost:

```dotenv
EXPO_PUBLIC_API_MODE=api
EXPO_PUBLIC_API_BASE_URL=http://<development-machine-ip>:4000/api
EXPO_PUBLIC_WEB_BASE_URL=http://<development-machine-ip>:3000
```

Native requests forward the Better Auth Expo cookie through the shared client. Server cache is account-scoped and cleared when the customer session ends. Demo remains the separate non-API workspace; API failures never load demo records.

The existing `metastorage` scheme handles `metastorage://payment-result?paymentId=...` with optional booking/charge IDs. IDs are navigation hints, not credentials or proof of payment. Session restoration and foreground refresh read the backend again.

The Web `/payments/mobile-checkout` page POSTs the server-generated SePay form. Its fragment carries form fields without an account/access token; the page accepts only the installed provider's HTTPS checkout hosts/init path and clears the fragment after reading. Provider return pages offer an explicit **Mở ứng dụng** link.

Image selection uses Expo image-picker. Authenticated PDF/image bytes use file-system/sharing; private cache files are cleared on session teardown. Native return-storage entry opens the existing authenticated Web return flow instead of duplicating its workflow.

## Verification

From repository root:

```sh
bun run check-types
bun run --filter web test
bun run test:db:local
bun run test:customer:e2e
```

The local runners accept `LOCAL_TEST_POSTGRES_URL` targeting only the loopback `postgres` administration database. DB regression additionally needs an empty reserved Redis test database via `LOCAL_TEST_REDIS_URL`. They create/migrate/drop their own generated databases; they never migrate or seed the application database. Do not count skipped DB cases as verification.

The customer E2E runner defaults to Web 3100/API 4100. Override `PLAYWRIGHT_WEB_PORT` and `CUSTOMER_E2E_API_PORT` if occupied. It uses real routes, auth sessions and PostgreSQL. Only external object storage and provider lookup are substituted. Payment completion goes through the authenticated provider webhook with test timestamps/credentials. It runs desktop/mobile-width support screenshots, axe, renewal application/replay, checkout pending/refresh, charges/disputes, all categories, and cross-owner reads. Handed-over rentals are explicit test preconditions; existing DB handover regressions verify the transition itself.

`apps/web/e2e/customer-mobile-live.spec.ts` additionally accepts `CUSTOMER_E2E_FIXTURE` and `CUSTOMER_E2E_MOBILE_URL` for an exported API-mode Expo preview at 375×667, 390×844, 430×932, 768×1024 and 844×390. Export Android with the API-mode environment configured; a bundle or mobile browser preview does **not** establish Android device/deep-link/file-picker acceptance.

### Recorded verification, 2026-10-26

- Workspace type checks and production Web/API/worker builds passed.
- 122 Web tests passed; the 17 affected checkout tests also passed on the final checkout changes.
- All 28 isolated PostgreSQL regression suites and four seed regression cases passed without skips. The four customer-booking cases were rerun after removing the internal cursor field from the detail DTO.
- Ten real-API Web E2E cases passed with a browser in `America/Los_Angeles`, including facility-local appointment display, checkout refresh, renewal application, charge payment/dispute, all support categories and cross-owner ticket/image/PDF reads.
- Six Expo web E2E cases passed, including the five viewport/orientation configurations and draft → payment → confirmed booking recovery. API-mode Android export passed; iOS was exported but not device-tested.
- Post-test browser inspection verified quote validation/keyboard submission, zero rental-page axe violations, no mobile horizontal overflow and preservation of reply content/selected evidence after a rejected image upload. Support-page axe checks also passed in Web E2E.
- GitNexus index and diff analysis were run. The combined integration has CRITICAL impact; this is not a low-risk change. Full-text search remains unavailable in the local GitNexus runtime; named impact/diff analysis works.

## Remaining acceptance boundaries

- Real SePay transfer/return requires a controlled transaction completed through the configured merchant/banking environment. Fake-provider tests are not evidence of real settlement.
- Android emulator/device interaction, cold-start deep links and native file sharing/picker require an available device. Record iOS separately.
- #166 operations routes are not supplied here. Customer conversations work, but staff response/close/reopen E2E remains dependent on that handoff.
- Notice delivery evidence, RETURN_DEBT due dates, finance/legal validation and renewal exceptions #174 remain governed by existing policy TBDs. This integration introduces no new rules for them.
