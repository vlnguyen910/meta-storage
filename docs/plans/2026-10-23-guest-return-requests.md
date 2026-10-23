# Guest Return Requests Implementation Plan

**Goal:** Let a customer with a valid booking email magic-link session request a storage return without an account.

**Architecture:** Add booking-scoped guest routes that resolve the rental from the existing Redis session and delegate list/slots/create to the current locked ReturnsService workflow. Only those three operations accept an internal guest actor; account and Staff routes keep their existing guards. Make request/audit account FKs nullable for guests and record the verified booking and source in the creation audit, without persisting session credentials or creating fake users.

**Tech Stack:** Fastify, Drizzle/PostgreSQL, Redis, shared Zod contracts and Bun.

---

### Task 1: Schema and policy alignment

- Update `docs/db-diagram.md`, `packages/database/src/schema/returns.ts` and the nullable audit actor in `packages/contracts/src/returns.ts`; generate the migration with `bun run db:generate`.
- `return_requests.created_by` and `return_audit.actor_id` retain their users FKs but accept null for a guest creation. Audit details include `source: GUEST_MAGIC_LINK` and the authorized booking ID. Account mutations still supply their authenticated actor ID.
- Existing rules remain: active/return-pending/overdue rental, one open request, at least 24 hours notice, configured 90-minute available slot with cooldown, required reason, initial PENDING status. Submission does not reserve the slot until assigned Staff confirmation after FM assignment.

### Task 2: Isolated API regressions before implementation

- Add `apps/api/tests/integration/guest-return-requests.test.ts` using owned fixtures in a guarded, migrated `metastorage_inspection_test_*` database and isolated Redis test DB.
- Exercise email-link exchange without account login, expired/revoked/missing/wrong-booking sessions, rejected Origin, invalid payload, late/full/holiday slots, closed rental, duplicate/concurrent requests, persisted guest audit and unchanged account endpoint authorization. Verify FM sees/assigns a guest request and assigned Staff confirms it through the existing flow.
- Run with `NODE_ENV=test`, matching `DATABASE_URL`/`MY_STORAGE_LOCAL_DATABASE_URL` and loopback `REDIS_URL`/`REDIS_TEST_URL`; first expect 404 on missing guest routes, then pass after implementation. No production/local business database or actual mail delivery is used.

### Task 3: Guest routes and shared workflow

- Extend `apps/api/src/modules/guest-rental-access/guest-rental-access.routes.ts` and `.service.ts`: GET `/booking/tracking/:bookingCode/return-requests`, GET `.../return-slots?date=...`, POST `.../return-requests` (201).
- Reuse `CreateReturnRequestSchema`, `ReturnSlotsQuerySchema`, existing tracking cookie/session validation, no-store headers, and `requireTrackingOrigin` for POST. Derive rental and booking ownership from the session; never accept actor/rental IDs in request bodies.
- In `apps/api/src/modules/returns/returns.types.ts`, `.service.ts`, `.repository.ts`, permit an internal booking-scoped guest principal only for list/slots/create; maintain all locks, validation and lifecycle notifications.

### Task 4: Web scope

- No web UI or API-client changes in this task. A later UI task can consume the guest endpoints.
- Scope excludes guest edit/cancel, settlement decisions, renewal/upgrade and account attachment.

### Task 5: Verification and docs

- Run guest API tests, existing booking-tracking and return integration suites, workspace type checks and Biome. Build the backend.
- Update `docs/returns-api.md` and booking-tracking documentation with endpoints, migration and guest permissions. Run GitNexus detect-changes; do not commit unless requested.
