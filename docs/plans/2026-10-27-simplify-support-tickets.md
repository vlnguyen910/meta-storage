# Simplify Support Tickets Implementation Plan

**Goal:** Replace support chat and image attachments with an immutable one-way support request stored entirely in `support_tickets`.

**Architecture:** Keep customer context discovery plus create/list/detail ticket endpoints. Store the initial description and idempotency key on the ticket itself; remove message, attachment, audit, assignment, status, closure, and separate idempotency persistence that no longer has an active workflow.

**Tech Stack:** Bun, TypeScript, Fastify, PostgreSQL, Drizzle ORM, Zod

---

### Task 1: Define the reduced API contract and tests

**Files:**
- Modify: `packages/contracts/src/support.ts`
- Modify: `packages/contracts/src/support.types.ts`
- Modify: `apps/api/tests/integration/customer-support.test.ts`

1. Keep contexts, context payments, create, list, and detail contracts.
2. Make ticket detail contain the immutable description instead of a message page.
3. Remove reply, message, attachment, and image contracts.
4. Cover successful creation, same-key retry, different-payload key conflict, ownership, context validation, list, and detail.

### Task 2: Simplify backend support code

**Files:**
- Modify: `apps/api/src/modules/support/support.routes.ts`
- Modify: `apps/api/src/modules/support/support.service.ts`
- Modify: `apps/api/src/modules/support/support.repository.ts`
- Modify: `apps/api/src/modules/support/support.types.ts`
- Delete: `apps/api/src/modules/support/support-image.storage.ts`
- Delete: `apps/api/src/modules/support/support-image.validation.ts`

1. Remove message, reply, upload, and attachment-read routes.
2. Insert the ticket directly with `description` and `idempotencyKey`.
3. Enforce idempotency using unique `(owner_user_id, idempotency_key)`; return the existing ticket only when persisted request fields match.
4. Keep notification outbox insertion atomic with first ticket creation.

### Task 3: Remove obsolete database structures

**Files:**
- Modify: `packages/database/src/schema/support.ts`
- Modify: `packages/database/src/schema/relations.ts`
- Modify: `apps/api/src/modules/facilities/staff-work.repository.ts`
- Modify: `docs/db-diagram.md`

1. Reduce `support_tickets` to immutable request/context, SLA, idempotency, and creation fields.
2. Drop `support_messages`, `support_attachments`, `support_audit`, `support_idempotency`, and unused support enums.
3. Remove relations and staff-assignment blocking queries for deleted support workflow fields.
4. Generate the next Drizzle migration and apply it only after the configured database preflight confirms all four deleted tables contain no rows.

### Task 4: Update active documentation and verify

**Files:**
- Delete or rewrite: `docs/customer-support-api.md`
- Modify affected active support documentation.

1. Remove chat/image claims from active documentation; preserve historical generated migrations and plans.
2. Run focused support integration tests.
3. Run the uncached local database suite, workspace type checks, API build, Biome, and `git diff --check`.
4. Report frontend/mobile/API-client callers left for their separate scope.

