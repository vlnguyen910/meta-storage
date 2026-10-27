# Remove Contract Management Backend Implementation Plan

**Goal:** Remove backend PDF contract management and its database storage requirement so handover no longer requires an uploaded or issued contract.

**Architecture:** Delete the contract Fastify slice and contract storage adapters, remove contract persistence from the active Drizzle schema, and simplify handover/rental reads to have no contract dependency. Keep frontend, mobile, and API-client code unchanged in this phase; their now-dead methods will receive 404 until a separate frontend cleanup.

**Tech Stack:** Bun, TypeScript, Fastify, PostgreSQL, Drizzle ORM, Biome

---

### Task 1: Lock the removal behavior with backend tests

**Files:**
- Modify: `apps/api/tests/integration/handover.integration.test.ts`
- Modify: `apps/api/tests/fixtures/inspection-fixture.ts`
- Delete: `apps/api/tests/integration/rental-contracts.test.ts`
- Modify: `apps/api/tests/integration/cloudinary-storage.test.ts`
- Modify: `apps/api/tests/fixtures/customer-rental-live-server.ts`

1. Change handover coverage so a completed inspection can hand over without uploading or issuing a PDF.
2. Remove contract table cleanup and contract route/storage fixture setup.
3. Remove the contract-only integration suite and Cloudinary contract-adapter cases.
4. Run the focused handover suite and confirm the old contract requirement fails before implementation.

### Task 2: Remove the backend contract slice and handover dependency

**Files:**
- Delete: `apps/api/src/modules/contracts/contracts.routes.ts`
- Delete: `apps/api/src/modules/contracts/contracts.service.ts`
- Delete: `apps/api/src/modules/contracts/contracts.repository.ts`
- Delete: `apps/api/src/modules/contracts/contracts.policy.ts`
- Delete: `apps/api/src/modules/contracts/contracts.types.ts`
- Delete: `apps/api/src/modules/contracts/cloudinary-contract.storage.ts`
- Delete: `apps/api/src/modules/contracts/s3-contract.storage.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/modules/inspections/inspections.routes.ts`
- Modify: `apps/api/src/modules/inspections/inspections.service.ts`
- Modify: `apps/api/src/modules/inspections/inspections.types.ts`

1. Unregister all `/bookings/:id/contracts`, `/rentals/:id/contracts`, issue, upload, and PDF routes.
2. Remove contract storage injection from inspection routes.
3. Remove prepare/bind contract calls from handover while preserving its existing transaction, locks, authorization, payment, unit, deadline, and rental activation checks.
4. Verify handover succeeds without a contract and remains idempotent.

### Task 3: Remove contract persistence from rental reads and the active schema

**Files:**
- Delete: `packages/database/src/schema/booking-contracts.ts`
- Modify: `packages/database/src/schema/handover-inspections.ts`
- Modify: `packages/database/src/schema/index.ts`
- Modify: `apps/api/src/modules/rentals/rentals.repository.ts`
- Modify: `apps/api/src/modules/rentals/rentals.service.ts`
- Modify: `packages/contracts/src/rentals.types.ts`
- Modify: `docs/db-diagram.md`

1. Remove `booking_contracts`, `booking_contract_audit`, their enum, and `handover_inspections.contract_id` from the canonical diagram and Drizzle schema.
2. Remove the issued-contract subquery/join and `currentIssuedContract` response field from facility rental reads.
3. Run `bun run db:generate`; inspect but never edit the generated migration.
4. Apply the generated migration to the configured development database after confirming contract/audit/bound-handover counts are zero.

### Task 4: Remove backend-only dependencies and active documentation

**Files:**
- Modify: `apps/api/package.json`
- Modify: `bun.lock`
- Delete: `docs/rental-contracts-api.md`
- Modify: `docs/google-auth-cloudinary.md`

1. Remove `pdf-lib` and `@aws-sdk/client-s3` from the API workspace when no remaining backend import uses them.
2. Run `bun install` to update the lockfile.
3. Remove active documentation that says PDF upload/issuance is required.
4. Preserve historical generated migrations and historical implementation plans.

### Task 5: Verify the removal

1. Run focused handover and storage tests.
2. Run `bun run test:db:local` to validate migrations from an empty database and all database workflows.
3. Run `bun run check-types` and `bun run check`.
4. Run `git diff --check` and confirm active backend/database source has no contract module, contract table, or handover contract gate references.

