# Frontend usability audit Implementation Plan

**Goal:** Improve verified pagination, recovery, and navigation gaps without changing APIs or business permissions.

**Architecture:** Preserve actor modules and shared feature hooks. Use one presentation-only pagination component for already-loaded arrays; keep existing server cursors and CSV exports unchanged. Admin remains an independent prototype.

**Tech Stack:** Next.js, React, TanStack Query, existing Tailwind UI, Biome, Vitest, Playwright and axe.

**Status (2026-10-25): Complete.** Tasks 1–5 implemented and verified: 30 existing tests, 12 audit E2E cases, four visual baselines, axe, type/lint checks and production build passed. Screenshots were inspected after the final test run. See `docs/frontend-usability-audit.md` for evidence and integration boundaries. No commit or push performed.

---

### Task 1: Customer transaction recovery and pagination
- Modify `apps/web/src/features/rentals/use-customer-transactions.ts`: isolate errors to the selected view, retry failed payment queries as well as rental queries, order loaded transactions by their actual payment/creation timestamp.
- Modify `customer-transactions-screen.tsx`, `transactions.messages.ts`: page loaded transactions by six, show partial failures with a working retry action, distinguish unpaid creation time from payment time. Retain cursor loading for additional rental sources and explain that the history covers rentals already created.
- Create reusable `apps/web/src/components/ui/list-pagination.tsx`, `.types.ts`, `.messages.ts` for accessible range summaries and previous/next buttons.

### Task 2: Existing array list pagination
- Modify `apps/web/src/features/administration/admin-workspace.tsx`: page filtered accounts, assignments, login history, audit history by ten. Reset on filters/section and clamp after edits. CSV still exports all filtered rows.
- Modify `apps/web/src/modules/facility-manager/dashboard/facility-staff-tab.tsx`: search staff by name/email/phone, six per page, preserve total workload counts and link to the actual dispatch view.
- Modify `apps/web/src/features/reservations/reservation-list.tsx`: clamp the existing page after list refresh so valid records cannot become hidden on an out-of-range page.

### Task 3: BOM history and price catalog
- Modify `apps/web/src/features/operations/components/operations-rules-view.tsx`: ten audit rows per page.
- Modify `operations-pricing-view.tsx`: search name/code and ten price rows per page. Keep edit and optimistic version checks unchanged.

### Task 4: FM/FS navigation
- Modify `apps/web/src/features/facility-flow/facility-shell.tsx`, `facility-overview.tsx`, `staff-task-notifications.tsx`: correct dispatch links, mark the current sidebar link semantically, ensure the FM legacy staff tab matches staff navigation, use role-specific default tab behavior.

### Task 5: Verification and handoff
- Add `apps/web/e2e/frontend-audit.spec.ts` to the isolated mock configuration for seeded long lists, filter/page resets, transaction failure/retry and role navigation.
- Run `bun run --filter web check-types`, Biome on changed files, relevant existing tests and targeted Playwright desktop/mobile with axe and screenshots; inspect screenshots after tests.
- Record findings and limits in `docs/frontend-usability-audit.md`. Do not commit or push until requested.

### Findings needing separate integration scope
- Customer reservations still call legacy `/reservations/mine`; the newer booking endpoints use different DTOs. Do not silently substitute them during cosmetic work.
- Transaction history currently aggregates payments of current/past rentals; pre-handover bookings are not included. Do not label it as all account payments.
- `FacilityDetail` contains obsolete fixed deposit text but the live facility detail route redirects to checkout and does not render it.
- Graph concept search is unavailable due to the Windows FTS dependency. Refreshed symbol impact plus source inspection is used; absent process traces are not an all-clear.
- The live `/system-admin/facility-assignments` route uses the integrated membership workspace. The prototype `AdminWorkspace` assignment branch is dormant; the audit does not replace this route or claim browser coverage for the dormant branch.
