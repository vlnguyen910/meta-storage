# Local Pre-PR Checks Implementation Plan

**Goal:** Fix current workspace type/test failures and provide a repeatable local PostgreSQL/Redis regression command before PR submission.

**Architecture:** Reuse shared contracts and the existing database regression runner. The local wrapper provisions fresh disposable databases on loopback PostgreSQL, uses an empty reserved Redis logical database, applies migrations and runs the same API/seed regressions as CI, then removes its resources.

**Tech Stack:** Bun, TypeScript, Drizzle, PostgreSQL, Redis, existing test runners.

---

### Task 1: Repair contract callers

- Update managed unit type API-client output and editor version payloads to use the actual facility DTO; keep ownership fields out of update bodies.
- Update pricing mocks and route tests for the agreed FM/BOM split. Do not restore the removed global BOM price-write behavior.
- Verify with workspace check-types and the existing affected tests.

### Task 2: Add local database command

- Add `apps/api/tests/run-local-database-tests.ts` and root `test:db:local` command.
- Use test credentials; reject remote/admin database confusion and Redis DB 0/nonempty targets.
- Create uniquely named empty API and seed databases, migrate both, invoke existing CI runners without Turbo caching, and clean up owned resources on success/failure.
- Reuse existing local PostgreSQL/Redis services; document defaults and overrides in `docs/local-database-tests.md`.

### Task 3: Verify current regressions

- Run check-types, regular workspace tests and all database/seed tests via the new command.
- Resolve actual failures and rerun affected checks; run focused Biome/diff checks.
- Inspect affected Web editor behavior in a browser when environment permits. No commit/push without a new request.

### Progress

- Fixed managed catalog DTO/version callers and positive-price test expectations; restored current FM pricing route tests without reintroducing BOM local-price writes.
- Fixed the foreign-facility task fixture and made the global reporting aggregation case tolerate retained fixtures from earlier suites.
- Added `test:db:local`, `check:pr`, local URL guard tests and documentation. The wrapper was verified to refuse nonempty Redis and to clean its temporary resources after a failed regression.
- Workspace lint/type checks and regular tests pass. All 28 API database suites ran without skips, followed by four seed regression cases; zero owned databases/Redis keys remained.
- Browser verification covered metadata/status editor serialization and dialog completion using a mocked HTTP fixture; it does not verify a complete new FM/BOM pricing UI.
- Final `bun run check:pr` completed successfully end-to-end, including the default local PostgreSQL/Redis configuration.
