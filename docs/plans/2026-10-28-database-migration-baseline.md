# Database Migration Baseline Implementation Plan

**Goal:** Replace the pre-production migration history with one baseline migration generated from the current Drizzle schema.

**Architecture:** Keep packages/database/src/schema as the schema source of truth and generate a fresh initial migration plus matching Drizzle metadata. Remove historical data-transfer hooks that only apply when upgrading pre-baseline databases; use Drizzle's normal migrator for the new clean-install path.

**Tech Stack:** Bun, Drizzle ORM/Kit, PostgreSQL.

---

### Task 1: Inventory the migration runner

**Files:** packages/database/src/migrate.ts

- Confirm its only production entry point is bun run db:migrate.
- Identify custom data-transfer hooks that are obsolete after the baseline reset.
- Keep connection cleanup and failure reporting.

### Task 2: Generate a clean baseline

**Files:** packages/database/drizzle/*.sql, packages/database/drizzle/meta/*

- Back up the current generated migration directory outside the active migration folder.
- Regenerate migration metadata from the current schema as a single initial migration.
- Do not hand-edit generated SQL.

### Task 3: Simplify the runner

**Files:** packages/database/src/migrate.ts

- Replace historical migration interception and legacy table transfers with the standard Drizzle migrator.
- Preserve safe database connection shutdown and clear completion/failure output.

### Task 4: Verify the new install path

**Files:** no additional files

- Run database package type checks and migration generation consistency checks.
- Apply the baseline to the designated local database, then inspect the resulting schema/journal.
- Do not use production credentials or databases.
