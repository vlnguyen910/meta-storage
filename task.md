# Plan: Google login and shared Cloudinary storage

Planning only. Scope: backend; Google linking option 1; Cloudinary for all new
image/file uploads supported by existing domains. No implementation changed.

Implementation notes (2026-10-21; supersede planning assumptions below):
- Follow-up user request makes core API configuration mandatory at startup, including
  all Cloudinary credentials, mail, booking/QR secrets and application URLs. Google
  remains optional; SePay configuration is conditional. See startup configuration
  in `docs/google-auth-cloudinary.md`; test fixtures require dummy complete values.
- User explicitly requested the existing local PostgreSQL database instead of a new
  isolated DB. Existing opt-in guards remain; fixtures are scoped and cleaned. The
  inspections suite was made scheduler-free and now calls fixture cleanup.
- Local read-only inventory found zero contract references and zero duplicate account
  keys. Production inventory and live Google/Cloudinary acceptance remain external gates.
- Concurrent-link testing required a unique `(provider_id, account_id)` constraint;
  diagram/schema updated together and migration 0045 generated via `bun run db:generate`.
- GuestRentalAccessService was an additional S3 consumer; it also uses Cloudinary now.
- Detailed setup, verification commands and cutover limits: `docs/google-auth-cloudinary.md`.

## 1. Current behavior and root cause

- Better Auth is configured for verified email/password only. `authRoutes` forwards
  `/api/auth/*` to Better Auth, but no Google provider/credentials/linking policy is
  configured. `requireAuth` checks ACTIVE users; the forwarded auth endpoints need
  their own lifecycle/session checks. Web has an unconnected Google button.
- `CloudinaryPhotoStorage` lives inside inspections but is also used by returns.
  It uploads authenticated images, returns five-minute private download URLs, and
  removes assets. Credentials are read directly from `process.env`. Its interface,
  identifiers and errors are inspection-specific: reuse across domains is awkward.
- Contracts use `S3ContractStorage` through `ContractStorage.put/get/remove`.
  PDFs are immutable versions; download/issue/handover validate bytes and SHA-256.
  Authorized downloads are proxied by the API. `objectKey` already identifies files.
- Root cause: missing OAuth configuration/policy and storage integrations scoped
  to individual features. A central assets database or provider framework is unnecessary.

## 2. Relevant files and patterns

| Area | Reuse/change |
| --- | --- |
| Auth | `apps/api/src/modules/auth/{auth.ts,auth.routes.ts,auth.guard.ts,auth.authorization.ts,auth.messages.ts}`; existing Better Auth Drizzle adapter, session cookies, origin validation and user defaults |
| Configuration | `apps/api/src/config/env.ts`, `apps/api/.env.example`, `docker/app.env.example`; document server-only credentials |
| Images | `apps/api/src/modules/inspections/{cloudinary-photo-storage.ts,photo-storage.types.ts,inspections.service.ts}` and `modules/returns/{returns.service.ts,returns.types.ts}` |
| Contracts | `apps/api/src/modules/contracts/{contracts.types.ts,s3-contract.storage.ts,contracts.service.ts,contracts.routes.ts,contracts.policy.ts}` |
| Persistence/contracts | `packages/database/src/schema/{accounts.ts,users.ts,booking-contracts.ts,handover-inspections.ts,returns.ts}`; shared input/DTO contracts remain authoritative |
| Verification | Existing inspections, handover, returns and rental-contracts integration suites; storage dependency injection; `app.inject()`; existing Cloudinary service failure tests |
| Decisions | `docs/backend-patterns.md`, `docs/db-diagram.md`, `docs/rental-contracts-api.md`, `docs/flow2-ui.md`, `docs/local-database-tests.md` |

Use Route → Service → Repository; dedicated adjacent types and feature messages.
Create one SDK adapter under `common/adapters/storage/` plus thin photo/contract
adapters implementing their small interfaces. Move the shared photo boundary out
of inspections; keep `ContractStorage` unchanged. Domain services own authorization,
validation, persistence and cleanup decisions. No new dependency is expected.

Evidence: inspected HEAD `4d1134a`, matching GitNexus index. Cloudinary impact LOW,
9 upstream nodes, direct consumers inspections/returns. ContractsService also feeds
handover. Auth impact UNKNOWN; text inspection confirms routes, guards and service
callers. Empty process results do not prove absence of affected flows. Re-run impact
for each edited symbol before implementation. Remote issues were not reviewed;
review relevant linked auth/storage issues before coding if available.

## 3. Business rules, invariants and edge cases

### Google

- New verified Google identity: create CUSTOMER/ACTIVE; role/status are server-owned.
- Existing same-email user without Google link: reject implicit linking. User must
  authenticate using the existing method, then explicitly link the same Google email.
- Already linked Google account: reuse the same user, permissions and history.
- Set `disableImplicitLinking: true`, disallow different-email linking and profile
  updates that overwrite local role/status. Require ACTIVE session for linking;
  reject inactive users at Google session creation and protected API access.
- Google identity/email must be verified. Use installed Better Auth protections for
  OAuth state, replay and redirect allowlists; test expired/replayed/tampered state,
  cancellation, wrong email, missing session and concurrent/repeated linking.
- No duplicate accounts or linking an identity already owned by another user.
  Google login never claims guest bookings by email. Password login still works.
- Reuse POST `/api/auth/sign-in/social`, GET `/api/auth/callback/google` and POST
  `/api/auth/link-social`; inspect installed Better Auth 1.7.x for exact hooks/error
  behavior before adding minimal guards. Preserve callback redirects and cookies.

### Cloudinary

- Existing supported image/file uploads use Cloudinary. This does not allow arbitrary
  file types or create new upload APIs. Keep image/PDF limits and validation unchanged.
- Evidence: authenticated `image` assets, no transformations/overwrite; five-minute
  private URLs. Existing legacy Base64 evidence remains readable during transition.
- Contracts: authenticated `raw` PDFs, original bytes, deterministic mapping from
  existing `objectKey` (including `.pdf`) to public ID. Keep put/get/remove boundary,
  idempotency, version history, hash checks and API-proxied private PDF responses.
- SDK inputs explicitly carry resource/delivery type; public ID alone is not enough
  to remove an arbitrary resource. Keys and types come from server-controlled domain
  metadata, never directly from client deletion requests.
- Bounded downloads/timeouts; no fetching arbitrary client URLs. Missing storage is
  a controlled 503. Secrets and signed URLs never enter public errors/logs.
- Successful DB commit followed by response failure must retain the asset. Unknown
  commit outcomes retain data for reconciliation; cleanup must not delete referenced
  files. Delete is idempotent for missing assets. No new contract deletion permission.
- Missing Google credentials disable Google only; partial credentials fail validation.
  Missing Cloudinary configuration must not silently fall back to S3/public storage.

## 4. Small tasks and dependencies

| ID | Independently verifiable task | Depends on |
| --- | --- | --- |
| T1 | Inspect installed Better Auth options/hooks and related issues; inventory existing S3 contract references without mutation; verify Cloudinary raw/authenticated PDF support and account delivery limits. Record unknowns. | None |
| T2 | Add Google/Cloudinary configuration validation and examples, with centralized messages; test absent/partial configuration behavior. | T1 |
| T3 | Write failing auth integration cases; enable Google and explicit same-email linking with minimal lifecycle hooks. Verify actual users/accounts/sessions in isolated PostgreSQL, mocking only Google exchange. | T2 |
| T4 | Extract shared Cloudinary SDK adapter and photo storage boundary; update inspections/returns wiring and test imports. Preserve existing API payloads/errors and behavior. Run existing image failure/regression tests. | T2 |
| T5 | Add Cloudinary contract adapter implementing existing put/get/remove; test raw resource handling, original bytes, collision/overwrite refusal, bounded download and missing-resource behavior. Switch contract construction after the cutover gate below. | T4, T1 inventory |
| T6 | Adapt only necessary test guards to accept a dedicated `metastorage_inspection_test_*` DB, preserving existing explicit local opt-in. Run auth/storage suites and lifecycle regressions in separate processes. | T3–T5 |
| T7 | Document OAuth requests/errors and Google Console callback, Cloudinary setup and cutover. Remove S3 runtime dependency/config only when no remaining consumer or migration need exists. Verify affected existing UI and provider sandbox behavior. | T6, cutover gate |

T3 and T4 are independent after configuration. Do not combine auth and storage
changes into one unreviewable patch. Write new behavior tests before implementation;
use existing tests for the extraction rather than duplicating CRUD/mapping coverage.

Cutover gate: existing production/local S3 inventory is TBD. If no objects exist,
switch directly. Otherwise prepare a separate dry-run/copy/verify procedure: copy
to Cloudinary under the exact mapped keys, compare size/SHA-256 for every DB reference,
pause competing contract writes for cutover, then switch. Preserve source objects for
rollback; never bulk-delete originals as part of this change. Do not add permanent
multi-provider routing just for migration. Inventory/access or operational constraints
may block cutover, but not development of the adapter. Legacy Base64 migration is
also inventory-dependent; preserving reads is required, bulk conversion is separate.

No schema change is expected. If mapping cannot preserve existing identifiers, stop
and update the diagram/Drizzle design together before `bun run db:generate`; never
edit generated migrations manually.

## 5. Acceptance criteria and verification

- Google signup/login/linking matrix above passes through real auth routes and DB;
  existing password login, user permissions and inactive-user restrictions regressions pass.
- Inspections and returns still upload/read/remove authorized evidence. PDF upload,
  issue, download and handover work through Cloudinary with identical original hash.
- Failed uploads/DB writes, repeated requests, unknown commit outcomes and deletion
  errors preserve the documented invariants. No private assets become public.
- Old referenced files remain readable after cutover. No DTO shape or new frontend
  integration is required for storage; auth integration instructions are documented.
- No skipped mandatory suites counted as passes; fake provider tests do not count
  as external OAuth/Cloudinary acceptance.

Commands below are for implementation verification, not execution during planning.
Run from repository root. Prepare a migrated, disposable local PostgreSQL DB named
`metastorage_inspection_test_google_cloudinary` and dedicated Redis DB; supply their
URLs in `/tmp/metastorage-google-cloudinary-test.env` with `NODE_ENV=test`,
`DATABASE_URL` equal to `MY_STORAGE_LOCAL_DATABASE_URL`, `RUN_INSPECTION_DB_TESTS=1`,
isolated `REDIS_URL`/`REDIS_TEST_URL`, explicit localhost CORS/trusted origins,
`BETTER_AUTH_URL=http://localhost:4000/api/auth`, and test-only auth/QR/magic-link
secrets. No development credentials/data. T6 must precede existing contract/return
suites: their current guards require port 5433/database metastorage and reject a
dedicated DB. Do not bypass guards or claim these commands work before T6.

```sh
bun --env-file=/tmp/metastorage-google-cloudinary-test.env run db:migrate
# Planned new integration test files, created by T3/T5:
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/google-auth.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/cloudinary-storage.test.ts
# Existing suites, separate processes because some close the shared DB client:
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/units/inspections.cloudinary.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/inspections.integration.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/handover.integration.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/returns.integration.test.ts
bun --env-file=/tmp/metastorage-google-cloudinary-test.env test apps/api/tests/integration/rental-contracts.test.ts
bun run --filter api check-types
bunx biome check apps/api/src apps/api/tests/integration/google-auth.test.ts apps/api/tests/integration/cloudinary-storage.test.ts
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Use scoped Biome fixes on changed files; run repo-required `bun run check:fix` before
any later commit and inspect unrelated changes. Graph output must not be partial or
truncated; resolve it before committing. Report pre-existing check failures separately.

Manual/provider acceptance: configure Google test client and a Cloudinary test
environment; exercise new user → same-email conflict → authenticated link → repeat
login, then image/PDF upload/read/delete. Confirm PDF bytes and private unauthenticated
access denial. After tests, inspect existing image and contract views for preview,
download, expired-URL refresh and error recovery. The Google Web button remains
unwired in this backend-only task; use an isolated OAuth test harness, not a product
UI change. Real credentials and authorized test accounts remain external prerequisites.

## 6. Risks and non-goals

- Auth is broadly shared despite UNKNOWN graph risk. Provider defaults/version
  behavior, callback cookie forwarding and linking races need explicit route tests.
- Cloudinary PDF delivery settings, raw-file size limits and signed-download behavior
  need a real smoke test. Do not substitute a permanent signed CDN URL for expiring
  private download access. References: [Cloudinary upload parameters](https://cloudinary.com/documentation/upload_parameters),
  [Better Auth linking](https://better-auth.com/docs/concepts/users-accounts).
- Object storage and PostgreSQL are not one transaction; keep conservative cleanup.
  New retries/queue/reconciliation infrastructure are outside this minimal change.
- Non-goals: frontend/mobile/API-client implementation, universal assets table/API,
  arbitrary file upload, provider registry, new dependencies, image transformations,
  contract generation/e-signing/deletion, guest-booking claims, broad transaction
  refactors, production migration/deployment, commit/push, or removal of source files.
- Planning evidence: code/docs/graph reviewed; no tests, live provider calls, database
  inventory, migration or UI verification executed in this planning turn.
