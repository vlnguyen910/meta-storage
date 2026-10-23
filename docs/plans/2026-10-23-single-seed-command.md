# Single Seed Command Implementation Plan

**Goal:** Keep PostgreSQL fixture data and seed logic in one file, runnable with `bun run db:seed`.

**Architecture:** Move shared fixture constants into `packages/database/src/seed.ts`; Swagger imports that metadata through the database package. The existing main seed already creates accounts, policies, bookings and immediate check-in data, so remove alternate seed entry points rather than add another orchestrator. Keep offline Web/Mobile mock data in their existing runtime boundaries.

**Tech Stack:** Bun, Turborepo, Drizzle/PostgreSQL, Fastify/Swagger.

---

1. Run GitNexus impact and confirm literal references for seed, fixture exports and the account-only script. Preserve all current work from the preceding task.
2. Move fixture constants to `packages/database/src/seed.ts`, update API/test imports and the package export, and guard CLI execution so importing metadata in a bundled API cannot run seed.
3. Remove the account-only script, `seed:local`, `seed:facility-accounts`, `db:seed:checkin` and its CLI branch. Keep the existing seed sequence and lifecycle guards.
4. Update active README/Swagger/development documentation to show only `bun run db:seed`; retain historical validation records with a superseding note.
5. Run the actual root seed command on a freshly migrated isolated database. Reuse seed and Swagger regressions, verify bundled metadata imports have no seed side effects, and run type checks, formatting and the API build. Do not run the full seed against the shared local database: its documented behavior resets demo scenarios and development passwords.

Completed: the actual root command seeded a fresh isolated database under Bun 1.3.14; all four seed regressions and 12 Swagger regressions passed. All eight workspace type-check tasks, Biome and the API production build passed. The built API started on the isolated database without executing seed; Swagger was inspected in Chromium and displays the single command. The shared local database was not reseeded.
