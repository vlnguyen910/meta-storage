# Account-required Booking Implementation Plan

**Goal:** Require customer accounts throughout booking/rental access and remove guest ownership and redundant booking identity fields.

**Architecture:** Keep Route → Service → Repository and existing payment transactions. Booking ownership comes exclusively from the authenticated customer; customer name/email come from users, while contactPhone remains a booking-specific value. Guest routes and their actor branches are removed.

**Tech Stack:** Fastify, shared Zod contracts, Drizzle/PostgreSQL, Bun, Redis/BullMQ.

---

## Confirmed decisions

- Public catalog remains public; creating booking drafts requires an active CUSTOMER session.
- bookings.user_id is NOT NULL with ON DELETE RESTRICT; no fake customer or email-based claim.
- Remove bookings.contact_name/contact_email and guest checkout access_token_hash. Keep contact_phone for this booking only.
- Signup phone is optional (shared signup contract updated). Payment uses an explicitly provided booking phone, falling back to users.phone, and requires a valid phone. Do not update users.phone.
- Existing guest business records may be deleted. Implement ordered cleanup in the migration runner before generated constraints; never modify generated migrations.
- Remove guest tracking/magic-link/rental/return endpoints. Keep existing customer APIs and operational workflows.
- Backend/database scope includes shared request contracts, worker email links, seed and affected tests. No web/mobile/API-client edits or commits.

### Task 1: Contracts and regression cases

Files: packages/contracts/src/bookings.types.ts, packages/contracts/src/payments.ts, apps/api/tests/integration/booking-drafts.test.ts, apps/api/tests/integration/booking-payment-start.test.ts.

1. Change payment input to idempotencyKey plus optional contactPhone; draft output no longer supplies a bearer token.
2. Test anonymous/wrong-role access, owner isolation, phone fallback/override/missing phone, immutable pricing and idempotent payment.
3. Run affected tests before implementation to establish the failures.

### Task 2: Schema and migration

Files: docs/db-diagram.md, packages/database/src/schema/bookings.ts, packages/database/src/migrate.ts, packages/database/src/seed.ts, generated packages/database/drizzle/*.

1. Update diagram and schema together: required owner with restrictive deletion, remove redundant fields and contact-completeness checks; retain phone required after DRAFT.
2. Delete guest-dependent records in dependency order, release their allocated inventory, and preserve account-owned records inside the migration transaction.
3. Generate DDL with `bun run db:generate`; verify migration on an isolated database and seed compatibility.

### Task 3: Authenticated booking and reads

Files: apps/api/src/modules/bookings/*, apps/api/src/modules/payments/*, apps/api/src/modules/{check-ins,inspections,rentals,rental-charges,returns,notifications}/*.repository.ts.

1. Require CUSTOMER on draft/payment/cancel/status endpoints; pass session user ID and enforce ownership in repositories.
2. Use server-generated internal capacity hold hashes; never accept a bearer token as ownership.
3. Join users for name/email while preserving response DTO fields and issued contract snapshots.
4. Remove legacy guest payment finalization and guest return principals, retaining transactional payment/refund logic.

### Task 4: Remove guest delivery/access

Files: apps/api/src/app.ts, apps/api/src/modules/guest-rental-access/*, apps/worker/src/notifications/booking-mail.service.ts and affected tests/docs.

1. Remove guest route registration, module and tracking session methods; public guest URLs become 404.
2. Confirmation emails link to the authenticated customer booking URL; keep QR check-in and reliable outbox delivery.
3. Replace guest-only tests with checks that removed endpoints cannot grant access; update fixtures to real account ownership.

### Task 5: Verification

1. Run backend/database/contracts/worker type checks and Biome on changed files.
2. Run relevant unit/integration and isolated database suites with `bun run test:db:local` where available; fix affected fixtures rather than suppressing checks.
3. Review generated DDL, inspect diff and run GitNexus detect-changes. No commit or application-data migration is implied.
4. Report API changes and frontend compatibility work left outside this scope.

## Verification completed

- API test command passed; database-dependent cases were also executed separately.
- `bun run test:db:local` passed all 27 database regression suites without skips and all 4 seed checks.
- API, worker, database and contracts TypeScript checks passed.
- Biome passed for changed source/test files; `git diff --check` passed.
- Generated migrations: `0059_omniscient_hiroim.sql` (required owner/booking identity cleanup) and `0060_even_bloodscream.sql` (drop guest access audit).
- GitNexus reports critical impact across 71 processes, consistent with the intentional booking/payment/access change; this is not a low-risk compatibility change.
- Migrations were exercised on disposable test databases only. No application database migration, frontend/mobile/client update, browser verification, commit or push was performed.
