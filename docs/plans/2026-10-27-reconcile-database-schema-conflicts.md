# Reconcile Database Schema Conflicts Implementation Plan

**Goal:** Resolve the active migration conflicts while preserving the current branch's agreed schema reductions and remove only tables confirmed obsolete by prior decisions.

**Architecture:** Use `docs/db-diagram.md` and Drizzle schema files as the schema sources of truth. Resolve source/schema history first, then generate migration metadata and SQL with the repository command; keep API callers compatible with the reduced schema.

**Tech Stack:** PostgreSQL, Drizzle ORM, Bun, TypeScript.

---

### Task 1: Inventory the active schema and conflict state

**Files:** `docs/db-diagram.md`, `packages/database/src/schema/*`, `packages/database/drizzle/meta/*`, `packages/database/src/migrate.ts`, `packages/database/src/schema/relations.ts`.

Read current merge/rebase state, enumerate declared tables, compare it with the approved removals (support messages/attachments, booking contracts, facility operating hours, return calendar, and task report history), and identify any remaining obsolete schema entries or stale references.

### Task 2: Resolve schema source conflicts

Preserve the current branch's lifecycle migration data handling and relations that correspond to retained tables. Remove obsolete table references only when the active schema and prior confirmed scope show that the table is no longer used. Update the DB diagram to match the resulting schema.

### Task 3: Regenerate migration artifacts

After resolving source conflicts, run `bun run db:generate` and inspect the generated migration/journal/snapshot changes. Do not hand-edit generated migration files. Ensure existing history is retained and the new migration removes only the confirmed obsolete tables.

### Task 4: Check compatibility

Search for remaining imports/queries against removed tables, run database package type checks and relevant API type checks. Inspect migration SQL for destructive operations and verify that data transfer/backfill remains present where required.
