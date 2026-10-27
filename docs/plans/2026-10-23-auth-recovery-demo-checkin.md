# Auth Recovery and Immediate Demo Check-in Implementation Plan

Seed commands and fixture-file locations below are historical. The subsequent
single-seed refactor consolidates them in `packages/database/src/seed.ts` and
retains only `bun run db:seed`; see `2026-10-23-single-seed-command.md`.

**Goal:** Complete audit items 2–4 and seed a check-in slot usable immediately.

**Architecture:** Keep Better Auth responsible for password tokens, password changes and session revocation. Reuse the Resend adapter and shared API client; retain numeric API errors while preserving the auth SDK's top-level string code. Add a dedicated demo slot without changing database schema.

**Tech Stack:** Bun, Fastify, Better Auth 1.7.5, Resend, Next.js, React Hook Form, Zod, PostgreSQL/Drizzle, Playwright.

---

Confirmed in this session: web `/reset-password` completes recovery for web/mobile; single-use 60-minute tokens; signup password length rules; no automatic login; revoke prior sessions. Related issues reviewed: #144 (Google frontend compatibility), #54 (booking-to-rental checks). Preserve explicit demo limits and existing auth response envelopes.

### Task 1: Auth boundary and recovery

Files: `apps/api/src/modules/auth/auth.ts`, `auth.routes.ts`; `apps/api/src/common/adapters/mailer/{mailer.interface.ts,resend.adapter.ts,resend.messages.ts}`; `packages/api-client/src/index.ts`; `apps/api/tests/integration/{api-response.test.ts,password-reset.test.ts}`.

1. Extend response regression with `EMAIL_NOT_VERIFIED`; run it before changing the response.
2. Preserve the provider's top-level `code` beside the existing numeric error envelope so Better Auth SDK and Axios consumers both work.
3. Add recovery email to the existing mail adapter. Set Better Auth expiry/revocation and server-controlled web reset callback; change the real client to `/request-password-reset` while retaining the mock route.
4. On an isolated PostgreSQL database, test known/unknown email, password rules, expired/reused tokens, session revocation and login with the new password. Mock email delivery only.

### Task 2: Reset completion UI

Files: `packages/contracts/src/auth.ts`, `apps/web/src/features/auth/{reset-password-form.tsx,auth.messages.ts}`, `apps/web/src/app/reset-password/page.tsx`, `apps/web/e2e/password-reset.spec.ts`.

1. Add a shared reset-password input contract using signup password constraints and matching confirmation.
2. Add the shared-client completion call and a form with missing/invalid link, validation, pending, request failure and success states.
3. Run browser flow checks at desktop/mobile sizes, axe and screenshots; verify password mismatch and expired/reused links.

### Task 3: Dependency cleanup

Files: `apps/api/package.json`, `bun.lock`.

1. Remove unused `argon2`; update the lockfile using Bun.
2. Verify API types/build still resolve Better Auth's configured password hasher.

### Task 4: Immediate demo seed

Files: `packages/database/src/seed.ts`, `packages/database/src/demo-fixtures.ts`, `packages/database/tests/checkin-seed.integration.test.ts`, `README.md`.

1. Add a stable dedicated slot anchored to `SEED_NOW` (default current time) and use it for a new paid/assigned `DEMO-CHECKIN-NOW` booking. User explicitly chose a new booking to preserve existing NO_SHOW fixtures.
2. End the demo slot at the local day's end so off-hours demos work. Refresh only confirmed demo bookings without a verification or rental; preserve progressed lifecycles. The deadline uses the latest slot end, so operating hours need no change.
3. Verify seeded date/slot/allocation consistency and real check-in eligibility on an isolated database, including rerun and late-evening cases.
4. Document the ready booking and seed invocation. Run only `db:seed:checkin` on the existing local database; no full reseed. CI runs the seed regression on a separate database.

### Verification

Run focused API/database regressions, affected web tests, workspace type checks, Biome and production builds. Inspect affected UI after tests. Run GitNexus change analysis and review the final diff. No deployment or commit is requested.

### Completed verification — 2026-10-23

- Database runner: 19 suites, 223 tests passed, no skips, on a fresh isolated database. A first attempt with DB opt-ins in the ordinary single-process integration command hit shared-client teardown; the documented runner passed each suite in its own process.
- Seed regression: three tests passed on a separate fresh database, covering immediate eligibility, allocation dates, reruns at 23:59 local time, preserving the original fixture, and preserving the new booking after verification.
- Web auth component tests: 19 passed. Browser checks: 12 passed across desktop/mobile, covering recovery request, missing/expired/oversized token, password mismatch, loading, failure/retry, success/navigation, SDK error code and public-header actions.
- Layout, keyboard focus and axe passed at 375×667, 390×844, 430×932, 768×1024 and their landscape orientations. Screenshots inspected. A shared-header overflow at 667px was fixed by hiding the duplicate storage CTA below 900px; public-header regressions passed afterward.
- All eight workspace type-check tasks passed without cache. Biome and production builds passed. Frozen lockfile and 19 focused auth/mail cases also passed using the pinned Bun 1.3.14.
- GitNexus change analysis reports HIGH scope across auth/seed paths; new reset-page dependencies were checked separately. The analyzer reports incomplete flow coverage, so its absent flows are not treated as evidence of no impact.
- Ran only `db:seed:checkin` on the existing local database. `DEMO-CHECKIN-NOW` is CONFIRMED/SUCCEEDED, assigned to `staff@metastorage.vn` and `HCM-01-001`, and the real check-in service returned `canProceed: true`. Before/after booking/payment snapshots confirmed that old NO_SHOW fixtures were preserved. Existing account passwords were preserved.
- Live email delivery, native iOS/Android behavior and deployment were not exercised. Browser request handlers were stubbed; backend security/persistence was tested separately against PostgreSQL. Audit item 1 (credential logging) remains outside the requested changes.
