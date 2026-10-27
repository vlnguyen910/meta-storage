# Simplify Facility Task Reports Implementation Plan

**Goal:** Remove the separate `facility_task_reports` table and store only the latest report on its task.

**Architecture:** Add nullable latest-report fields to `facility_tasks`, retain the current HTTP routes by projecting zero or one report, and atomically migrate the latest report before dropping the history table. Earlier report history is intentionally discarded.

**Tech Stack:** Bun, TypeScript, Fastify, PostgreSQL, Drizzle ORM, Zod

---

### Task 1: Consolidate persistence

- Add report id, content, submitter, and submitted time to `facility_tasks`.
- Remove the report table and its relations/exports.
- Update the task/reports section in `docs/db-diagram.md`.

### Task 2: Keep current API behavior with one report

- Update repository submit, accept, and list methods to read/write task fields.
- Keep existing routes and response contracts; list returns zero or one report.
- Update task report integration fixture assertions to query `facility_tasks`.

### Task 3: Migrate safely

- Generate a Drizzle migration.
- In the migration runner, copy each task's latest report to the new task columns before dropping `facility_task_reports`.
- Preflight the configured dev database, apply the migration, and verify the table is gone and latest report data remains.

### Task 4: Validate

- Run relevant API/database type checks, API build, formatting, and diff checks.
- Report that historical reports before the latest are no longer available.
