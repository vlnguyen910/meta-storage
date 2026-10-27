# Legacy Database Storage Removal Implementation Plan

**Goal:** Apply pending account-owned booking migrations and remove the unused reservation-draft table, duplicate user password column, and legacy inspection Base64 column.

**Architecture:** Keep `bookings` as the only checkout draft source, `accounts.password` as the only credential hash, and private object storage as the only inspection photo content store. Preserve old generated migrations, move any migration-only table definitions out of the active schema, and generate a new Drizzle migration from the diagram and schema changes.

**Tech Stack:** Bun, TypeScript, PostgreSQL, Drizzle ORM, Biome

---

### Task 1: Apply pending migrations

**Files:**
- Existing migrations: `packages/database/drizzle/0059_omniscient_hiroim.sql`
- Existing migrations: `packages/database/drizzle/0060_even_bloodscream.sql`

1. Run `bun run db:migrate` from the repository root.
2. Verify the configured development database no longer contains `booking_access_audit` and has applied migration timestamp `1792929537364`.

### Task 2: Remove the active reservation-draft schema

**Files:**
- Delete: `packages/database/src/schema/reservation-drafts.ts`
- Modify: `packages/database/src/schema/payments.ts`
- Modify: `packages/database/src/schema/relations.ts`
- Modify: `packages/database/src/schema/index.ts`
- Modify: `packages/database/src/migrate-account-bookings.ts`
- Modify: `packages/database/src/migrate-facility-unit-types.ts`
- Modify: `apps/api/src/modules/unit-types/unit-types.repository.ts`
- Modify affected database/API tests and fixtures that create legacy reservation drafts

1. Keep a migration-local `reservation_drafts` definition where old migrations still need it.
2. Remove `payments.draft_id` and simplify `payments_source_reference` to allow exactly booking or rental-charge sources.
3. Remove active relations, exports, repository checks, tests, and fixtures that reference reservation drafts.
4. Keep unrelated frontend demo contracts and endpoints unchanged; mobile checkout refactoring is outside the selected fixes.

### Task 3: Remove duplicate credential and legacy photo columns

**Files:**
- Modify: `packages/database/src/schema/users.ts`
- Modify: `packages/database/src/schema/handover-inspections.ts`
- Modify: `apps/api/src/modules/inspections/inspections.service.ts`
- Modify affected user and inspection tests

1. Remove `users.passwordHash`; Better Auth continues using `accounts.password`.
2. Remove `inspectionPhotos.dataBase64` and the legacy response fallback; all stored photo bytes come from the storage adapter.
3. Update tests so they no longer construct or assert the removed database fields.

### Task 4: Update the canonical database diagram

**Files:**
- Modify: `docs/db-diagram.md`

1. Remove `reservation_drafts`, `payments.draft_id`, `users.password_hash`, and `inspection_photos.data_base64` from the active model.
2. Replace legacy transition notes with the final account-owned booking and object-storage decisions.

### Task 5: Generate and verify the migration

**Files:**
- Generated: `packages/database/drizzle/<next migration>.sql`
- Generated: `packages/database/drizzle/meta/<next snapshot>.json`
- Modify: `packages/database/drizzle/meta/_journal.json`

1. Run `bun run db:generate`; never hand-edit generated migration files.
2. Inspect the generated SQL and confirm it only drops the intended table, columns, constraints, indexes, and legacy enums.
3. Run focused database/API tests, `bun run check-types`, and `bun run check`.
4. Run `bun run db:migrate` and verify the configured development database has no removed table/columns and no orphaned legacy rows.

