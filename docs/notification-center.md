# Header notification center — 2026-10-25

User-confirmed scope: frontend presentation using existing notification sources. The wide Customer/FM inbox and Staff connection banners have been replaced by a compact bell in their header bars. No API, database, permission or unread-state contract was added.

## Behavior

- The 20px bell sits inside a 44px target. Its dropdown uses a header, contextual event icons, clamped message previews, timestamps and a persistent “Xem tất cả thông báo” footer.
- Desktop width is 400px. Mobile width stays within 12px viewport gutters. Height is bounded by the viewport; the list scrolls independently, including keyboard scrolling, without hiding the footer. Long subjects, bodies and unbroken strings wrap safely.
- Escape, the close button, clicking outside and navigation close the dropdown. Opening focuses the close control; Escape/close restore the bell. The dropdown is non-modal, so users can Tab out.
- Customer/FM preview the latest eight records. Their full pages retain the existing 20-record offset API, load earlier records on demand, deduplicate IDs across pages and preserve loaded data if a later request fails.
- Staff continues to receive its existing authenticated WebSocket events. Actual received events are retained in identity-scoped memory, newest first, capped at 100 per session. The dropdown previews eight. Session boundaries are explained on the full page; the task list remains the source for assignments received before the current session.
- Staff reconnect/offline/rejected states and manual retry live inside the dropdown. Events still refresh assigned tasks. Bursts share a 200ms refresh window and show at most one toast every two seconds, while every valid event is recorded up to the bounded session limit. Duplicate/wrong-recipient events do not produce entries.

## Routes

| Role | Full page | Source |
| --- | --- | --- |
| Customer | `/customer/notifications` | Existing `GET /notifications` |
| Facility Manager | `/facility-manager/notifications` | Existing `GET /notifications` with existing facility authorization |
| Facility Staff | `/staff/notifications` | Actual `STAFF_TASK_ASSIGNED` events received during this session |

There is no unread tab, unread count or mark-as-read action because the current contracts do not provide read state. Staff history is not persisted across reloads or devices. BOM/SA receive no new inbox permission or fabricated source. Mock-mode visibility retains the existing shell behavior.

## Verification

- Isolated notification E2E: `cd apps/web` then `bunx playwright test --config notifications.playwright.config.ts` — seven scenarios covering desktop/mobile, short viewport, long content, internal scrolling, keyboard/outside dismissal, offset pagination, cross-page deduplication, empty/error/retry, authorization, a 105-event Staff burst, reconnect and teardown. Four deterministic Chromium/Windows screenshot baselines cover Customer/FM dropdowns at 1440px and 375px. Axe runs without exclusions.
- Existing Staff regression: `bunx playwright test --config flow2.playwright.config.ts --grep 'Staff realtime|manager never opens|Staff notification connection'` — five scenarios, adapted only to open the bell before inspecting connection status.
- Existing frontend audit: 12 cases passed. Only the two transaction screenshots changed because the body banner moved into the header; pricing baselines remain unchanged.
- Relevant existing unit/component suites: 11 tests passed for routes, role permissions, facility context and workspace isolation.
- Web type-check and Biome on the changed source/test/config files passed. Screenshots were reviewed for layout, wrapping, dropdown bounds and visible controls.
- `bun run build` passed for API, worker and web, including all 51 generated static pages and the three new notification routes.
- A final Staff browser check confirms clicking a notification closes the dropdown even when the destination uses the same dashboard pathname.

The tests use intercepted API responses and WebSocket messages; they validate UI integration and lifecycle handling, not production database delivery. Live API and permission behavior retain their existing implementation.

## Graph review and maintenance

GitNexus index was refreshed for checkout `D:/CHUYEN NGANH/SEMESTER 8 FA26/WDP/storeX`, registry `metastorage`, commit `66d37e5`. Header adapters and Staff hook changes have HIGH impact through shared shells; regressions cover those consumers. FTS remains unavailable on Windows and process traversal is bounded, so an absent graph edge/flow is not treated as proof of no impact.

Change analysis including new files reports 49 changed symbols, 29 affected process groups and aggregate CRITICAL risk, with no partial/truncated result flags. The full local result is `.gitnexus/notification-center-graph-result.json`; temporary intent-to-add entries used for the analysis were restored immediately afterward.

Implementation plan: [notification center](plans/2026-10-25-notification-center.md). No dependencies or backend changes were introduced. Test-generated Next configuration/type references are restored after verification. This work has not been committed or pushed.
