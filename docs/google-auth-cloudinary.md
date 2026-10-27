# Google OAuth and private Cloudinary storage

## Backend configuration

Set server-only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` together. Leaving both
blank disables Google while email/password remains available. Partial Google
credentials fail startup validation; no secret values are logged.
Register `${BETTER_AUTH_URL}/callback/google` in Google Console, e.g.
`http://localhost:8080/api/auth/callback/google` with the example API environment.
Configure the Web origin in `AUTH_TRUSTED_ORIGINS` and `CORS_ORIGIN`. Production uses
HTTPS and secure cookies. Google consent-screen test users must be authorized by
the operator. No Google Console resources are provisioned by the application.

## Login and explicit linking

POST `/api/auth/sign-in/social` with JSON:

```json
{
  "provider": "google",
  "callbackURL": "http://localhost:3000/login/complete",
  "errorCallbackURL": "http://localhost:3000/login",
  "disableRedirect": true
}
```

The Better Auth response contains `url` and `redirect`. Preserve cookies and navigate
to `url`; GET `/api/auth/callback/google` completes the exchange. The callback target
is implemented on the Web frontend at `/login/complete`. On success it reads
the authenticated session via `/api/auth/me`, synchronizes the auth store, and navigates
to the destination.

The Web frontend integrates Google authentication and account linking:
- Login page (`/login`) & Register page (`/register`): "Tiếp tục với Google" initiates `signInSocial`.
- Callback completion route (`/login/complete`): Validates session with `/me`, updates store, and redirects to role home or `returnTo`.
- Unlinked account handling: When backend redirects with `error=account_not_linked`, `/login` shows clear guidance to log in with password, and upon successful password login offers an immediate modal to link Google.
- Logged-in explicit linking: Initiated from `/login` after password login or via sidebar button in `AppShell` with `linkSocial`, redirecting to `/login/complete?action=link`.

New verified Google emails create CUSTOMER/ACTIVE users. Existing emails without a
Google account redirect to the error callback with `error=account_not_linked`: show
instructions to log in using the existing method and explicitly link Google.
After password login, POST `/api/auth/link-social` with the same body/cookies, then
navigate to its returned URL. Both initiation and callback require a live ACTIVE
session; the Google email must match. Role/status/profile and user ID are preserved.
Already linked identities use the existing account. Guest bookings are never claimed
by matching email. Direct ID-token sign-in/linking is disabled; use this code flow.

Callback failures include `google_email_unverified`, `account_disabled`,
`link_session_required`, `email_does_not_match`, `access_denied`, and invalid/expired
state errors. Use the error parameter rather than assuming a successful redirect.
Initiation can return 401 (no session), 403 (inactive/untrusted callback), or provider
not found when Google is disabled. A concurrent provider-account claim returns a
controlled 409; retry login/linking after the winning request completes.

Migration `0045_lame_gateway.sql` adds unique `(provider_id, account_id)`. Check for
duplicates before migration; resolve them explicitly, never merge users automatically.
Normal `bun run db:migrate` applies the generated constraint. Better Auth's database
adapter translates only that known duplicate constraint without logging token-bearing
insert errors. Auth origin/CSRF checks remain enabled, including in test mode.

## Shared Cloudinary storage

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` together.
These are used for all supported image/file uploads and reads; no public upload
endpoint or arbitrary file-type support is introduced. All three values are required
at server startup; missing/blank configuration aborts startup, with no S3 fallback.
Provider failures after startup still produce domain-specific 503 responses.

## Required startup configuration

API configuration is validated before application imports initialize clients or
start the scheduler. Missing/invalid values print variable names and safe messages,
then exit with code 1. This checks configuration, not remote credentials or provider
availability. PostgreSQL and Redis connection checks remain in their existing plugins.

Required in every environment, including test fixtures:

- `DATABASE_URL` (postgres/postgresql), `REDIS_URL` (redis/rediss); the API entrypoint
  no longer supplies local fallback URLs. An explicit development `DOCKER_DATABASE_URL`
  can still override `DATABASE_URL`.
- `BETTER_AUTH_SECRET`, `BOOKING_MAGIC_LINK_SECRET`, `QR_TOKEN_SECRET`: at least 32
  characters. Booking/QR secrets must match the worker's values.
- `BETTER_AUTH_URL`, `WEB_URL`, `PUBLIC_APP_URL`: absolute HTTP(S) URLs.
- `CORS_ORIGIN`: explicit HTTP(S) origins; `AUTH_TRUSTED_ORIGINS`: explicit valid Web
  or native-app origins. Comma-separated lists cannot contain blanks or wildcards.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`: nonblank key and valid sender email (plain
  address or `Name <address>`), since signup requires verified email.
- All three Cloudinary credentials above.

When `PAYMENT_PROVIDER=sepay`, both `SEPAY_MERCHANT_ID` and `SEPAY_SECRET_KEY` are required.
Legacy bank/webhook credentials cannot enable SePay. `PAYMENT_PROVIDER=mock` does not
require SePay credentials. `SEPAY_BANK_*` remain optional display metadata for the
existing `transferInstructions` response; they do not configure checkout/authentication.
Google remains optional as described above. `PORT` must be an integer from 1 to 65535;
`SEPAY_ENV` selects `sandbox` or `production`. `SEPAY_TEST_MODE`, `PUBLIC_API_URL`, and
`SEPAY_WEBHOOK_API_KEY` are no longer consumed and can be removed from deployment
configuration. No environment secret is automatically generated or written to `.env`.

`common/adapters/storage/cloudinary.adapter.ts` owns SDK calls, authenticated delivery,
immutable uploads, bounded downloads, and idempotent deletion. The photo adapter
preserves the existing domain interface and error contract. Resource type is explicit;
deletion must use the same type as upload. Old photo module imports re-export the moved
boundary for compatibility.

- Evidence remains authenticated images under existing paths. Read endpoints generate
  five-minute private download URLs. Existing Base64 evidence remains readable.
- Domain services decide whether deletion is allowed. A failed or unacknowledged upload
  is retained for reconciliation; only confirmed uploads known not to be referenced are
  eligible for rollback cleanup. Uploads with
  `overwrite:false` returning an existing resource are rejected without deletion.

Cloudinary account settings/limits are an operator prerequisite. Validate original bytes
and unauthenticated denial in a test environment before production cutover.
References: [upload parameters](https://cloudinary.com/documentation/upload_parameters),
[Google provider](https://better-auth.com/docs/authentication/google),
[explicit account linking](https://better-auth.com/docs/concepts/users-accounts).

## Existing data and verification

Read-only local inventory on 2026-10-21 found zero duplicate provider/account keys.
The generated unique index was applied locally. This does not establish production inventory.

Per the user's override, integration tests use the current local database on port
5433/metastorage, explicit `MY_STORAGE_LOCAL_DATABASE_URL=DATABASE_URL`, `NODE_ENV=test`
and fixture IDs. Inspections tests register only necessary routes (no global scheduler)
and clean their own fixture. Never reset/reseed/truncate this database or flush Redis.
Test env file for this session: `/tmp/metastorage-google-cloudinary-test.env` (test-only
credentials). Execute database suites in separate processes:

```sh
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/google-auth.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/cloudinary-storage.test.ts apps/api/tests/integration/provider-config.test.ts apps/api/tests/units/inspections.cloudinary.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/inspections.integration.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/handover.integration.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/returns.integration.test.ts
bun run --filter api check-types
bun run --filter @metastorage/database check-types
```

OAuth tests mock only Google provider exchange/profile methods, with real routes,
state/cookies and PostgreSQL accounts/sessions. Storage boundary tests mock SDK/fetch;
business integration suites inject storage. Neither proves live provider acceptance.

Verification recorded on 2026-10-21 covered Google, configuration, storage, inspections,
handover and returns.
API/database typechecks and API lint passed; scoped Biome checked all 27 changed
TypeScript files. Three existing Chromium tests passed for Cloudinary image display,
retry after delivery failure and cancelling evidence deletion; screenshots were
inspected. They use mocked responses, not live Cloudinary.
Database checksums after fixture cleanup matched all business tables, users, accounts
and sessions; one expired temporary verification was automatically removed by Better
Auth during the later OAuth tests. No business data was reset or reseeded.

Browser command (Node is needed because the Bun CLI runner hit a test parser error):

```sh
node apps/web/node_modules/@playwright/test/cli.js test --config apps/web/flow2.playwright.config.ts flow2-ui.spec.ts --grep 'Cloudinary|cancelling evidence deletion'
```

GitNexus structured change analysis completed without partial/truncated results and
reported HIGH risk around shared authentication flows; those flows received the focused
regression tests above. Newly added files were reviewed directly as well. GitHub issue
searches for Google and Cloudinary returned no matches. No live provider credentials
were available; real OAuth consent and Cloudinary delivery acceptance are still required
before production use. No commit, push or deployment was performed.
