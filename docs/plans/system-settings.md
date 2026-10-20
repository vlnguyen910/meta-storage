# Unified global system settings

Approved scope: one global settings table and admin configuration API. Backend/database
only; preserve current business defaults, API contracts, BOM financial permissions and
immutable financial snapshots. Existing unrelated changes were committed by task first.

1. Replace three scalar settings tables with system_settings plus append-only audit.
   JSONB scalar values permit future typed keys; current four numeric keys are allowlisted.
2. Preserve data/revisions transactionally through a migration runner using generated
   Drizzle migrations. Do not hand-edit generated SQL. Repeated migration must be a no-op.
3. Keep old lifecycle/pricing/overdue API paths backed by the same rows. Add common
   GET/PUT /api/system-settings and paginated GET /api/system-settings/:key/history.
4. Reuse pricing and overdue services for financial updates; require BOM. Admin may
   manage rental-day keys only. Audit old and new APIs in the same transaction.
5. Keep facility schedules/checklists and prices in their domain tables. Inventory other
   hardcodes; do not invent effect-on-existing-workflow rules to make them editable.
6. Verify local DB migration preservation/repeatability, optimistic concurrency, key
   validation, access scope, atomic audit and compatibility with existing routes/jobs.
   Use existing local PostgreSQL/Redis only; no reset, truncate or database creation.

Dependencies: schema/contract -> migration + repositories -> common API -> integration
checks. Run API/worker/contracts/database typechecks, Biome, affected integration suites,
GitNexus impact before edits and staged change analysis before each commit.

Risks: pricing revision covers both price/deposit; missing config must fail closed;
all environments must use the migration runner. No frontend, arbitrary key creation,
secrets in DB, automatic financial authority for Admin, or unrelated workflow changes.

## Verification performed

- Generated `0044_graceful_lord_tyger.sql` with `bun run db:generate`; no generated SQL edited.
- `DATABASE_URL=postgres://postgres:postgres@localhost:5433/metastorage bun run db:migrate`:
  first run applied 1 migration; repeat applied 0. Four old values/version/actor/time
  were compared with the pre-migration snapshot; old tables no longer exist.
- From apps/api, set `DATABASE_URL` and `MY_STORAGE_LOCAL_DATABASE_URL` to the URL above:
  `bun test tests/integration/system-settings.integration.test.ts`: 9 passed.
- Set `REDIS_TEST_URL=redis://localhost:6379/14` as well:
  `bun test tests/integration/returns.integration.test.ts`: 26 passed.
- With `BOOKING_TEST_DATABASE_URL` matching DATABASE_URL and the Redis URL above:
  `bun test tests/integration/booking-payment-start.test.ts`: 83 passed after fixture
  scoping; initial unscoped run was 81 passed / 2 failed and affected nine demo rows.
  User chose to retain current data. See docs/local-database-tests.md.
  `bun test tests/integration/booking-drafts.test.ts`: 22 passed.
  `bun test tests/integration/booking-tracking.test.ts tests/integration/booking-email-access.test.ts`:
  9 passed.
- `bun run check-types --filter=api --filter=worker --filter=@metastorage/contracts --filter=@metastorage/database`:
  API, worker, contracts, database and dependency shared passed.
- `bun run check:fix` and `bun run check`: checked source with Biome; Markdown is ignored
  by repository Biome configuration. `git diff --check` used for whitespace review.
- Legacy pricing-postgres.test.ts remains guarded for an empty isolated DB and was
  not run on the shared local database. New common-API tests cover real pricing/rate
  reads, shared pricing revision races, database constraints and transaction rollback.

Remaining policy work: inventory candidates is in docs/system-settings.md. Only four
existing global settings were consolidated; TTL/security/slot/file constants were not
silently made mutable without rules for already-running workflows. No frontend or
real provider/storage delivery verification is claimed.
