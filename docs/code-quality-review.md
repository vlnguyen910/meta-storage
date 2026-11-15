**Code quality and maintainability review — 2026-11-15**

Original review baseline: revision `d9962b03`. The implementation status below supersedes the original findings where marked completed; the numbered findings remain as the historical rationale and deletion-risk record.

The largest opportunities are test-only implementation islands, retired contracts that remain exported, unreachable UI branches, and avoidable request work. Start with those; do not begin by dropping historical tables or removing every file reported by a static analyzer.

**Implementation status — 2026-11-15**

Implemented the confirmed cleanup in the working tree: 30 tracked obsolete files removed, approximately 1,100 net source lines removed after replacement code and regression coverage. No database schema, migration, application data, dependency versions, authentication policy, or financial history was changed. Source-line savings are not a bundle-size or latency measurement.

| Finding | Status | Result and remaining plan |
| --- | --- | --- |
| 1. Repeated authentication | Completed | Cache successful authentication per request with a `WeakSet`; retain each role/facility check and fresh authentication on subsequent requests. Remove redundant route guards. |
| 2. Transaction request fan-out | Completed | Add opt-in `includePayments` to existing customer rental pages. Batch payment history once for the returned rental IDs, scope to the authenticated owner, and reuse the detail DTO. Both clients consume included history; the per-rental detail endpoint stays available. |
| 3. Eager mobile storage reads | Partial | Fetch current/history only for the selected view and request payment inclusion only for transactions. Refresh only enabled queries. The selected view still drains rental pages to preserve existing complete totals; bounded incremental mobile pagination remains a separate UI change. |
| 4. Task-detail list scan | Completed | Replace client page scans with `GET /api/facility-tasks/my/:id`. Reuse active-assignment authorization, enforce staff ownership, and preserve historical-task access until assignment revocation. |
| 5. Unreachable management tabs | Completed | Remove unreachable offerings/units branches, unused parent wiring, and the unused inventory export. Keep live inventory/offering components and memberships. |
| 6. Retired contracts | Completed | Delete seven disconnected contract/message/type files and remove their barrel/subpath exports. |
| 7. Test-only backend mappers | Completed | Remove both unused mapper implementations and their self-tests. Live serialization remains unchanged. |
| 8. Disconnected permission layer | Completed | Remove unused web permission registry, wrapper, and self-tests. Active route and server authorization remain. |
| 9. Obsolete admin mocks | Completed | Remove old hook/seed and mock-only helpers/types/tests. Replace stale browser setup with real `/users` fixtures and verify current pagination/filtering. Keep the active operations prototype. |
| 10. Fixture-only components | Partial | Remove unused web radio group and its self-test. Keep the mobile component catalog and its fixtures pending a supported-catalog decision. |
| 11. Uncalled repository methods | Completed | Remove rental-by-booking and unused assignment lookup methods plus the stale test-double property. |
| 12. Overlapping API clients | Partial | Remove unused facilities-list and storage-unit wrappers. Keep actively used offline/demo namespaces; isolate or retire them only together with their consumers. |
| 13. Mobile simulator | Retained | Standalone workflow tests and supported demo authentication still provide value. Confirm supported simulator scope before further deletion. |
| 14. Web offline prototype | Retained | Mock mode and its tests remain supported. A separate demo-entry change would need its own migration/validation scope. |
| 15. Guest tracking remnants | Completed | Remove obsolete E2E/fixture and unused tracking crypto/types. Move the still-used 24-hour mail retention constant to shared mail. Preserve encrypted job compatibility and legacy-mail suppression. |
| 16. External API aliases | Retained | Deletion needs deployed-client/provider or traffic evidence unavailable in this checkout. Keep compatibility handlers until that evidence and a retirement window exist. |
| 17. Booking URL aliases | Retained | Preserve existing deep links and query handling. Choose a canonical URL before a separate query-preserving redirect change. |
| 18. Cache fragmentation | Partial | Extract domain booking keys to break the import cycle; distinguish rental caches by payment inclusion and batch transaction reads. Broad invalidations and remaining all-page loaders require workflow-specific evidence before narrowing. |
| 19. Repeated operating-hours reads | Completed | Remove ignored facility argument and validate both appointment boundaries against one global-hours read. Preserve timezone, closing boundary, and development exceptions. |
| 20. Full-list table reads | Deferred | Keep current array contracts, complete selector datasets, and dashboard totals. Implement server-side filtering/page metadata with corresponding UI totals as a separate coherent change. |
| 21. Reconnect duplication | Completed | Staff notifications now reuse the shared stream with a small status callback. Preserve event validation, deduplication, throttled toasts, cache invalidation, and manual retry. |
| 22. Utility overlap | Partial | Remove dead admin CSV helpers. Keep intentionally different class-merging/formatting/CSV policies until equivalence is established; broad replacement could change behavior. |
| 23. Responsibility/cycle debt | Partial | Break the web hook cycle and delete dead branches. Keep lazy database FK wiring and avoid arbitrary file-size-driven extraction. Further splits should follow distinct workflows. |
| 24. Ineffective remember control | Completed | Remove checkbox, form state, schema/type field, and copy. Existing session persistence remains unchanged. |
| 25. Missing retirement guide | Completed | Restore authoritative `booking-retirement.md` from repository history, including retained-data, migration, cutover, and queued-job constraints. |
| 26. SQL/binary artifacts | Retained | Preserve migration/recovery history and possible native/design assets until deployed journals, stored references, builds, and ownership establish safe retirement. |

**Behavior and deployment notes**

- Deploy the updated API before the updated web/mobile clients: clients now use the staff detail route and opt into embedded rental payments. Older clients remain supported by the updated API. No database migration is required.
- Rental-list payment inclusion defaults to false, preserves cursors, and returns only the existing public payment fields. A batch covers at most the requested rental page (limit 100); each rental's payment history remains complete, matching the existing detail read. This removes one HTTP payment request per rental and avoids one database-history query per rental in this workflow; it is not independently paginated payment history.
- Task details return 404 for another staff member's task and 403 when the caller has no active facility assignment; inactive users are denied by the normal authentication guard. Cache headers remain private/no-store.
- Reconnect transaction retry and load-more controls already supported by the hook but absent from the screen. Keep partial results visible and recover the failed source without losing rental cursors. Label transaction search for assistive technology and allow the toolbar to wrap at phone widths.
- Browser checks exposed admin warning/avatar contrast and shared error heading-order failures. Fix those locally without redesigning the screens. Two design-hook hover warnings were reviewed as false positives (white neutral resting state, matching dark tinted hover text); a narrow file exception records the reason. Existing font-size advisories remain unchanged.

**Implementation validation**

- `bun run check:fix`, `bun run check-types`, and `bun run knip:ci`: passed.
- `bun run test`: six workspace tasks passed without cached results (489 passing tests; database-guarded cases intentionally skip in the default runner).
- `bun run test:db:local`: all 20 isolated API/database regression suites passed without skips (130 tests), plus the isolated demo-seed regression (one test). Includes new ownership/revocation/inactive-user task-detail cases and batched-payment parity, pagination, empty-history, malformed-flag, and cross-owner exclusion checks.
- `bun run build`: API, worker, and web production build passed. The final rerun compiled web after the accessibility fixes; unchanged API/worker outputs used Turbo cache on that rerun.
- Focused Playwright run: six tests passed against the real web server with HTTP fixtures, covering admin pagination/filtering, keyboard payment pagination, and transaction source errors/retry/cursors at 1440px and 375px, including axe checks and screenshots. The entire E2E suite was not run.
- Shared notification-stream regression: reconnect, denial, pending socket disposal, and retry-timer cancellation checks passed; the targeted suite was rerun after its final assertion changes.
- Native device verification remains unavailable: `adb devices -l` found no device and ARTEMIS diagnostics found no installed emulator. Existing mobile unit tests and type checks passed; no new native UI tests were authored. Device follow-up requires an authorized Android device with USB debugging.
- No production traffic, deployed migration journals, query plans, native production bundles, or provider-configured aliases were inspected. Runtime savings follow verified request paths; latency/bundle gains are unmeasured.

**Original review evidence and cleanup plans**

The remaining sections describe the pre-cleanup revision. Paths for deleted files are historical evidence; original line numbers and analyzer counts do not describe the updated tree. The status table above records what actually changed and what remains.

**Scope and evidence**

Repository-wide inventory covered 1,422 tracked files across all four applications, five packages, deployment configuration, tests, assets, and documentation. The inventory contains 1,070 TypeScript/JavaScript-family files, approximately 111,000 lines including tests. Reference analysis covered the repository; manual inspection targeted entry points, reported candidates, workflow services, repositories, and large UI modules. This is a static review, not a claim that every source line received manual inspection.

Checks performed:

- `bun run check`: passed; 1,124 files checked.
- `bun run check-types`: passed, with seven workspace results supplied by Turbo's cache.
- Additional uncached unused-local/parameter checks passed for API, mobile, worker, and web using web's own compiler. The initial web attempt using the root TypeScript 7 compiler rejected its `baseUrl` configuration; the supported workspace compiler passed.
- `bun run knip:ci`: passed.
- Default Knip: five duplicate-export groups across three files; these are aliases, not five duplicate implementations. CI deliberately excludes this category.
- Knip with `--include-entry-exports`: 103 export and 99 type reports. These 202 reports are candidates, not 202 independently removable declarations: they include re-exports, declarations used internally, and externally consumed configuration exports.
- Production-mode Knip with entry exports: 29 file reports, 139 export reports, and 106 type reports. Test fixtures and operational scripts explain several file reports. These raw counts must not become deletion targets.
- Explicit cycle analysis: two cycles, discussed below.
- No unused dependency declarations reported by the configured default or production analyses. No confirmed unused local variables/imports remained in the additional compiler checks.

At the original review stage, no browser/device workflows, production access logs, database contents, query plans, or bundle profiles were inspected, and runtime tests were not executed. Implementation-stage validation is recorded above. Request-count estimates below follow the code paths; latency and bundle-size improvements are unmeasured. Framework entry files, package export maps, dynamic image paths, migrations, provider callbacks, and opt-in demos were considered when checking apparent dead code.

Priorities: **P1** = address avoidable runtime work first; **P2** = concrete source cleanup or consolidation; **P3** = conditional retirement/archive work. “Confirmed” means confirmed from this checkout, not proof that no external consumer exists.

**1. P1 — Duplicate authentication in guard chains**

Evidence: [auth.guard.ts](../apps/api/src/modules/auth/auth.guard.ts), lines 19 and 35; [storage-units.routes.ts](../apps/api/src/modules/storage-units/storage-units.routes.ts), lines 60, 85, and 117; [facilities.routes.ts](../apps/api/src/modules/facilities/facilities.routes.ts), line 379; [reservations.routes.ts](../apps/api/src/modules/reservations/reservations.routes.ts), lines 86–87; [facilities.guard.ts](../apps/api/src/modules/facilities/facilities.guard.ts), line 23.

- **Why unnecessary:** `requireRole` calls `requireAuth`, which always calls `auth.api.getSession`. Several routes invoke both guards. Combining `requireRole` and `requireFacilityAccess` also authenticates twice because the latter calls `requireAuth` again.
- **Impact:** remove one session-resolution call on each affected request. Actual database/Redis savings depend on the authentication provider's session behavior. Authorization rules can remain unchanged.
- **Risk:** removing the wrong guard could remove a role or facility check. A cached result must remain request-local.
- **Plan:** remove explicit `requireAuth` where `requireRole` already authenticates. For composed role/facility guards, reuse a successfully authenticated request or split authentication from the subsequent authorization checks. Verify unauthorized, inactive-user, wrong-role, and revoked-assignment cases.

**2. P1 — Payment transaction screens fan out one API request per rental**

Evidence: [use-customer-transactions.ts](../apps/web/src/features/rentals/use-customer-transactions.ts), line 30; [use-my-storage.ts](../apps/mobile/src/features/my-storage/use-my-storage.ts), line 46.

- **Why unnecessary:** both clients assemble a customer transaction feed by loading rentals and then calling `rentalPayments` separately for each rental. The feed's business purpose does not require this client-side join.
- **Impact:** for N loaded rentals, replace N payment requests plus rental-discovery requests with a bounded, paginated transaction-feed request. This also reduces loading/error aggregation code duplicated across clients.
- **Risk:** preserve payment visibility, currencies, refunds, ordering, deduplication, account scope, and complete pagination. Removing per-rental payment reads would break rental detail screens that still need them.
- **Plan:** implement one customer-scoped transaction-list query in the existing payments/rentals boundary, reuse the shared contract/client, migrate both feeds, and keep the existing detail endpoint for its distinct use case. Compare old/new results on mixed current/history rentals and multiple payment types.

**3. P1 — Mobile storage loads history and every rental's payments before those views are needed**

Evidence: [my-storage-navigator.tsx](../apps/mobile/src/navigation/my-storage-navigator.tsx), line 10; [use-my-storage.ts](../apps/mobile/src/features/my-storage/use-my-storage.ts), lines 9, 31, 36, and 46.

- **Why unnecessary:** `useMyStorage` receives only the owner, so it cannot adapt fetching to the selected view. It drains all current and history rental pages and enables payment queries while the user is merely viewing current rentals.
- **Impact:** current-storage startup can avoid history-page requests and all payment requests. Savings grow with account history. This remains useful even before the transaction-feed work in issue 2.
- **Risk:** cross-tab counts currently depend on fully loaded data. Do not replace complete counts with misleading partial totals; lazy loading can introduce deliberate loading states when switching views.
- **Plan:** pass the active view into the hook, enable history/payments on demand, and use bounded pagination. Return authoritative counts separately only if the UI needs them. Keep the repeated-cursor safeguard in the existing loader.

**4. P1 — Loading one task scans the staff task list**

Evidence: [flow5.ts](../packages/api-client/src/flow5.ts), line 136; [management/hooks.ts](../apps/web/src/features/facility-management/hooks.ts), line 131; [use-staff-workspace.ts](../apps/mobile/src/features/staff-api/use-staff-workspace.ts), line 100; [facility-tasks.routes.ts](../apps/api/src/modules/facility-tasks/facility-tasks.routes.ts).

- **Why unnecessary:** `findMine(id)` repeatedly requests pages of 100 tasks until it finds one ID. Web and mobile detail hooks repeat that work every 30 seconds. The backend has no matching task detail GET route.
- **Impact:** replace up to `ceil(total / 100)` list requests per lookup/poll with one authorized detail request. Remove the search loop and its coupling to list ordering/page size.
- **Risk:** the list currently provides an implicit access boundary. A detail endpoint must enforce active facility assignment and staff ownership, including revocation and historical tasks.
- **Plan:** add the required business read to the existing service/repository/routes, then replace `findMine` with a direct client call. Reuse list-cache data for initial rendering where appropriate; preserve server authorization.

**5. P2 — Unreachable facility-management tab branches**

Evidence: [management-workspace.tsx](../apps/web/src/features/facility-management/management-workspace.tsx), lines 76–87 and 145–176.

- **Why unnecessary:** normal initialization selects `facilities`; the only selectable tab labels are `facilities` and `types`. `membershipsOnly` initializes `memberships`. No state setter can select `offerings` or `units`, yet both branches and union members remain.
- **Impact:** remove two unreachable JSX branches, their parent-only wiring, and the unused `InventoryPanel` import from this file. Small runtime effect, clear reduction in misleading states.
- **Risk:** `FacilityOfferingsTable` is actively imported by the manager inventory screen; `InventoryPanel` is used elsewhere. The `memberships` branch is reachable and must stay.
- **Plan:** narrow `ManagementTab` to the actual states and remove only unreachable branches. Also remove the unused optional `onSelectFacility` prop from local `FacilityListTable` if its sole call remains unchanged. Do not delete the live components themselves.

**6. P2 — Exported contract families with no application consumers**

Evidence: `packages/contracts/src/facility-workspace.ts` (removed), its messages/types files; `packages/contracts/src/rental-documents.ts` (removed), its messages/types files; `packages/contracts/src/flow3-read.types.ts` (removed); [contracts/index.ts](../packages/contracts/src/index.ts), lines 12–26 and 46.

- **Why unnecessary:** these exports have no consumers implementing the described workflows. The old facility workspace now only returns 410 for retired support paths. Rental-document upload/issue schemas do not correspond to registered application functionality. Guest DTOs have no consumers.
- **Impact:** seven implementation/type/message files, approximately 176 lines, can be removed if there are no consumers outside this private monorepo. Remove their barrel exports and the `./rental-documents` package subpath together. This reduces misleading API surface more than runtime cost.
- **Risk:** confirm the contract package is not consumed by unpublished tools or external clients. The existing `rental-documents` cache-root string alone is not an implementation dependency. Do not infer that historical financial/document data should be dropped.
- **Plan:** remove these isolated contract families in a focused change, update package exports/barrels, and type-check every workspace. Handle the 410 compatibility route independently.

**7. P2 — Test-only backend DTO mappers duplicate or predate live serialization**

Evidence: `apps/api/src/modules/facilities/facilities.mapper.ts` (removed), `apps/api/src/modules/users/users.mapper.ts` (removed); live mappings in [facilities.routes.ts](../apps/api/src/modules/facilities/facilities.routes.ts), line 425, and [users.dto.ts](../apps/api/src/modules/users/users.dto.ts).

- **Why unnecessary:** the mapper files are referenced only by their own unit tests. Facility routes contain their own equivalent mapping; users use `toUserDto`. Tests of an unused mapping do not protect actual response behavior.
- **Impact:** approximately 158 lines across two implementation files and their two tests are candidates for removal/consolidation. Eliminate two apparent serialization authorities.
- **Risk:** the unused assignment mapper emits optional keys differently from the live helper. The unused user mapper returns a different shape from `toUserDto`; swapping them without checking fields would change the contract.
- **Plan:** either delete the unused mappers and test real responses, or wire one facility mapper into the routes and move the useful assertions to that implementation. Preserve actual response shapes. Remove the unused user mapper rather than replacing the live DTO with it.

**8. P2 — A parallel UI permission system is connected only to tests**

Evidence: `apps/web/src/features/auth/permissions.tsx` (removed); `apps/web/src/config/access-control/index.ts` (removed); [protected-area.tsx](../apps/web/src/components/layout/protected-area.tsx).

- **Why unnecessary:** `Can`, `hasPermission`, and the per-role permission registry have no application consumers outside their self-tests. Current screens use role checks and route layouts; backend authorization remains separate and active.
- **Impact:** about 141 lines across seven registry files, the wrapper, and two test files. Removing them eliminates a policy representation that can drift without affecting UI behavior.
- **Risk:** these are security-themed names, but they are not the current enforcement path. Keep route guards and backend authorization. Confirm no committed integration is about to adopt `Can`.
- **Plan:** remove this disconnected layer and its self-tests together. Keep tests for the actual protected areas, navigation, and backend permissions. If finer-grained UI capabilities are later required, introduce them with real consumers.

**9. P2 — Old admin mock state remains after migration to API-backed users**

Evidence: `apps/web/src/features/administration/use-admin-data.ts` (removed); `apps/web/src/features/administration/admin.mock.ts` (removed); [admin.helpers.ts](../apps/web/src/features/administration/admin.helpers.ts), lines 57–102; [use-admin-users-workspace.ts](../apps/web/src/features/administration/use-admin-users-workspace.ts); [workspace-isolation.test.tsx](../apps/web/src/features/operations/workspace-isolation.test.tsx); [frontend-audit.spec.ts](../apps/web/e2e/frontend-audit.spec.ts), line 314.

- **Why unnecessary:** no routed admin screen uses `useAdminData`. Its local seed, audit simulation, and several helper functions survive through tests. One browser test still intercepts `structuredClone` to expand that unused seed and expects the former export workflow.
- **Impact:** remove 181 lines in the hook/seed alone, plus unused mock-only helpers/types and obsolete assertions. More valuable: replace misleading coverage with tests of the actual API-backed screen.
- **Risk:** `admin.helpers.ts` and `admin.types.ts` also contain live definitions; deleting either whole file would break the application. Some mock types are still imported by the stale browser test.
- **Plan:** update the admin browser fixture to provide `/users` data and current actions. Remove the old admin half of the isolation test, mock hook/seed, mock mutation helpers, and types no longer used afterward. Keep the live helper functions and the independently active operations mock workflow.

**10. P2 — UI primitives maintained only by fixtures/self-tests**

Evidence: `apps/web/src/components/ui/radio-group.tsx` (removed); [mobile/app-ui.tsx](../apps/mobile/src/components/ui/app-ui.tsx), line 215; [workspace-ui.tsx](../apps/mobile/src/components/ui/workspace-ui.tsx), lines 30 and 91; [theme-fixture.tsx](../apps/mobile/e2e/theme-fixture.tsx); [app-ui-fixture.tsx](../apps/mobile/e2e/app-ui-fixture.tsx).

- **Why unnecessary:** web `RadioGroup`/`RadioGroupItem` are used only by their test. Mobile `ListItem`, `WorkspaceHeader`, and `WorkspaceTabs` are used only by showcase fixtures. The current staff UI uses `StaffWorkspaceHeader` instead.
- **Impact:** web's 78 implementation/test lines and roughly 115 lines of mobile component bodies, plus associated fixture-only wiring. No application feature is removed based on current references.
- **Risk:** showcase fixtures may be intentionally maintained as a component catalog. `workspace-ui.tsx` still exports live components such as `StatusPill`; `WorkspaceHeaderProps` is reused by the real staff header.
- **Plan:** remove the web primitive if there is no current consumer. Decide whether mobile showcases are a supported deliverable; either keep them explicitly as a catalog or remove only these component exports and their fixture sections. Preserve live exports and shared types.

**11. P2 — Uncalled legacy repository methods**

Evidence: [rentals.repository.ts](../apps/api/src/modules/rentals/rentals.repository.ts), line 86; [facility-assignments.repository.ts](../apps/api/src/modules/facilities/facility-assignments.repository.ts), line 162; [facility-assignments.service.test.ts](../apps/api/tests/units/facilities/facility-assignments.service.test.ts), line 41.

- **Why unnecessary:** `findRentalByBookingId` appears only in its declaration. `findAssignment` appears only in its declaration and an unused test-double property; the production authorization service uses other methods.
- **Impact:** small, approximately 20 lines and one mock field, but removes misleading available operations from repositories.
- **Risk:** check any reflection/string-based external usage before deletion. The historical `bookingId` data itself remains needed elsewhere.
- **Plan:** delete the two methods and stale mock field, then type-check and run assignment/rental regression tests. Keep booking history and the active reservation lookup.

**12. P2 — Overlapping and stale API-client surfaces**

Evidence: [api-client/index.ts](../packages/api-client/src/index.ts), lines 290–348, 403, and 454; [flow5.ts](../packages/api-client/src/flow5.ts), lines 47 and 117; [web/api.ts](../apps/web/src/lib/api.ts).

- **Why unnecessary:** `facilities.list` models a paginated object for a path whose current API returns an array; current runtime code instead uses `listActive` or management reads. `storageUnits.get/transition` duplicate `flow5.units` operations without current UI callers. `catalog` is used by old mock tests; `legacyReservations` and `legacyBookings` expose retired flows from the same factory used by live clients.
- **Impact:** shrink an approximately 690-line client entry point, reduce contradictory response types, and prevent accidental calls to nonexistent endpoints. Exact removable lines depend on the supported demo surface.
- **Risk:** some namespace methods are used by mocks/tests and the mock tracking screen. Object-factory methods are not fully classified by ordinary unused-export checks. A whole namespace must not be removed on the basis of one unused member.
- **Plan:** inventory calls per method, remove wrappers with no consumers, and keep one canonical wrapper for equivalent live reads/transitions. Move still-required legacy/demo methods into an explicit demo client. Remove dead contracts after migrating consumers, not before.

**13. P3 — Mobile contains a demo business backend that its current demo navigation cannot reach**

Evidence: [app-navigator.tsx](../apps/mobile/src/navigation/app-navigator.tsx), lines 23–68; [demo-service.ts](../apps/mobile/src/features/demo/demo-service.ts); [demo-policy.ts](../apps/mobile/src/features/demo/demo-policy.ts); [mobile-workflows.ts](../packages/api-client/src/mobile-workflows.ts); [use-app-session.ts](../apps/mobile/src/features/auth/use-app-session.ts).

- **Why unnecessary:** demo login routes to `AccountScreen`; customer/staff navigators explicitly require `!demo`. Runtime calls to `mobileWorkflows` are workspace/login/logout. The factory still exposes booking rescheduling/cancellation, rental requests, inspections, handover, and return-report operations that no current screen invokes.
- **Impact:** potentially hundreds of lines of business simulation, old contracts, and seed data can be retired or moved out of application source. The demo feature directory alone is approximately 1,050 lines; that entire number is not a deletion estimate because demo authentication remains active.
- **Risk:** standalone tests or demos may intentionally exercise this simulator. Do not remove the active demo session/authentication path, SecureStore handling, or all shared mobile contracts blindly.
- **Plan:** establish the supported demo scope. If it is authentication-only, trim the unused domain endpoints, workflow methods, and seed/contracts incrementally. If the simulator is intentional, move it to explicit test/demo infrastructure and document its consumers.

**14. P3 — Retired web booking flows and mock UI remain coupled to normal client entry points**

Evidence: [app-providers.tsx](../apps/web/src/components/providers/app-providers.tsx), line 12; [booking-tracking-screen.tsx](../apps/web/src/features/booking-tracking/booking-tracking-screen.tsx), line 31; [operations-workspace.tsx](../apps/web/src/features/operations/operations-workspace.tsx); [mocks](../apps/web/src/mocks/install-mock-api.ts).

- **Why unnecessary:** live authentication, operations pages, and tracking code retain static imports and branches for an offline prototype, including contracts for retired endpoints. Production tracking redirects to reservations. This creates ongoing maintenance even where a production build can eliminate branches.
- **Impact:** the web mock tree is approximately 3,094 lines and tracking feature approximately 830 lines, including tests. Retiring or isolating them can substantially simplify the source graph; actual shipped-bundle savings require measurement.
- **Risk:** `NEXT_PUBLIC_API_MODE=mock` is an explicit supported path and default Playwright configuration uses it. Tree shaking means source size is not a bundle-size measurement. Deleting all mocks would remove real test/demo value.
- **Plan:** retain narrow HTTP fixtures for current workflows. Isolate the offline app behind its own entry or conditional loading, or retire it only after replacing dependent tests. Preserve the public tracking URL's redirect for old links even if its old UI is removed.

**15. P2 — Obsolete guest-tracking test infrastructure outlived its API**

Evidence: `apps/web/e2e/booking-tracking.spec.mts` (removed), line 6; `apps/api/tests/fixtures/booking-tracking.ts` (removed); `packages/shared/src/booking-access.ts` (removed), line 28; [worker/mail.service.ts](../apps/worker/src/mail/mail.service.ts), line 16; [api/app.ts](../apps/api/src/app.ts).

- **Why unnecessary:** the E2E suite is opt-in and directs developers to nonexistent `playwright.tracking.config.ts`. It expects legacy magic-link exchange and tracking APIs that are not registered. `createBookingTrackingLink` is referenced only by this fixture. The worker suppresses `TRACKING_LINK` snapshots and uses only `BOOKING_ACCESS` constants from that helper module.
- **Impact:** remove an obsolete suite/fixture and a substantial unused crypto/link-generation helper after checking consumers. Remove a misleading path to supposedly exercising current production behavior.
- **Risk:** `BOOKING_ACCESS.magicTtl` is still used by the mail worker; the module cannot be deleted wholesale. Encrypted queued payload handling and compatibility with existing mail jobs are distinct live concerns.
- **Plan:** retire the obsolete suite/fixture or rewrite it around current authenticated reservation tracking. Remove unused tracking-link functions/types and keep required mail retention constants in an appropriate shared location. Preserve legacy-job suppression and payload compatibility until queues are reconciled.

**16. P3 — Duplicated storage API aliases and maintenance commands**

Evidence: [api/app.ts](../apps/api/src/app.ts), lines 89–90; [storage-units.routes.ts](../apps/api/src/modules/storage-units/storage-units.routes.ts), lines 73–139; [flow5.ts](../packages/api-client/src/flow5.ts), line 129.

- **Why unnecessary:** the complete storage route set is registered under both `/api/storage-units` and `/api/units`. Status PATCH and transition POST implement the same maintenance/available transition and response handling. Current UI uses the transition client and the `/storage-units` prefix.
- **Impact:** remove one duplicated route registration and potentially one redundant maintenance handler/schema/client surface. Main gains are a clearer API and less documentation/testing work; business persistence remains the same.
- **Risk:** old applications or external integrations may call aliases. This repository is not traffic evidence. Do not apply the same assumption to the SePay webhook/IPN aliases, which may be provider-configured.
- **Plan:** choose a canonical storage contract, check route traffic and deployed client versions, mark old endpoints deprecated, then remove after a compatibility window. Consolidate shared handler logic immediately if aliases must remain.

**17. P2 — Three booking-creation URLs mount the same screen**

Evidence: [customer/booking/new](../apps/web/src/app/customer/booking/new/page.tsx), [customer/bookings/new](../apps/web/src/app/customer/bookings/new/page.tsx), [customer/reservations/new](../apps/web/src/app/customer/reservations/new/page.tsx); [customer.routes.ts](../apps/web/src/config/routes/customer.routes.ts), line 8.

- **Why unnecessary:** all three route files render `NewReservationScreen`, while the route constant still chooses the singular booking URL. This leaves multiple apparent canonical locations for one workflow.
- **Impact:** small code reduction, simpler link generation and route tests, fewer places for query-string behavior to diverge.
- **Risk:** existing bookmarks, deep links, and incoming query parameters. Retaining small redirect files can be valuable compatibility code.
- **Plan:** select one canonical route and update internal links. Turn the other two into query-preserving redirects. Remove redirects only with evidence that old URLs no longer matter.

**18. P2 — Cache keys, pagination loaders, and invalidation logic are fragmented**

Evidence: [use-customer-home.ts](../apps/mobile/src/features/customer-home/use-customer-home.ts), line 38; [use-my-storage.ts](../apps/mobile/src/features/my-storage/use-my-storage.ts), line 31; [customer-bookings.hooks.ts](../apps/web/src/features/bookings/customer-bookings.hooks.ts), line 58; [rentals/hooks.ts](../apps/web/src/features/rentals/hooks.ts); [management/hooks.ts](../apps/web/src/features/facility-management/hooks.ts), line 154; [check-in/hooks.ts](../apps/web/src/features/check-in/hooks.ts).

- **Why unnecessary:** the same underlying resources are loaded through separately named caches and repeated all-page loaders. `useCustomerBooking` retrieves all customer appointments inside a 10-second detail poll rather than composing with a reusable appointments query. Management writes invalidate seven broad resource prefixes on settlement, including failures.
- **Impact:** share genuinely identical reads, remove repeated all-page retrieval, and reduce unrelated refetches. Benefits depend on which screens are mounted/cached; similar query functions with different page sizes are not automatically interchangeable.
- **Risk:** keys must include actor identity, filters, pagination, and result shape. Broad invalidation may currently compensate for cross-module effects. Removing it prematurely can show stale inventory or pricing.
- **Plan:** define small domain-owned key/query factories, reuse identical appointment/assignment reads, and document which resources each successful mutation affects. Replace blanket invalidation per workflow. Preserve identity boundaries and intentionally different paginated/all-record result shapes.

**19. P2 — Global operating-hours checks retain a fake facility parameter and repeat reads**

Evidence: [facilities.service.ts](../apps/api/src/modules/facilities/facilities.service.ts), line 55; [appointments.service.ts](../apps/api/src/modules/appointments/appointments.service.ts), lines 156–160.

- **Why unnecessary:** `assertCheckInWithinOperatingHours(_facilityId, ...)` ignores the facility and queries global settings each time. Scheduling checks both slot boundaries separately, loading the same hours twice.
- **Impact:** remove a misleading parameter and save one global-hours read during that scheduling path. Make the global policy explicit and easier to test.
- **Risk:** maintain exact opening/closing boundary behavior, Vietnam timezone handling, and development-mode exceptions. Do not cache hours across requests indefinitely if settings can change.
- **Plan:** load hours once for the operation, validate both boundaries against those values with one pure helper, and remove the unused facility argument from callers. Keep transaction-sensitive validation in the appropriate workflow scope.

**20. P2 — Client/server list paths fetch everything to display one page**

Evidence: [use-admin-users-workspace.ts](../apps/web/src/features/administration/use-admin-users-workspace.ts), lines 18–30 and subsequent `filter`/`slice`; [facilities.service.ts](../apps/api/src/modules/facilities/facilities.service.ts), line 24; [management/hooks.ts](../apps/web/src/features/facility-management/hooks.ts), line 32.

- **Why unnecessary:** the admin UI drains all user pages, filters locally, and displays ten users. The facility catalog service retrieves all catalog rows, then searches, sorts, and slices in memory. Other `allPages` loaders also serve paginated tables and selectors.
- **Impact:** reduce work from full dataset size to the requested page for growing users/catalogs, and remove client-side pagination plumbing where the backend should own it. With today's small facility seed, catalog performance impact is modest.
- **Risk:** dashboard totals, exports, selector completeness, locale sorting, and current array response contracts. Some small selector datasets legitimately benefit from one cached full list.
- **Plan:** prioritize users and table views; reuse existing query filters and add shared page metadata where needed. Move catalog predicates/sort/pagination into the repository after preserving exact behavior. Keep full-list loading only for demonstrated small-list or export requirements.

**21. P2 — Staff notifications reimplement an existing reconnect lifecycle**

Evidence: [use-staff-task-notifications.ts](../apps/web/src/features/facility-flow/use-staff-task-notifications.ts), line 34; [notification-stream.ts](../packages/api-client/src/notification-stream.ts); [customer-appointments-realtime.tsx](../apps/web/src/features/appointments/customer-appointments-realtime.tsx); [mobile/use-work-realtime.ts](../apps/mobile/src/features/realtime/use-work-realtime.ts).

- **Why unnecessary:** the staff hook manually maintains sockets, retry timers, attempts, denied state, and connection cleanup while customer web and mobile already use the shared notification stream.
- **Impact:** remove repeated connection lifecycle code and maintain retry/cleanup fixes in one implementation. Staff event parsing, toast deduplication, and invalidation still provide value.
- **Risk:** the staff hook exposes connection status/manual retry and handles legacy task-assignment events; the shared utility does not currently expose every status callback. Preserve denial behavior and avoid duplicate sockets/toasts.
- **Plan:** extend the existing stream only with the status hooks required by this consumer, migrate transport lifecycle, and keep staff-specific event handling in the feature. Exercise offline/resume, denied connections, unmount, and reconnect cases.

**22. P2 — Duplicate utilities have inconsistent semantics**

Evidence: [lib/cn.ts](../apps/web/src/lib/cn.ts), [lib/utils.ts](../apps/web/src/lib/utils.ts); [lib/format.ts](../apps/web/src/lib/format.ts); [operations.utils.ts](../apps/web/src/features/operations/operations.utils.ts); [admin.helpers.ts](../apps/web/src/features/administration/admin.helpers.ts), line 102; [reports.calculation.ts](../apps/api/src/modules/reports/reports.calculation.ts), line 28.

- **Why unnecessary:** two functions named `cn` mean different things: one concatenates classes, the other resolves Tailwind conflicts. Date/currency formatting and CSV quoting are repeatedly implemented, and an admin CSV helper is used only by its own test.
- **Impact:** remove the test-only helper and reduce repeated formatting/escaping behavior. Clear utility semantics lower the risk of future style and export regressions. Byte savings are small.
- **Risk:** replacing concatenation with Tailwind merging can alter visual precedence. Formatters differ on invalid/null input, locale, and supported currencies. CSV formula escaping differs for numeric-looking strings; do not lose injection protection while consolidating.
- **Plan:** explicitly name concatenation versus conflict-merging behavior, or standardize after checking call sites. Reuse implementations for identical formatting policies while retaining intentional wrappers. Keep shared pure CSV escaping small; browser download and HTTP response delivery should remain separate.

**23. P2 — UI modules mix distinct responsibilities and contain a real import cycle**

Evidence: [management-workspace.tsx](../apps/web/src/features/facility-management/management-workspace.tsx), approximately 1,907 lines; [operations-reports-hub.tsx](../apps/web/src/features/operations/components/operations-reports-hub.tsx), approximately 991 lines; the cycle between [check-in/hooks.ts](../apps/web/src/features/check-in/hooks.ts), line 6, and [use-dispatch.ts](../apps/web/src/features/facility-flow/use-dispatch.ts), line 7.

- **Why unnecessary:** the management file mixes global facility editing, type catalog management, facility offerings, and memberships. The reports hub contains separate rentals/reconciliation/refund workflows. The hook cycle exists because a query-key object lives in the same module as hooks that import dispatch loading.
- **Impact:** smaller responsibility boundaries and lower change conflicts; remove the web import cycle with a small dependency fix. Splitting alone does not reduce total code or guarantee a smaller bundle.
- **Risk:** do not add a new abstraction layer merely to shorten files. Component remounts, state lifetime, role boundaries, and client-module boundaries can change during extraction.
- **Plan:** delete issue 5's unreachable branches first. Extract the query-key definition into a small domain key module to break the cycle. Split management/report code only along the already distinct workflows, keeping orchestration close to each screen. The second detected cycle is database foreign-key schema wiring (`payments → debts → return-settlements → payments`); inspect it separately and preserve the lazy FK callbacks rather than treating it as deletable domain code.

**24. P2 — “Remember me” form state has no effect**

Evidence: [login-form.tsx](../apps/web/src/features/auth/login-form.tsx), lines 36, 82–88, and its `remember` field; [api-client/index.ts](../packages/api-client/src/index.ts), login implementation.

- **Why unnecessary:** the form collects and validates `remember`, but submission sends only email/password. Nothing in the current client uses that choice to change the session policy.
- **Impact:** remove unused form state, validation, and a misleading control, or make the control serve an explicitly confirmed session behavior. Runtime performance gain is negligible; user-facing clarity improves.
- **Risk:** session persistence affects security and user expectations. Do not invent a new persistence policy as a cleanup shortcut.
- **Plan:** confirm whether selectable persistence is required. If not, remove the field/control and its copy; otherwise wire it to the supported authentication policy and verify both session lifetimes. Preserve the existing default until the policy is decided.

**25. P2 — Critical retirement documentation links point to a missing file**

Evidence: [README.md](../README.md), line 165; [backend-patterns.md](backend-patterns.md), line 58; [web-patterns.md](web-patterns.md), line 75; [db-diagram.md](db-diagram.md), line 8. All link to absent `docs/booking-retirement.md`.

- **Why unnecessary:** repeated references to a nonexistent runbook obscure the deployment and history constraints that are most important before cleanup.
- **Impact:** small documentation change with substantial operational value: a reviewer can distinguish retired APIs from retained data and required migration helpers.
- **Risk:** casually replacing links could lose the intended cutover instructions. Do not reconstruct production reconciliation requirements by guessing.
- **Plan:** restore the authoritative runbook from history if available, or consolidate verified cutover instructions into the existing database/workflow document and update every link. Include retained-table, migration, queued-job, and old-client constraints.

**26. P3 — Unjournaled migration artifacts and unused binary assets need an archive decision**

Evidence: [migration journal](../packages/database/drizzle/meta/_journal.json); [migrate.ts](../packages/database/src/migrate.ts); [mobile app config](../apps/mobile/app.json).

- **Why unnecessary:** six tracked SQL files are absent from the current journal: `0000_past_lifeguard.sql`, `0001_absurd_tag.sql`, `0002_tired_puppet_master.sql`, `0003_complex_susan_delgado.sql`, `0004_daily_darwin.sql`, and `0005_clumsy_dark_beast.sql`. Their numbered names conflict visually with the active migration chain. Separately, static reference checks found no tracked text/config references to mobile `assets/logo/logo-with-text.png`, `assets/screens/forget-password.png`, `assets/screens/verify-email.png`, or `assets/splash-icon.png`.
- **Impact:** the six SQL files total 114 lines, about 6.5 KB. The four image candidates total 2,288,402 bytes (about 2.18 MiB). Moving obsolete review/design captures out of application trees is a further optional repository-size improvement; mobile `.impeccable` and `.stitch` together occupy about 5.17 MB, but those can contain intentional design evidence.
- **Risk:** old deployments, disaster recovery procedures, database-stored URLs, generated references, or design workflows may depend on artifacts. Migration numbering alone does not prove safe deletion. Native assets are not necessarily bundled if unreferenced, and public/static filenames may have external consumers. Repository deletion does not reclaim old Git history.
- **Plan:** audit deployed migration journals and recovery requirements before proposing any migration-file archive; preserve the active generated chain and never rewrite generated SQL. Treat migration cleanup as its own approved database-maintenance change. For images, validate configuration, platform builds, stored URLs, and design ownership before deletion. Archive intentional design evidence outside shipped/public assets rather than removing it indiscriminately.

**Deletion exclusions**

- `bookings`, `login_history`, and `user_activity_logs` are explicitly retained archives. [db-diagram.md](db-diagram.md), lines 3–10 and 295–302, documents this. Lack of new writes is not proof that historical records have no value.
- Keep payments, payment-provider events, refund records, debts, settlements, audit/history records, and their constraints. They represent distinct financial facts and idempotency/recovery needs.
- Keep active migrations and `rental-reset-migration.ts` / `migrate-bookings-to-reservations.ts`: migration/operational entry points explain their apparent lack of application imports.
- Keep `src/scripts/*.ts` until their one-time operational purpose is verified complete across environments. Being an explicit script entry is different from application dead code.
- Keep configured native icon/font assets and dynamically selected web images. For example, `unit-${index}.png` and `landing/${index}.png` are live references that filename-only searches would miss.
- Keep necessary provider callbacks, compatibility redirects, legacy-mail suppression, and queued-payload compatibility until their external lifecycle ends.
- The documented Redis service methods `setIfAbsent` and `getTtl` currently have test-only callers, but they form a small, explicit service interface. Their possible deletion is lower value than the disconnected workflow implementations above.
- No package dependency is recommended for immediate deletion. Several dependencies participate in framework configuration, peer requirements, or demo/test paths. Reassess them after removing consumers; regenerate the lockfile normally and build each affected platform.

**Recommended cleanup sequence**

1. Remove the uncalled repository methods, unreachable tab branches, isolated obsolete contracts, test-only mappers, unused permission registry, and unused web primitive in small commits. The identified whole-file groups for contracts, mappers, permissions, radio group, and old admin hook/seed total about 734 lines across 25 files, before partial-file cleanup; retiring admin tests and mock types requires the fixture work described above. This is a scoped candidate estimate, not blanket deletion approval.
2. Repair stale admin/tracking test infrastructure so validation exercises current workflows. Resolve the missing retirement runbook before any data/migration retirement.
3. Eliminate duplicate authentication and operating-hours reads. Introduce direct task detail reads and demand-driven mobile storage loading. Verify route behavior and access control using existing regression infrastructure.
4. Add a customer transaction feed, normalize genuinely identical queries, and narrow mutation invalidation. Measure request counts on accounts with long history and many tasks.
5. Consolidate the live API-client surface and utilities, break the web hook cycle, then extract existing business responsibilities from the large UI files without changing API or transaction boundaries.
6. Make explicit product/operations decisions about offline demos, old URL aliases, binaries, and unjournaled migration artifacts. Preserve records, callbacks, migration history, and compatibility code until evidence supports retirement.

After each source cleanup, run formatting/lint, workspace type checks, default Knip CI, and the relevant existing unit/integration suites. Add entry-export and production-mode reports as reviewed signals; configure real operational entry points and exclude known tooling false positives before making them hard gates. Do not enable automatic deletion on the raw analyzer results. For data-access and authorization changes, use the isolated database regressions; for visual changes, check the affected browser/device workflows. This sequence describes the original recommendation; implementation and regression coverage are recorded in the status table above.
