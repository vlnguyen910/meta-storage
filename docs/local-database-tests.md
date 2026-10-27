# Integration tests on the existing local containers

## One-command local checks before a PR

Start the existing local dependencies once:

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

From the repository root:

```bash
bun run test:db:local  # all CI API database suites plus seed regressions
bun run check:pr      # lint, workspace types, regular tests, then local DB tests
```

The wrapper uses PostgreSQL `127.0.0.1:5433/postgres` with the local Compose
credentials and reserves Redis logical database **12**. It supplies fake API,
Google OAuth and storage credentials, creates unique empty API/seed databases,
applies the real migrations and invokes the existing CI runners directly. It
does not seed the API regression database or accept skipped database cases.
The separate seed database runs the same demo-seed regression as CI.

The PostgreSQL account needs CREATE DATABASE permission. The existing business
database `metastorage` is never migrated, reset or seeded by this command.
The Redis database must be empty and dedicated to tests: the wrapper refuses a
nonempty target, claims it exclusively, and clears only its claimed database on
normal success/failure. Do not use this command with application Redis databases.
Temporary PostgreSQL databases are removed after success or test failure.

For different local ports/credentials or another empty reserved Redis DB:

```bash
LOCAL_TEST_POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:15433/postgres \
LOCAL_TEST_REDIS_URL=redis://127.0.0.1:16379/12 \
bun run test:db:local
```

Overrides accept only loopback PostgreSQL administration database `postgres` and
Redis databases 1–15. Remote hosts, Redis DB 0 and query-string overrides are
rejected. If the process is force-killed, inspect its leftover test databases and
reserved Redis DB before manually cleaning them; the wrapper will not erase
unknown pre-existing Redis data on the next invocation.

## Isolated CI regressions

`bun run --filter api test:db` runs all opt-in integration suites in separate
Bun processes, without Turbo caching. It requires `NODE_ENV=test`, matching
`DATABASE_URL`, `BOOKING_TEST_DATABASE_URL`, `MY_STORAGE_LOCAL_DATABASE_URL`,
`PRICING_TEST_DATABASE_URL`, and `REPORTS_TEST_DATABASE_URL`. The database must be
on loopback and named `metastorage_inspection_test_*`. The runner refuses the
shared `metastorage` database, even though individual legacy suites retain their
explicit local opt-in below.

CI provisions PostgreSQL 18 and Redis 7 services and applies migrations before
running tests. Set `REDIS_URL` and `REDIS_TEST_URL` to the same loopback Redis URL
with an explicit logical DB 1–15, and `RUN_INSPECTION_DB_TESTS=1`. Configure the
required API environment with test credentials. Google OAuth tests require both
fake `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; they mock provider exchange.
Automated tests must never use production credentials or queues.

Start with a freshly migrated, dedicated database: pricing tests run first and
require no deposit policy or pricing history. The runner then installs only the
four required system-setting defaults, never demo accounts/facilities. Some
suites preserve their fixtures, so a failed run should be investigated on its
dedicated database and a full rerun should use a fresh isolated database.
The runner stops on a failed process, a suite with zero cases, or any skipped
case in its JUnit report. New opt-in suites are discovered from `test.skipIf`,
`describe.skipIf`, and explicit `skip` declarations; missing configuration
therefore cannot silently green CI.

`bun run --filter api test` runs API unit tests first, then the regular integration
tests in a second process. With no DB opt-ins it intentionally skips DB suites;
the separate CI database job is mandatory before deploy.

## Return workflow regressions

`apps/api/tests/integration/returns.integration.test.ts` requires an isolated
`metastorage_inspection_test_*` database, including when run directly. Set
`NODE_ENV=test` and matching `DATABASE_URL` / `MY_STORAGE_LOCAL_DATABASE_URL`.
The suite temporarily changes the global overdue rate to verify settlement
recalculation; it must never run against the shared local `metastorage` database.
The guard rejects that target before creating fixtures or changing settings.

## Existing shared local database

Only legacy suites that still explicitly opt in may use PostgreSQL on
localhost:5433/metastorage and Redis database 14. The return workflow suite above
is excluded. For these shared-database runs, do not create a database, reset/reseed
fixtures, truncate tables or flush Redis.
Run suites in separate processes: some close their shared Postgres client on teardown.

Booking payment regression runs its scheduler with `facilityId: ids.facility`.
No-show processing, hold expiration, pending-payment reconciliation and rental
lifecycle processing all receive this same boundary. Direct sweep calls also use it.
The API's normal scheduler omits this option and still processes the whole system.
Bun queues and Redis keys used by the suite have fixture-specific names.

A first run on 2026-10-20 exposed the previous suite's unscoped global NO_SHOW calls:
81 tests passed and two failed because demo bookings were included in their counts.
The sweeps changed nine seeded booking scenarios and their related payment/occupancy
state: BK-2026-0002 and DEMO-HCM-01/02/06/07 ASSIGNED/UNASSIGNED. The user explicitly
chose to retain the resulting local data; no recovery/reset/reseed was run.

After the facility scope fix, the payment suite passed 83/83. A before/after snapshot
comparison of bookings, payments, allocations, assignments, verifications, units,
rentals and notification outbox confirmed unchanged non-fixture data after cleanup.
The scope applies to real database queries; it is not a mocked scheduler result.
