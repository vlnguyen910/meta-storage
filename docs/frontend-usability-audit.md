# Frontend usability audit — 2026-10-25

Implemented the [approved plan](plans/2026-10-25-frontend-usability-audit.md) for loaded-list pagination, transaction recovery and role navigation. API contracts, business permissions, server cursors and price concurrency checks retain their existing behavior.

## Changes

| Area | Result |
| --- | --- |
| Customer transactions | Six loaded payments per page, newest payment/creation timestamp first; reset on view change; distinguish creation and payment times. Retry failed payment queries and rental sources, and show only errors relevant to the selected view. Successful results remain available during partial failures. |
| Admin prototype | Ten filtered accounts/login/audit records per page; filter resets and page clamping. CSV exports all filtered records, including records outside the visible page. The dormant prototype assignment branch shares the same pagination. |
| FM legacy staff tab | Search name/email/phone, six records per page and reset on search/facility change. Workload totals still describe all staff. Dispatch links open the check-in view. Fixed heading order and text contrast found by axe. |
| Customer reservations | Clamp the page after refreshed data shrinks. Previous/next actions use the displayed page, so navigation remains usable after clamping. |
| BOM pricing and history | Search unit type name/code; ten prices or audit changes per page. Existing editor, drafts, version checks and CSV behavior are preserved. |
| FM/FS navigation | Overview and task notifications link to the role's dispatch view. Sidebar exposes one `aria-current="page"` destination and matches the legacy FM staff tab. Unknown/default dashboard views follow each role's screen behavior. |

The shared `ListPagination` is presentation-only. It slices no API data and announces visible ranges with accessible previous/next controls. Its messages and props live in adjacent message/type files.

## Verification

- `bun run --filter web check-types` passed.
- Biome checks on changed source, E2E and Playwright configuration files passed.
- Relevant existing Vitest suites passed: **30 tests in 6 files**, covering pricing conflicts/draft retention/cache invalidation, workspace isolation, administration helpers, routes and permissions.
- `bun run build` passed: API, worker and web; web generated all 48 static pages.
- Isolated Playwright suite: **12 tests passed**, including all four visual comparisons, using `cd apps/web` then `bunx playwright test --config frontend-audit.playwright.config.ts`.
  It exercises customer payments, rental-source and payment-query retry, cursor continuation, reservation refresh, BOM search/history, FM/FS navigation and admin pagination/CSV at 1440px and 375px.
- Axe runs without exclusions on the inspected desktop/mobile states, together with document overflow checks. Pagination also receives keyboard activation coverage.
- After visual review, the six BOM/FM/FS cases were rerun successfully with complete history IDs and explicit destination/sidebar assertions, ensuring dispatch screenshots capture the destination after navigation.
- Screenshots were visually inspected after tests. The price table scrolls within its container on narrow screens; the document stays within the viewport. Staff totals remain unchanged when filtering, and empty-result states allow recovery.

Four Chromium/Windows visual baselines are stored in `apps/web/e2e/frontend-audit.spec.ts-snapshots/`: transactions and pricing at both widths. Fixtures use fixed identities and timestamps, and the browser requests reduced motion to avoid smooth-scroll capture artifacts. Before capture, the helper clears field focus, waits for fonts/layout and returns to the top so fixed headers are captured consistently. Additional FM/FS, policy history, admin and transaction-error screenshots are generated under `apps/web/test-results/audit-*.png`.

## Integration boundaries and findings

1. **Admin assignments:** `/system-admin/facility-assignments` renders `FacilityManagementWorkspace membershipsOnly`, not `AdminWorkspace section="assignments"`. Browser tests cover the three live prototype lists: users, login history and activity logs. The dormant assignment branch receives the shared rendering change but has no live-route E2E claim. The integrated assignment flow needs its own API-backed audit.
2. **Reservations:** customer reservations still use legacy `/reservations/mine`. New booking endpoints have different DTOs and were not substituted. The refresh test uses the current legacy shape.
3. **Payment scope:** transaction history aggregates payments for loaded current/past rental records. Pre-handover bookings are excluded; the page now explains this and retains cursor-based loading of additional rentals.
4. **Obsolete deposit copy:** `FacilityDetail` contains old fixed-deposit wording, but the live facility-detail route redirects to checkout and does not render it. No pricing rule was inferred from that copy.
5. **Fixtures:** Playwright intercepts API requests. The admin prototype seed is expanded only within the test browser context to exercise 23 rows without production test hooks. These tests validate UI behavior, not backend persistence or live WebSocket delivery. Browser coverage is Chromium, not Safari/Firefox or a physical device.

## Graph review

Repository registry name: `metastorage`; checkout: `D:/CHUYEN NGANH/SEMESTER 8 FA26/WDP/storeX`; indexed commit: `5256a032d54aaa257dbef4bbbe78aa6210262df2` (HEAD). The index was refreshed during this audit.

`ReservationList`, `FacilityStaffTab` and the transaction screen/hook had LOW symbol impact. Shared BOM workspace paths and the new pagination component have CRITICAL graph impact: `ListPagination` has five direct consumers and reaches 25 symbols across 12 reported process groups. This is a broad regression surface, addressed with the relevant browser flows, existing pricing integration checks and production build; it is not a low-risk graph result.

Change analysis includes new files using temporary intent-to-add entries, restored immediately afterward. Full results are retained locally in `.gitnexus/frontend-audit-graph-result.json`. FTS concept search remains unavailable due to the Windows native dependency. Process indexing also reports bounded traversal; absent process traces are not evidence of no impact.

The test server uses port 3104 and an ignored `.next-playwright/frontend-audit` cache. Automatic approval review rejected removal of the old `.next-audit` cache with “blocked by policy”; it remains local and is ignored by Git. Generated Next.js type/config edits are restored after verification.

No commit or push was performed.
