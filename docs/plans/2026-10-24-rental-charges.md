# Rental Charges Implementation Plan

**Goal:** Add source-specific rental obligations, extra-charge approval and payment, return-debt collection, and source-aware reporting for issue #162.

**Architecture:** Add a rental-charges feature with Route → Service → Repository and shared Zod input contracts. Charge payment attempts extend the existing payments table but use a separate completion branch, so SePay callbacks never enter booking confirmation, capacity, QR, or handover logic. Return settlements link to their debt obligation; report aggregates include payments and refunds once by source.

**Tech Stack:** Fastify, TypeScript, Zod, Drizzle ORM, PostgreSQL, SePay gateway, Bun integration tests.

## Current implementation status

- **Done in workspace:** additive Drizzle schema and generated migrations; charge contracts and APIs for extra charge submission/approval/rejection/dispute/adjustment/payment/refund confirmation; separate SePay completion/reconciliation source; return-debt linkage and correction records; source-aware revenue and monthly aggregates; API-client methods and API documentation.
- **Added, not executed:** PostgreSQL integration suite for staff/manager/customer ownership, wrong currency, callback replay, charge payment isolation from `CHECKED_IN`, and report totals.
- **Still open:** customer notice delivery/evidence (so the 7-day clock currently starts at charge creation), database integration execution, Finance report-label validation, return-debt due date, later correction after a refund has already been confirmed, and full reconciliation/refund regression coverage. Do not close #162 until these are resolved or explicitly accepted as follow-up.

---

## Approved behavior to implement

- Charges use VND and full payment only through SePay. A charge is distinct from its payment attempts; retries share one charge and only one successful attempt may collect it.
- Extra charges are created by assigned FS, approved/rejected by assigned FM, and waived/adjusted by BOM with reason and audit. No self-approval.
- Customer charge disputes are allowed within seven calendar days of notice; collection pauses while disputed.
- Return debt is created as a separate charge linked to the immutable settlement revision. Whether that debt blocks a future renewal remains TBD and is not implemented by this issue.
- Payment provider success is idempotent and source-aware. Charge success never mutates booking, capacity, QR, rental expiry, or handover state.
- Reports distinguish rental checkout, renewal, extra, return debt, deposit, and refunds; cash totals use confirmed timestamps and never multiply rows through joins.
- If an approved correction lowers already-collected return debt, create a source-linked refund; do not rewrite settled payments or settlement revisions.

## Task 1: Shared contracts and database model

**Files:** `packages/contracts/src/rental-charges.ts`, `rental-charges.types.ts`, `rental-charges.messages.ts`, exports; `packages/database/src/schema/rental-charges.ts`, `payments.ts`, `returns.ts`, `relations.ts`, exports; `docs/db-diagram.md`.

1. Add enums and input contracts for charge creation/decision, adjustment, dispute, payment start, and refund confirmation.
2. Add rental charge, adjustment, and charge-refund records with source/status checks, VND amount constraints, ownership/audit FKs, and idempotency constraints.
3. Add nullable `payments.rentalChargeId`; allow exactly one of booking, draft, or rental charge. Make hold token nullable only for charge payments and preserve existing checkout constraints.
4. Link each return settlement revision to its debt charge without introducing a polymorphic source ID.
5. Update the diagram to match Drizzle and generate, never hand-edit, the migration.

## Task 2: Charge API and authorization

**Files:** `apps/api/src/modules/rental-charges/*`, `apps/api/src/app.ts`, integration tests.

1. Add customer own-charge list and rental-scoped charge reads with ownership/facility authorization.
2. Add FS charge submission requiring approved category, VND amount, evidence note, and due date.
3. Add independent FM approve/reject, customer dispute, FM dispute resolution, and BOM adjustment/waiver actions with audit reasons.
4. Derive charge balance from immutable charge plus adjustment records. Prevent adjustments after collection; corrections after collection use refund records.

## Task 3: Payment attempts, webhook, reconciliation, and refunds

**Files:** payments service/repository/routes/types, SePay gateway types, payment contracts, charge service/repository, integration tests.

1. Create payment attempts from server-owned charge amount/currency and a 15-minute quote, with idempotent retries.
2. Start SePay checkout without a booking reference while preserving the existing booking checkout input and behavior.
3. Dispatch verified webhook/reconciliation events by payment source. Charge success marks the charge paid once and must not call booking completion.
4. Add customer payment status access through ownership; keep booking access-token status behavior intact.
5. List and confirm charge refunds with source caps, actor, transfer reference, and timestamp; do not add automatic refunds.

## Task 4: Return debt and financial reports

**Files:** returns service/repository/policy, reports repository/service/contracts, rental-charge repository, tests.

1. Create a return-debt obligation in the same transaction as a positive approved settlement debt.
2. On a new settlement revision, adjust an unpaid debt via immutable adjustment rows; if debt was collected and the corrected amount is lower, create a linked refund for the difference; if higher, create a separate obligation for the increase.
3. Update financial aggregates, reconciliation and detail rows to include source-specific successful charges/refunds exactly once and preserve existing checkout/deposit classifications.

## Task 5: Integration and verification

**Files:** `apps/api/tests/integration/rental-charges.test.ts`, relevant checkout/report tests, payment/return/report docs.

1. Cover FS/FM/BOM/customer authorization, dispute windows, wrong amount/currency, full payment, failed/retried attempt, duplicate webhook, concurrency, and CHECKED_IN booking isolation.
2. Cover return debt creation, settlement correction before/after payment, refund caps, and mixed-source report totals.
3. Run the new PostgreSQL integration test only against the guarded `metastorage_inspection_test_*` database, then targeted checkout regressions, type checks, and lint for changed workspaces.
4. Review graph changes with GitNexus and run `git diff --check`.

## Explicitly out of scope

- Renewal lifecycle and the unresolved rule whether unpaid return debt blocks renewal (#163).
- Frontend/mobile UI, counter cash, partial payments, wallet/credit, generic invoicing or accounting revenue recognition.
- Automatic provider refunds and a general ledger.
