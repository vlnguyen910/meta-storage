# Flow 5 Staff Task Report Implementation Plan

**Goal:** Let an assigned facility staff member submit a work report for a task and let the responsible facility manager read it, with task completion semantics matching the confirmed review rule.

**Architecture:** Extend the existing Facility Tasks module through Route → Service → Repository and persist report submissions as task-linked records. Keep report submissions and review decisions auditable. Do not change booking, inspection, contract, rental, or unit status through the report endpoint.

**Tech Stack:** Fastify, Drizzle ORM, PostgreSQL, shared Zod request contracts, TypeScript response DTOs, Bun integration tests.

## Scope update (2026-10-23)

The user has now also requested task execution/completion status, direct FM
maintenance transitions and history, physical-unit create/update, and facility,
unit-type and staff-membership management. Those API/schema changes are covered by
`docs/flow-5-backend-plan.md`. The user confirmed that FM acceptance is required
before completion. The current
task adds ASSIGNED → IN_PROGRESS → AWAITING_APPROVAL → COMPLETED and records the
accepting FM. Admin maintenance requests remain outside this report-review slice.

---

## Confirmed scope (2026-10-22)

The user selected report submission and history first, then confirmed that the
assigned-facility FM must accept the latest report before the task is complete.
Submission appends a text report (trimmed, 1..5000 characters); submission itself
does not complete the task.

POST /api/facility-tasks/:id/reports: current active assigned FS after starting the
task, body { content }, 201 with report ID, task ID, submittedBy, submitterName,
content, submittedAt and nullable acceptance actor/time.
GET /api/facility-tasks/:id/reports: same-facility active FM or current assigned FS,
200 with { items, total, limit, offset }, newest first. Historical authors remain
recorded after reassignment; previous assignees lose access under existing task
rules. FS starts with POST /api/facility-tasks/:id/start. FM accepts only the latest
report via POST /api/facility-tasks/:id/reports/:reportId/accept; this atomically
completes the task and stores the FM actor/time. No reject or edit/delete endpoint
or attachments. Missing session 401; invalid body/query 400; forbidden
role/facility/assignee 403; missing task/report 404; invalid lifecycle 409.

Submission locks the task, account and facility assignment in that order and
rechecks current eligibility, serializing with reassignment. Tests cover persisted
history, actor spoofing, facility isolation, revoked/expired/disabled actors,
reassignment, concurrent submissions/reassignment, pagination, FM acceptance and
completion. Unit state remains unchanged by reporting. Existing task assignment
tests remain regression coverage.

## Task 1: Add integration tests for report access and persistence

**Files:**
- Create: `apps/api/tests/integration/flow5-task-reports.test.ts`
- Reuse: `apps/api/tests/fixtures/facility-operations.ts`
- Inspect: `apps/api/tests/integration/flow5-facility-tasks.test.ts`

**Steps:**
1. Add a failing test for an assigned FS submitting a text report to its task and retrieving the saved report.
2. Add failing authorization tests for another FS, an FS from another facility, FM/customer roles submitting, and expired facility assignments.
3. Add tests for FM visibility within the assigned facility and denial across facilities.
4. Cover report appends, lifecycle status and FM acceptance of the latest report.
5. Run `bun test --cwd apps/api tests/integration/flow5-task-reports.test.ts` against the existing isolated PostgreSQL test database and confirm the expected failures.

## Task 2: Add report contracts and persistence

**Files:**
- Create: `packages/database/src/schema/facility-task-reports.ts`
- Modify: `packages/database/src/schema/index.ts`
- Modify: `packages/contracts/src/facility-tasks.ts`
- Modify: `packages/contracts/src/facility-tasks.types.ts`
- Modify: `packages/contracts/src/facility-tasks.messages.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`
- Modify: `docs/db-diagram.md`
- Generate: `packages/database/drizzle/*` via `bun run db:generate`

**Steps:**
1. Add a report record linked to a task and session-derived submitter, with required bounded text and server-generated submission time.
2. Keep reports append-only; do not accept submitter, task status, reviewer, or timestamps from the request body.
3. Persist task status/start/completion and report acceptance actor/time.
4. Add the matching entity and relationships to the canonical database diagram.
5. Generate the Drizzle migration; never hand-edit generated migration files.
6. Re-run the report integration tests and type checks.

## Task 3: Implement report submission and reads

**Files:**
- Modify: `apps/api/src/modules/facility-tasks/facility-tasks.types.ts`
- Modify: `apps/api/src/modules/facility-tasks/facility-tasks.repository.ts`
- Modify: `apps/api/src/modules/facility-tasks/facility-tasks.service.ts`
- Modify: `apps/api/src/modules/facility-tasks/facility-tasks.routes.ts`
- Modify: `apps/api/src/modules/facility-tasks/facility-tasks.swagger.ts`

**Steps:**
1. Add `POST /api/facility-tasks/:id/reports` for the currently assigned FS only.
2. Add `GET /api/facility-tasks/:id/reports` for that FS and an FM with an active assignment to the task's facility.
3. Verify current facility assignment and task assignee before reading or writing reports.
4. Use a transaction and row locks where task lifecycle state or report eligibility depends on concurrent writes.
5. Add FM acceptance and staff start endpoints; acceptance must atomically complete the task.
6. Document session security, response envelopes, status codes, and report visibility in Swagger and `docs/flow5-task-assignment-api.md`.

## Task 4: Verify the complete backend slice

**Steps:**
1. Apply the generated migration only to the isolated test database.
2. Run `bun test --cwd apps/api tests/integration/flow5-task-reports.test.ts`.
3. Run existing Flow 5 task and Flow 2 assignment/inspection/handover regression suites.
4. Run `bun run check`, `bun run check-types`, and `bun run --filter api build`.
5. Run `node .gitnexus/run.cjs detect-changes --scope all --repo .` and resolve or report any graph risks before committing.

## Deferred decisions

There is no rejection action. While awaiting approval, FS may append a supplemental
report; FM accepts the latest report. The separate FM-to-Admin maintenance request
flow remains outside this implementation.
