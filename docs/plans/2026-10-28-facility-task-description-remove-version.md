# Facility Task Description and Version Removal Plan

**Goal:** Add an optional task description and remove the task version field from persistence and API contracts.

**Architecture:** Keep task lifecycle and assignment authorization in the existing API layers. Add nullable text to the facility task row, remove optimistic version checks, and rely on the existing task row lock and lifecycle validation when updates are serialized.

**Tech Stack:** TypeScript, Zod, Drizzle ORM, PostgreSQL migrations.

---

### Task 1: Update the schema and shared contract

**Files:** `docs/db-diagram.md`, `packages/database/src/schema/facility-tasks.ts`, `packages/contracts/src/facility-tasks.ts`, `packages/contracts/src/facility-tasks.types.ts`

- Document nullable `description` and remove `version` from the task model.
- Add optional description to create/update validation and task DTO; remove version from update payload and response type.

### Task 2: Update API task persistence and responses

**Files:** `apps/api/src/modules/facility-tasks/facility-tasks.repository.ts`, `apps/api/src/modules/facility-tasks/facility-tasks.service.ts`, `apps/api/src/modules/facility-tasks/facility-tasks.swagger.ts`, `packages/api-client/src/flow5.ts`

- Persist and return description.
- Remove version reads, writes, response fields, and version-conflict handling while retaining row locks and status transition checks.

### Task 3: Generate and verify the migration

- Run `bun run db:generate`; review the generated migration for nullable description addition and version column/check removal.
- Run API and API-client type checks and formatting checks. Do not reset or migrate any configured database.
