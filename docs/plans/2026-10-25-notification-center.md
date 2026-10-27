# Notification center Implementation Plan

**Goal:** Replace the wide notification banners with a compact header bell, a bounded dropdown and dedicated notification pages inspired by the supplied Facebook reference.

**Architecture:** Frontend only, confirmed by the user. Preserve Customer/FM GET `/notifications` pagination and Staff WebSocket authorization/retry/deduplication. Share notification presentation; keep server state in TanStack Query and shell-specific orchestration in actor modules. No synthetic unread state, new permissions, backend/schema work or persistent Staff history.

**Tech Stack:** Next.js App Router, React, TanStack Query, existing Tailwind/lucide, Playwright and axe. No new dependencies.

**Status:** Complete. Verified seven notification scenarios, five existing Staff realtime regressions, 12 frontend audit cases, 11 relevant unit/component tests, axe, screenshot comparisons, web type-check, Biome and production build. An additional Staff case verifies dismissal when a notification links to the current dashboard path. Screenshots were inspected after tests. See [handoff](../notification-center.md).

---

### Task 1: Shared presentation and data
- Create `apps/web/src/features/notifications/notification-popover.tsx`, `notification-list.tsx`, `notification-center.tsx`, `notifications.messages.ts`, `notifications.types.ts` and `use-notification-inbox.ts`.
- Bell: 44px accessible target around a 20px icon; active state; anchored desktop dropdown, viewport-bounded mobile width, independent vertical scrolling and persistent footer link. Escape/outside click/navigation closes; opening focuses the close control and closing restores the trigger; Tab may leave the non-modal popup and closes it.
- Customer/FM: use the existing identity-scoped query key and offset pagination, cancel requests on identity changes, deduplicate loaded records and retain loaded results on errors. Popup previews the latest eight; the full page supports loading more. Preserve long message content in the full page with safe word wrapping; clamp preview text.
- Use event icons, strong titles, readable timestamps and StoreX light/green styling. Show real loading, empty and recoverable error states. No unread tab/count without a backend contract.

### Task 2: Header integration and pages
- Replace the Customer and FM body banners by header bells in `apps/web/src/components/layout/app-shell.tsx` and `apps/web/src/features/facility-flow/facility-shell.tsx`.
- Refactor `LifecycleInbox` into the header adapter using shared presentation. Refactor `StaffTaskNotifications` into its header adapter while preserving the connection lifecycle.
- Store actual received Staff events in identity-scoped, bounded query cache for this session only. Keep toast, task invalidation and reconnect behavior; connection status and retry live inside the dropdown/page. Surface the session-only history boundary.
- Add notifications route constants, thin route pages and actor-owned notification screens for Customer, FM and Staff. BOM/SA retain their existing permissions and sources.

### Task 3: Verification and handoff
- Add isolated `notifications.playwright.config.ts` and E2E coverage: desktop/mobile placement; popup bounds and internal scrolling with long content; full-page pagination and deduplication; empty/error/retry; keyboard/outside close; role isolation; actual Staff WebSocket events, reconnect, deduplication and shell teardown.
- Adjust existing Staff realtime tests to open the bell before checking connection status. Refresh only the existing audit screenshots affected by removing the body banner, after visual review.
- Run targeted E2E + axe, relevant existing tests, web type-check, Biome and production build. Inspect screenshots after tests; restore generated Next type/config changes. Record implemented scope and limits. Do not commit or push unless requested for this work.
