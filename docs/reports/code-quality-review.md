**Code quality and maintainability review**

Reviewed commit: `bbdd8d4`. Date: 2026-11-03. Scope: all nine workspaces, repository configuration, test entrypoints, and migration documentation. Static analysis covered the whole configured source graph; manual review focused on reported candidates and active data flows. This is a review, not an exhaustive proof of runtime reachability. This paragraph and the findings below describe the review baseline. The subsequent cleanup removes confirmed unused implementations, narrows unused exports/types, removes `mongoose` and `expo-sharing`, and registers the active string-launched E2E fixture in Knip. API deprecations, query changes, external-consumer contract removals, and the two Flow 1 fixture deletions remain deferred.

The best first cleanup is the abandoned administration editor, unused backend methods, and `mongoose`. The highest runtime savings are in transaction history and repeated facility/task fetches. Preserve the booking archive, migration utilities, financial records, and working offline demos.

**Cleanup validation (subsequent implementation)**

- Removed 985 net lines across 64 tracked files, including five orphan files, nine uncalled backend methods, unused UI/helper implementations, and unnecessary exports/types.
- Removed `mongoose` and `expo-sharing`; updated `bun.lock` with Bun.
- `bun run check`, `bun run check-types` (eight tasks), API build, and `git diff --check` pass.
- Root tests completed with the non-web tasks passing; service-dependent tests skipped where their test services were not configured. The concurrent web run had eight failures. The two-worker rerun passed 148/149 tests, with one registration test exceeding its five-second timeout. Rerunning that registration file alone passed all five tests. The whole-suite run is therefore not reported as green.
- Final `bun knip` has zero unused exports, exported types, or dependencies. It still exits 1 for two retained Flow 1 fixtures, the inferred `expo-updates` dependency, and five intentional duplicate-export groups. No blanket ignores were added.
- The expanded package-entry inventory and behavior-changing refactors remain review backlog, not completed work.

**Evidence and limits**

| Check | Result |
| --- | --- |
| `bun knip` | Exit 1: 8 unused files, 1 unused dependency, 1 unlisted dependency, 43 unused exports, 37 unused exported types, 5 duplicate-export groups |
| `bun knip --include-entry-exports --reporter json` | Exit 1: same file/dependency findings; 137 unused exports and 133 unused exported types, including package entrypoints |
| `bun knip --cycles --reporter json` | Two import cycles: check-in/dispatch hooks and payment/debt/settlement schema |
| `bun run check` | Passed: 1,001 files checked, no fixes |
| `bun run check-types` | Passed: eight tasks; all results came from the existing Turbo cache |
| Manual checks | Semble navigation, caller searches, source inspection, exact repeated-block scan, and inspection of Knip's installed Expo plugin |

No database queries, migrations, browser workflows, native builds, or application tests were executed. Query/request reductions below are derived from code paths; latency and bundle-size improvements were not measured. Knip does not establish that an HTTP endpoint has no external consumers, and import reachability does not expose every unused object or class member.

Seven of the eight reported unused files remain removal candidates: **429 source lines** before related helpers/types are pruned. The eighth file, `customer-rental-live-server.ts`, is a confirmed false positive. The two Flow 1 fixture candidates still require an operational-use check before deletion. Counts from the two Knip modes overlap; do not add them together or interpret every unused export as a deletable declaration.

Knip normally excludes unused exports in entry files; that explains the larger second scan. See the [Knip configuration reference](https://knip.dev/reference/configuration) for `includeEntryExports`.

Priority: **P1** means the first cleanup batch or a concrete active-path cost; **P2** means a follow-up refactor; **P3** means a smaller maintainability improvement. Confidence describes the evidence for the finding, not permission to break compatibility. Effort estimates assume one engineer familiar with the repository and exclude release waiting periods.

**01. Remove the unused Mongoose dependency — P1, high confidence**

Evidence: [API package.json:33](/home/owen/Projects/metastorage/apps/api/package.json:33), [mongo-plugin.ts:1](/home/owen/Projects/metastorage/apps/api/src/common/database/mongo-plugin.ts:1).

- Why unnecessary: Knip reports `mongoose`; repository-wide caller searches find no imports. The running MongoDB integration uses `@fastify/mongodb` and its MongoClient.
- Impact: one fewer direct runtime dependency and potentially fewer transitive packages. Exact disk/image savings depend on lockfile sharing. No application behavior should change.
- Risk: undocumented external scripts could use the workspace dependency. Removing Mongoose must not remove `@fastify/mongodb` or MongoDB itself; activity logs use them.
- Plan: remove `mongoose` from the API manifest, regenerate the Bun lockfile through Bun, then validate the API build and activity-log checks. Effort: under half a day.

**02. Delete the superseded administration editor and its exclusive helpers — P1, high confidence**

Evidence: [admin-editor.tsx:11](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin-editor.tsx:11), [use-admin-editor.ts:18](/home/owen/Projects/metastorage/apps/web/src/features/administration/use-admin-editor.ts:18), [admin-parts.tsx:20](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin-parts.tsx:20), [admin.schema.ts:5](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin.schema.ts:5). The active replacement is [admin-user-editor.tsx:22](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin-user-editor.tsx:22).

- Why unnecessary: neither the old editor nor its hook is reachable. They implement an older combined role/status/facility-assignment review flow. `AdminBadge`, `AdminTable`, `AdminDrawer`, `AdminSnapshotView`, `AdminUserDraftSchema`, and `AdminAssignmentDraftSchema` have no reachable consumers.
- Impact: delete 244 lines in the two whole files, plus exclusive components, schemas, props, and messages discovered after that deletion. This removes a misleading second administration workflow.
- Risk: `admin-parts.tsx`, `admin.schema.ts`, and `admin.types.ts` contain active declarations. Keep `AdminDialog`, `AdminUserEditSchema`, and types needed by the current editor. Mock administration data still has other consumers.
- Plan: remove the two files; prune exclusive symbols; rerun Knip to expose the next layer; verify account role/status flows and facility assignment screens. Effort: half a day.

**03. Retire the disconnected Flow 1 fixture entrypoints — P2, medium-high confidence**

Evidence: [flow1-server.ts:1](/home/owen/Projects/metastorage/apps/api/tests/fixtures/flow1-server.ts:1), [flow1-web.ts:1](/home/owen/Projects/metastorage/apps/api/tests/fixtures/flow1-web.ts:1).

- Why unnecessary: Knip reports both files, and literal-path searches find no runner/configuration references. They provide a separate provider-stub server and browser seed setup.
- Impact: 172 lines removed and fewer competing ways to initialize E2E fixtures. No production runtime benefit.
- Risk: engineers may invoke these files manually or from scripts outside this checkout.
- Plan: check team/runbook use, replace any remaining manual invocation with maintained E2E runners, then remove both files. Do not confuse these with the active `customer-rental-live-server.ts`. Effort: under half a day after the usage check.

**04. Remove three disconnected scaffolding files — P2, high confidence**

Evidence: [config/index.ts:1](/home/owen/Projects/metastorage/apps/api/src/config/index.ts:1), [toast.messages.ts:1](/home/owen/Projects/metastorage/apps/web/src/components/ui/toast.messages.ts:1), [facility-overview.messages.ts:1](/home/owen/Projects/metastorage/apps/web/src/features/facility-flow/facility-overview.messages.ts:1).

- Why unnecessary: the config barrel only re-exports `env`, while callers import it directly. The two message objects have no consumers; the facility overview messages describe an old booking summary.
- Impact: three fewer files and 13 fewer lines; small but clear navigation improvement.
- Risk: do not delete `config/env.ts`, the active toast implementation, or nearby active messages.
- Plan: delete these files and run lint/type checks. No new tests are needed for the deletion itself. Effort: minutes.

**05. Delete unused backend export implementations — P2, high confidence**

Evidence: [auth.guard.ts:33](/home/owen/Projects/metastorage/apps/api/src/modules/auth/auth.guard.ts:33) (`optionalAuth`), [facilities.access.ts:32](/home/owen/Projects/metastorage/apps/api/src/modules/facilities/facilities.access.ts:32) (`getFacilityListScope`), [facilities.guard.ts:18](/home/owen/Projects/metastorage/apps/api/src/modules/facilities/facilities.guard.ts:18) (`getFacilityContext`), [lifecycle-notifications.messages.ts:21](/home/owen/Projects/metastorage/apps/api/src/modules/notifications/lifecycle-notifications.messages.ts:21) (`lifecycleExpiryDetail`).

- Why unnecessary: no current callers use these implementations. The list-scope helper duplicates branches of the active access-scope helper while supporting an unused public-scope path. The unused `PaymentGateway`/`GatewayPaymentResult` types in `payments.types.ts` also describe a speculative token-charging interface with no current implementation or consumer; the active payment workflow uses concrete SePay checkout operations.
- Impact: smaller authorization/message surface; no current-request savings because the functions are already unused.
- Risk: authorization code nearby is active. Preserve `requireAuth`, `requireRole`, `requireFacilityAccess`, and assignment checks. A type used inside the same file can remain private.
- Plan: delete these four implementations, prune exclusive imports/types, and run existing authorization checks. Effort: under half a day.

**06. Delete nine uncalled class methods missed by the default export report — P1, high confidence**

Each method name appears only at its declaration in application/test source. These are member-level findings from additional caller searches, not Knip's 43-export count.

| Method | Location | Why it provides no current value |
| --- | --- | --- |
| `deactivateAssignment` | [facility-assignments.repository.ts:296](/home/owen/Projects/metastorage/apps/api/src/modules/facilities/facility-assignments.repository.ts:296) | Active service uses `deactivateAssignmentWithWorkCheck`; this alternative bypasses that workflow. |
| `findInspectionTask` | [inspections.repository.ts:351](/home/owen/Projects/metastorage/apps/api/src/modules/inspections/inspections.repository.ts:351) | No caller consumes the locked task lookup. |
| `findInspectionByTask` | [inspections.repository.ts:355](/home/owen/Projects/metastorage/apps/api/src/modules/inspections/inspections.repository.ts:355) | No caller consumes this lookup. |
| `findHandoverRental` | [rentals.service.ts:102](/home/owen/Projects/metastorage/apps/api/src/modules/rentals/rentals.service.ts:102) | Unused booking-era service wrapper. |
| `getOpeningHour` | [system-settings.service.ts:26](/home/owen/Projects/metastorage/apps/api/src/modules/system-settings/system-settings.service.ts:26) | No caller uses this convenience method. |
| `findActiveBookingHandover` | [facility-tasks.repository.ts:140](/home/owen/Projects/metastorage/apps/api/src/modules/facility-tasks/facility-tasks.repository.ts:140) | Unused booking-reference handover path. |
| `createBookingHandover` | [facility-tasks.repository.ts:172](/home/owen/Projects/metastorage/apps/api/src/modules/facility-tasks/facility-tasks.repository.ts:172) | Unused booking-reference task creation. Active tasks use appointments. |
| `findDayEnd` | [check-in-slots.repository.ts:11](/home/owen/Projects/metastorage/apps/api/src/modules/appointments/check-in-slots.repository.ts:11) | Unused aggregate over slots. |
| `incrementWithExpiry` | [redis.service.ts:13](/home/owen/Projects/metastorage/apps/api/src/common/redis/redis.service.ts:13) | No feature or test uses this Redis operation. |

- Impact: removes nine unsupported implementation paths and their exclusive imports; no executed SQL is eliminated because these methods are uncalled.
- Risk: dynamic consumers outside the checkout are not proven absent. Keep active assignment revocation and historical booking persistence. Deleting a service wrapper does not automatically make its repository method unused.
- Plan: delete the methods in a small batch, prune newly unused imports, type-check, and run existing assignment/check-in/inspection tests. Effort: half a day.

**07. Prune unused UI variants inside active component files — P2, high confidence**

Evidence: [avatar.tsx:20](/home/owen/Projects/metastorage/apps/web/src/components/ui/avatar.tsx:20), [card.tsx:37](/home/owen/Projects/metastorage/apps/web/src/components/ui/card.tsx:37), [chart.tsx:250](/home/owen/Projects/metastorage/apps/web/src/components/ui/chart.tsx:250), [dialog.tsx:51](/home/owen/Projects/metastorage/apps/web/src/components/ui/dialog.tsx:51), [operational.tsx:79](/home/owen/Projects/metastorage/apps/web/src/components/ui/operational.tsx:79), [table.tsx:88](/home/owen/Projects/metastorage/apps/web/src/components/ui/table.tsx:88).

- Why unnecessary: `AvatarImage`, `CardFooter`, `ChartLegend`, `ChartLegendContent`, `DialogDescription`, `DialogFooter`, `OperationalSectionHeader`, `TableFooter`, `operationalToolbar`, and `operationalField` have no current consumers. Administration-specific unused components are covered in 02.
- Impact: reduces the supported design-system surface. The unused chart legend implementation alone spans about 55 lines. Production byte savings may be small because of tree shaking.
- Risk: these are fragments of active files; deleting whole files would break current UI. `ChartStyle` is used inside `ChartContainer`: remove its export only, not its implementation. Shared legend/tooltip helpers may still be needed.
- Plan: delete unused variants, retain used primitives, and type-check/build the web workspace. Effort: half a day.

**08. Remove obsolete frontend helpers and file-sharing capability — P2, high confidence**

Evidence: [returns.messages.ts:223](/home/owen/Projects/metastorage/apps/web/src/features/returns/returns.messages.ts:223), [staff-work.data.ts:14](/home/owen/Projects/metastorage/apps/web/src/modules/facility-staff/staff-work.data.ts:14), [hooks.ts:183](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:183), [admin.helpers.ts:119](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin.helpers.ts:119), [customer-native.ts:39](/home/owen/Projects/metastorage/apps/mobile/src/features/customer-api/customer-native.ts:39), [use-staff-workspace.ts:20](/home/owen/Projects/metastorage/apps/mobile/src/features/staff-api/use-staff-workspace.ts:20).

- Why unnecessary: four return-label functions, `bookingWork`, `useManagedFacility`, `downloadCsv`, `sharePrivateFile`, and the `staffDate` alias have no current callers. The native helper is the only importer of `expo-sharing`.
- Impact: removes old display/workflow branches, and allows removing `expo-sharing` after the helper/import are removed. No measured native bundle-size claim is made.
- Risk: keep `clearPrivateFiles`, `expo-file-system`, active staff date helpers, and `csvCell` where still used. Native package removal needs build verification. `passingChecklist` in the inspection fixture is another small unused constant, not a reason to delete the fixture.
- Plan: remove these symbols, rerun Knip for dependency fallout, and check native configuration/build if removing `expo-sharing`. Effort: half a day plus native build time.

**09. Narrow exports and types without deleting live implementations — P3, high confidence**

Evidence: the complete baseline inventory below. Examples: [permissions.tsx:7](/home/owen/Projects/metastorage/apps/web/src/features/auth/permissions.tsx:7), [integration-utils.ts:3](/home/owen/Projects/metastorage/apps/web/src/features/returns/integration-utils.ts:3), [hooks.ts:13](/home/owen/Projects/metastorage/apps/web/src/features/facilities/hooks.ts:13).

- Why unnecessary: external exports of `usePermission`, `readWholeVnd`, query-key objects, `normalizeLookup`, and `inspectionKey` are unused, but the declarations are used in their own files. Many of the 37 reported types are also used locally.
- Impact: smaller public interfaces and less coupling. Type/export-only cleanup generally has no runtime benefit.
- Risk: automated declaration deletion breaks live code. For example, `Can` calls `usePermission`, `money` calls `readWholeVnd`, and facility hooks use their key factory. `GlobalFacilityScope` remains part of local types.
- Plan: remove unused `export` modifiers/re-exports; delete declarations only after checking local and external uses. Clean types after removing dead implementations to avoid editing them twice. Effort: half a day.

**10. Retire disconnected contract families — P2, high confidence within this repository**

Evidence: [rental-documents.ts:1](/home/owen/Projects/metastorage/packages/contracts/src/rental-documents.ts:1), [facility-workspace.ts:1](/home/owen/Projects/metastorage/packages/contracts/src/facility-workspace.ts:1), [contracts package.json:17](/home/owen/Projects/metastorage/packages/contracts/package.json:17), [contracts index.ts:12](/home/owen/Projects/metastorage/packages/contracts/src/index.ts:12).

- Why unnecessary: rental-document upload/issue contracts and the older facility-workspace/support-operation contracts have no application consumers. Package/barrel exports keep these files reachable, so the default unused-file scan misses them. The entry-export scan reports their unused surface.
- Impact: two contract families, six files, **161 source lines**, plus their public export declarations can be retired if they have no external clients.
- Risk: verify external consumers and approved upcoming work. These findings concern TypeScript contracts, not permission to delete document/history database records. Do not delete a schema merely because it is unexported if another type still depends on it.
- Plan: remove package/barrel exports and the confirmed disconnected family together; type-check every workspace. Keep externally promised contracts through a deprecation window if needed. Effort: half a day.

**11. Prune unused SDK object members and isolate demo-only API surface — P2, mixed confidence**

Evidence: [API client index.ts:304](/home/owen/Projects/metastorage/packages/api-client/src/index.ts:304), [index.ts:322](/home/owen/Projects/metastorage/packages/api-client/src/index.ts:322), [index.ts:400](/home/owen/Projects/metastorage/packages/api-client/src/index.ts:400), [index.ts:451](/home/owen/Projects/metastorage/packages/api-client/src/index.ts:451), [index.ts:591](/home/owen/Projects/metastorage/packages/api-client/src/index.ts:591).

- Why unnecessary: object members are retained when the factory is used. `facilities.list`, the old `storageUnits` client group, `catalog.getFacility`, and `legacyReservations.get` have no in-repository member callers in the searches performed. `facilities.list` also describes the same `/facilities` URL as `listActive` with a different response shape. Other old catalog/dashboard/booking methods are consumed by demos or tests.
- Impact: a clearer client contract and fewer discoverable unsupported/obsolete operations. Removing unused properties alone does not remove backend features.
- Risk: object properties can be accessed dynamically or outside the checkout. `legacyReservations` and `legacyBookings` are actively used by offline demos/tests; deleting them wholesale breaks confirmed workflows. Generic names such as `get` need property-aware validation, not just identifier counts.
- Plan: audit individual member access, remove confirmed unused properties, and consider a separate demo client entrypoint for the remaining legacy methods. Keep the shared HTTP transport and avoid a large client rewrite. Effort: half to one day.

**12. Deprecate the redundant appointment assignment endpoint — P2, high confidence for duplication**

Evidence: [appointments.routes.ts:91](/home/owen/Projects/metastorage/apps/api/src/modules/appointments/appointments.routes.ts:91), [appointments.service.ts:222](/home/owen/Projects/metastorage/apps/api/src/modules/appointments/appointments.service.ts:222), [check-in/hooks.ts:109](/home/owen/Projects/metastorage/apps/web/src/features/check-in/hooks.ts:109).

- Why unnecessary: `POST /appointments/:id/assign-staff` delegates straight to `updateAppointment`. Current UI callers use the validated `PATCH /appointments/:id` path. The SDK's `appointments.assignStaff` member has no application callers; integration tests still call the service wrapper.
- Impact: one fewer endpoint, SDK method, route schema reference, and wrapper to maintain; business logic already has one implementation.
- Risk: absence of in-repository callers does not prove the HTTP endpoint is unused externally. Assignment-only and assignment-plus-confirmation are different requests: preserve the existing transition rules when migrating tests/callers.
- Plan: check access logs/consumer ownership, deprecate the route, move service tests to the existing update method, then remove the route/member/wrapper. Preserve transaction boundaries and role enforcement. Effort: half a day plus deprecation time.

**13. Fetch the management facility list once — P1, high confidence**

Evidence: [management-workspace.tsx:68](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/management-workspace.tsx:68), [management-workspace.tsx:192](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/management-workspace.tsx:192), [hooks.ts:49](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:49), [hooks.ts:74](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:74).

- Why unnecessary: the parent calls `useFacilityOptions(true)` and the default facility tab calls `useAllFacilities`. Both load every page of `/facilities/management`, but use different keys (`scope,true` versus `all-facilities-list`). The parent request completes before the child list mounts.
- Impact: on a cold default visit, facility-list requests fall from approximately `2P` to `P`, where `P` is the number of pages required by the existing all-pages loader.
- Risk: global management lists must stay separate from assigned-facility lists and scoped by actor. Reusing a public catalog cache would change visibility/shape.
- Plan: share one actor-scoped full-facility query/options definition, derive selection options from it, and retain selected-facility behavior. Verify request counts on a cold visit. Effort: half a day.

**14. Stop invalidating every management domain after every write — P2, high confidence**

Evidence: [hooks.ts:152](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:152).

- Why unnecessary: `useFlow5Write` invalidates the entire actor's `flow5` tree plus facilities, bookings, facility-flow, pricing, catalog, and unit types on every settlement, including failures. A task edit and a facility edit trigger the same invalidation set.
- Impact: fewer unrelated active-query refetches and simpler explanations of which data each mutation changes. Exact request savings depend on mounted observers.
- Risk: removing invalidation too broadly can leave unit availability, assignments, or pricing stale; a failed request may still have committed before a connection error.
- Plan: specify affected keys per business mutation, retain broad invalidation only for genuinely cross-domain writes, and verify shared-screen freshness and ambiguous failures. Avoid building a generic invalidation framework. Effort: half to one day.

**15. Replace repeated full task-list scans for a detail view — P1, high confidence**

Evidence: [flow5.ts:98](/home/owen/Projects/metastorage/packages/api-client/src/flow5.ts:98), [hooks.ts:119](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:119), [facility-tasks.routes.ts:52](/home/owen/Projects/metastorage/apps/api/src/modules/facility-tasks/facility-tasks.routes.ts:52).

- Why unnecessary: `findMine(id)` requests pages of 100 assigned tasks until it finds one ID. The detail hook repeats that scan every 30 seconds. The API currently has no task GET-by-ID route, so this cannot be fixed by simply switching to an existing detail URL.
- Impact: a cold detail lookup currently costs up to `ceil(N/100)` requests for `N` tasks; an authorized ID lookup can make it one. Polling multiplies the difference.
- Risk: a list-cache hit can be incomplete or stale. A direct lookup must enforce current staff assignment and facility scope, including revocation.
- Plan: seed detail state from the list cache where useful, then provide a narrowly scoped ID lookup for this demonstrated workflow (ID filtering on an existing query or a detail read). Keep authoritative refresh for deep links. Effort: one day.

**16. Remove transaction-history request fan-out on web and mobile — P1, high confidence**

Evidence: [web/use-customer-transactions.ts:12](/home/owen/Projects/metastorage/apps/web/src/features/rentals/use-customer-transactions.ts:12), [mobile/use-customer-transactions.ts:5](/home/owen/Projects/metastorage/apps/mobile/src/features/customer-api/use-customer-transactions.ts:5).

- Why unnecessary: both implementations load rentals and launch a separate payment query for every loaded rental. Web also enables both current/history rental queries even when the selected view needs only one. The merge/deduplication/sort logic is repeated across platforms.
- Impact: for `R` loaded rentals in the all view, initial data loading is approximately `2 + R` requests before pagination/refetches. A customer-owned paginated transaction read can replace this with requests proportional to displayed transaction pages. Immediately disabling the unused rental view saves its request on filtered web views.
- Risk: preserve ownership, refunds, renewal charges, debt collections, stable ordering, and pagination. Client-side sorting of partially loaded rental histories is not equivalent to a globally ordered transaction page.
- Plan: first gate the unused web rental query; then implement one owner-scoped transaction query for both UIs using the existing payment-context rules. Share pure mapping/types where it reduces duplication; keep platform presentation separate. Effort: one to two days.

**17. Use narrow access checks instead of building rental details for payment history — P1, high confidence**

Evidence: [rentals.service.ts:229](/home/owen/Projects/metastorage/apps/api/src/modules/rentals/rentals.service.ts:229), [rentals.service.ts:177](/home/owen/Projects/metastorage/apps/api/src/modules/rentals/rentals.service.ts:177), [rentals.service.ts:133](/home/owen/Projects/metastorage/apps/api/src/modules/rentals/rentals.service.ts:133), [rentals.repository.ts:388](/home/owen/Projects/metastorage/apps/api/src/modules/rentals/rentals.repository.ts:388).

- Why unnecessary: customer payment listing calls `getCustomerRental` for access, discards its result, then queries payments. Detail construction reads renewal settings, may check open returns, and reads settlement. Facility payment listing similarly constructs settlement data it does not use. The customer payment query itself already filters rental owner.
- Impact: customer payment requests can avoid renewal-setting and settlement reads, plus the conditional open-return lookup and detail joins when using the existing `findOwnedRental` check. Facility history can avoid the settlement read. This is multiplied by the fan-out in 16.
- Risk: removing the initial check outright would change missing/unauthorized rental behavior to an empty list. Preserve 404/access behavior and facility authorization.
- Plan: reuse `findOwnedRental` for a minimal customer existence/ownership check; use a narrow facility-authorized rental context for facility payment history. Keep detail enrichment in detail workflows. Verify missing, unauthorized, empty-history, and renewed-rental cases. Effort: half a day.

**18. Reduce reservation-detail overfetching and unconditional polling — P2, high confidence**

Evidence: [reservation.hooks.ts:14](/home/owen/Projects/metastorage/apps/web/src/features/reservations/reservation.hooks.ts:14).

- Why unnecessary: a single reservation detail polls its record and the entire appointment inbox every 15 seconds. It also fetches the first 100 active facilities and first 100 unit types to find one facility/type, even though reservation DTOs already carry related display data in other consumers. Polling remains active for terminal records.
- Impact: removes catalog-list reads where embedded data is sufficient and avoids up to four timer-triggered HTTP requests per minute when both polls can stop for a terminal record in a visible mounted view. A scoped appointment lookup reduces payloads.
- Risk: terminal-state definitions and appointment changes need explicit handling. Embedded historical labels may intentionally differ from current catalog labels. Current list limits also mean a lookup can silently miss records beyond the first page.
- Plan: use the record's display context, fetch targeted missing data only when needed, and poll only while lifecycle changes are expected. Use mutation invalidation/focus refresh for terminal records; preserve recovery from asynchronous payment completion. Effort: half to one day.

**19. Remove a cache-key dimension that does not affect the mobile request — P2, high confidence**

Evidence: [use-staff-workspace.ts:27](/home/owen/Projects/metastorage/apps/mobile/src/features/staff-api/use-staff-workspace.ts:27).

- Why unnecessary: `filters.date` is included in the bookings key but not passed to `assignedToMe`. Changing the date fetches the same complete appointment payload into another cache entry; date filtering happens locally.
- Impact: one fewer identical request on each previously unseen date selection and fewer duplicate cached lists.
- Risk: if the backend later implements date filtering, the key must include the actual requested date/range. Preserve the existing local date filter.
- Plan: remove the date key dimension while filtering locally, or add an explicit supported server date filter and include it in both request and key. Verify date switching and 30-second refresh. Effort: under half a day.

**20. Simplify booking-era check-in lookup adaptation — P2, high confidence**

Evidence: [use-check-in-flow.ts:58](/home/owen/Projects/metastorage/apps/web/src/features/facility-flow/use-check-in-flow.ts:58), [use-dispatch.ts:22](/home/owen/Projects/metastorage/apps/web/src/features/facility-flow/use-dispatch.ts:22).

- Why unnecessary: lookup accepts several legacy parameters, normalizes URLs, tries an appointment ID, then loads assignments and sequentially scans appointment lists for facilities. It maps the result back into a booking-shaped object with reconstructed readiness/status fields. Much of this exists to bridge retired booking concepts.
- Impact: canonical appointment deep links already need only one detail request; eliminating unneeded fallbacks would avoid `1 + F` assignment/list requests on fallback paths for `F` facilities and reduce status translation code.
- Risk: QR codes and printed references may still use old formats. Frontend readiness is display guidance; backend payment/assignment/checklist validation remains authoritative.
- Plan: inventory accepted live QR/reference formats, use appointment IDs for newly generated links, retain only confirmed compatibility cases, and move any required reference search into an authorized filtered read. Do not remove active QR support based solely on its legacy name. Effort: one to two days.

**21. Break the check-in/dispatch import cycle — P2, high confidence**

Evidence: [check-in/hooks.ts:10](/home/owen/Projects/metastorage/apps/web/src/features/check-in/hooks.ts:10) imports `loadAppointmentItem`; [use-dispatch.ts:7](/home/owen/Projects/metastorage/apps/web/src/features/facility-flow/use-dispatch.ts:7) imports `bookingKeys` back.

- Why unnecessary: the relationship mixes reusable appointment mapping and key definitions with hooks that depend on each other.
- Impact: easier isolated tests and module initialization; fewer accidental dependencies when changing either workflow. No current runtime failure was demonstrated.
- Risk: changing cache-key values would invalidate assumptions elsewhere. The database cycle reported by Knip is separate and uses lazy foreign-key references; it is not evidence that tables are redundant.
- Plan: move the pure key definitions and/or appointment mapper to a small dependency-neutral feature module, retaining exact keys and request behavior. Do not introduce a global abstraction. Effort: under half a day.

**22. Consolidate repeated authentication-page footer markup — P2, high confidence**

Evidence: [login/page.tsx:30](/home/owen/Projects/metastorage/apps/web/src/app/login/page.tsx:30), [register/page.tsx:30](/home/owen/Projects/metastorage/apps/web/src/app/register/page.tsx:30). Related legal-link blocks are repeated in forgot-password, verify-email, forbidden, and not-found pages.

- Why unnecessary: the same branding/legal navigation structure is copied across multiple route files; login and register each carry an effectively identical roughly 35-line footer.
- Impact: one source for legal links, labels, and responsive behavior; likely removes dozens of repeated lines. Rendered UI need not change.
- Risk: some pages use different footer variants. A single component with numerous route-specific flags would add complexity.
- Plan: extract the identical footer, share the legal-link list where useful, and leave materially different page shells separate. Verify responsive rendering and link targets. Effort: half a day.

**23. Simplify large management/reporting components at business boundaries — P2, high confidence**

Evidence: [management-workspace.tsx:68](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/management-workspace.tsx:68), [management-workspace.tsx:184](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/management-workspace.tsx:184), [management-workspace.tsx:398](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/management-workspace.tsx:398), [operations-reports-hub.tsx:49](/home/owen/Projects/metastorage/apps/web/src/features/operations/components/operations-reports-hub.tsx:49).

- Why unnecessary: the 1,559-line management workspace combines facility editing, type catalog, offerings, memberships, and their filters/forms. The 991-line reports hub contains rental/reconciliation/refund tabs. Several panels repeat search submission, status filtering, page clamping, and dialogs. `selectedFacilityId` is passed to `FacilityListTable` but never read.
- Impact: smaller review surfaces, fewer repeated state-management mistakes, and removal of the ineffective prop. Merely moving lines between files is not a line-count or runtime improvement.
- Risk: selected scope, permission checks, dirty form state, and mutation behavior can drift during extraction. Search input versus submitted search is intentional state, not automatically redundant.
- Plan: fix the concrete unused prop, extract independently owned panels as changes touch them, and consolidate only identical filtering/pagination logic. Keep service/hook workflow behavior and component APIs stable. Effort: one to two days in small commits.

**24. Stop repeatedly loading complete collections to display one page — P2, high confidence**

Evidence: [management/hooks.ts:35](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:35), [management-workspace.tsx:201](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/management-workspace.tsx:201), [rentals/hooks.ts:25](/home/owen/Projects/metastorage/apps/web/src/features/rentals/hooks.ts:25), [customer-storage-hub.tsx:65](/home/owen/Projects/metastorage/apps/web/src/features/rentals/customer-storage-hub.tsx:65).

- Why unnecessary: management hooks repeatedly drain pages of 100 before local six-row pagination/filtering; the all-rentals view independently drains both current/history cursors into another cache. Separate copies of all-pages loops appear in facility/type/unit loaders.
- Impact: for large collections, initial work can change from all pages/all rows to one visible page. Reusing a small pagination loader can also reduce duplicated termination/cancellation logic.
- Risk: selector options and exports sometimes require a complete collection; do not paginate those blindly. Backend filters must match current search/sort semantics. Existing current/history caches and all-cache represent different completeness guarantees.
- Plan: retain all-pages fetching only for demonstrated full-list needs, use server pagination/search for growing tables, and reuse the existing pagination contracts. Add cancellation and stop conditions to any remaining page-draining loader. Effort: one to two days; prioritize after duplicate fetch removal.

**25. Update documentation that directs maintainers to retired code — P2, high confidence**

Evidence: [AGENTS.md:21](/home/owen/Projects/metastorage/AGENTS.md:21), [backend-patterns.md:1](/home/owen/Projects/metastorage/docs/backend-patterns.md:1), [README.md:1](/home/owen/Projects/metastorage/README.md:1), [booking-retirement.md:1](/home/owen/Projects/metastorage/docs/booking-retirement.md:1).

- Why unnecessary: `AGENTS.md` points to missing `docs/module-refactor-priorities.md`; backend patterns still illustrate an active booking module and refer to missing booking policy documentation. The README tree omits several current packages and the worker. Some on-demand links use an old `Projects/storeX` absolute path.
- Impact: prevents maintainers and agents from rebuilding retired endpoints or following broken paths. No runtime improvement.
- Risk: preserve useful cutover instructions and historical facts; documentation examples need to be clearly labeled if retained for history.
- Plan: update examples to reservation/appointment workflows, repair/remove broken references, and reconcile the workspace tree with manifests. Effort: half a day.

**26. Calibrate Knip and add a regression gate after cleanup — P1, high confidence**

Evidence: [knip.json:1](/home/owen/Projects/metastorage/knip.json:1), [run-customer-rental-e2e.ts:82](/home/owen/Projects/metastorage/apps/api/tests/run-customer-rental-e2e.ts:82), [.github/workflows/ci.yml:1](/home/owen/Projects/metastorage/.github/workflows/ci.yml:1).

- Why unnecessary: false positives make cleanup risky, while CI currently runs lint/types/tests/build without Knip. Package entrypoints hide additional unused export surface under the default scan.
- Impact: makes new dead code visible and gives future cleanup a reliable baseline.
- Risk: adding every fixture as an entry would hide genuinely abandoned fixtures. Enforcing the expanded scan immediately would fail on the current inventory. Indiscriminate ignores can conceal real missing dependencies.
- Plan: register the exact active string-launched `customer-rental-live-server.ts` entry; retain justified native/plugin dependency exceptions; resolve the Expo inference below; remove confirmed dead code; then gate `bun knip` in CI. Review entry exports separately before making that mode mandatory. Do not auto-apply `--fix --allow-remove-files`. Effort: half a day plus the cleanup batches it depends on.

**Findings that must not become blind deletions**

| Candidate | Disposition and reason |
| --- | --- |
| `apps/api/tests/fixtures/customer-rental-live-server.ts` | **Keep.** It is spawned by `run-customer-rental-e2e.ts` and `run-rental-renewal-postman.ts`. Add an explicit Knip entry. |
| Unlisted `expo-updates` | **Investigate configuration, do not automatically install.** The installed Knip Expo helper adds this requirement whenever `config.updates?.enabled !== false`; `app.json` does not explicitly configure updates or name this plugin. Decide whether OTA updates are part of the app. If disabled, make that intentional in app config; if required, configure/install appropriately and validate the native build. This output alone does not establish a runtime import error. |
| `ChartStyle`, local key factories, `usePermission`, `readWholeVnd`, `normalizeLookup`, `inspectionKey` | **Keep implementations, narrow exports.** Their own files use them. |
| `useAuthStore` / `authStore` duplicate exports | **Keep or rename deliberately.** They are two names for the same store and both have callers; this is not duplicated store logic. |
| Four duplicate contract-export pairs | **Not duplicated implementations.** They alias the same schema object. Canonical names could simplify the surface, but reuse is already centralized; preserve active aliases until consumers are migrated. |
| Booking archive tables, migration utilities, financial/audit records | **Keep.** Retirement documentation explicitly requires historical schema/data. A lack of new booking writes is not evidence that historical reads/FKs can be removed. |
| `legacyBookings`, `legacyReservations`, mobile demo service/screens, web mocks | **Keep supported workflows.** Real offline consumers and tests remain. Isolate or migrate them before retirement. |
| `createBookingTrackingLink` | **Not globally unused.** A booking-tracking fixture still invokes it. Retire that test capability only after deciding its migration coverage is no longer needed. `bookingSessionKey` and `trackingLinkMailJobId` have no in-repository callers and can be reviewed individually. |
| Payment → debt → return-settlement → payment import cycle | **Not evidence of dead tables.** Foreign keys use lazy callbacks and `AnyPgColumn`. Keep the financial relationships; consider organization only if the cycle causes a demonstrated tooling or initialization problem. |
| `.stitch` references/review screenshots | **Design artifacts, not application dead-code findings.** They are intentionally outside runtime imports. Archive only after confirming design/provenance needs; no automatic deletion recommendation. |

**Recommended cleanup sequence**

1. Correct the narrow Knip entry/configuration issues in 26. Save the baseline and keep intentional aliases/native dependencies documented.
2. Remove Mongoose, the old administration editor, unused backend methods, unused UI variants, and orphan scaffolding. Check Flow 1 operational usage before deleting those fixtures. Remove implementation-exclusive imports/types/messages afterward.
3. Remove disconnected contract families and unused SDK members, using a deprecation window for any externally promised API. Keep offline demos working.
4. Fix repeated facility fetches and rental payment authorization enrichment first; these have clear savings without changing HTTP contracts. Then address transaction fan-out, task lookup, polling, and invalidation with focused workflow tests.
5. Break the hook cycle, consolidate repeated footer/filter behavior, and update stale docs. Add the clean Knip baseline to CI.

For deletion-only batches, run `bun knip`, `bun run check`, `bun run check-types`, and builds for affected apps; use existing tests that exercise touched business behavior. For query/API changes, verify authorization, pagination, terminal-state behavior, and request/query counts. Generate database migrations through `bun run db:generate` and update the diagram only if a separately justified schema change is made. No schema deletion is recommended by this review.

**Complete baseline Knip inventory**

The following generated inventory records every baseline finding. Apply the disposition in 01–12 and the keep list above. “Unused export” means there is no outside consumer detected; it does not mean the declaration has no local use. Exported types should become private if still locally referenced, and should be deleted only when all consumers are gone. Their runtime removal impact is zero; their value is a smaller supported type surface. Shared-package consumers outside this checkout remain a compatibility risk.


**Unused files — 8**

| Location | Reported candidates |
| --- | --- |
| [apps/api/src/config/index.ts](/home/owen/Projects/metastorage/apps/api/src/config/index.ts) | `apps/api/src/config/index.ts` |
| [apps/api/tests/fixtures/customer-rental-live-server.ts](/home/owen/Projects/metastorage/apps/api/tests/fixtures/customer-rental-live-server.ts) | `apps/api/tests/fixtures/customer-rental-live-server.ts` |
| [apps/api/tests/fixtures/flow1-server.ts](/home/owen/Projects/metastorage/apps/api/tests/fixtures/flow1-server.ts) | `apps/api/tests/fixtures/flow1-server.ts` |
| [apps/api/tests/fixtures/flow1-web.ts](/home/owen/Projects/metastorage/apps/api/tests/fixtures/flow1-web.ts) | `apps/api/tests/fixtures/flow1-web.ts` |
| [apps/web/src/components/ui/toast.messages.ts](/home/owen/Projects/metastorage/apps/web/src/components/ui/toast.messages.ts) | `apps/web/src/components/ui/toast.messages.ts` |
| [apps/web/src/features/administration/admin-editor.tsx](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin-editor.tsx) | `apps/web/src/features/administration/admin-editor.tsx` |
| [apps/web/src/features/administration/use-admin-editor.ts](/home/owen/Projects/metastorage/apps/web/src/features/administration/use-admin-editor.ts) | `apps/web/src/features/administration/use-admin-editor.ts` |
| [apps/web/src/features/facility-flow/facility-overview.messages.ts](/home/owen/Projects/metastorage/apps/web/src/features/facility-flow/facility-overview.messages.ts) | `apps/web/src/features/facility-flow/facility-overview.messages.ts` |

**Unused dependencies — 1**

| Location | Reported candidates |
| --- | --- |
| [apps/api/package.json:33](/home/owen/Projects/metastorage/apps/api/package.json:33) | `mongoose` |

**Unlisted dependencies — 1**

| Location | Reported candidates |
| --- | --- |
| [apps/mobile/app.json](/home/owen/Projects/metastorage/apps/mobile/app.json) | `expo-updates` |

**Unused exports — 43**

| Location | Reported candidates |
| --- | --- |
| [apps/api/src/modules/auth/auth.guard.ts:33](/home/owen/Projects/metastorage/apps/api/src/modules/auth/auth.guard.ts:33) | `optionalAuth` |
| [apps/api/src/modules/facilities/facilities.access.ts:32](/home/owen/Projects/metastorage/apps/api/src/modules/facilities/facilities.access.ts:32) | `getFacilityListScope` |
| [apps/api/src/modules/facilities/facilities.guard.ts:18](/home/owen/Projects/metastorage/apps/api/src/modules/facilities/facilities.guard.ts:18) | `getFacilityContext` |
| [apps/api/src/modules/notifications/lifecycle-notifications.messages.ts:21](/home/owen/Projects/metastorage/apps/api/src/modules/notifications/lifecycle-notifications.messages.ts:21) | `lifecycleExpiryDetail` |
| [apps/api/tests/fixtures/inspection-fixture.ts:32](/home/owen/Projects/metastorage/apps/api/tests/fixtures/inspection-fixture.ts:32) | `passingChecklist` |
| [apps/mobile/src/features/customer-api/customer-native.ts:39](/home/owen/Projects/metastorage/apps/mobile/src/features/customer-api/customer-native.ts:39) | `sharePrivateFile` |
| [apps/mobile/src/features/staff-api/staff-work-filters.tsx:55](/home/owen/Projects/metastorage/apps/mobile/src/features/staff-api/staff-work-filters.tsx:55) | `staffFilterDate` |
| [apps/mobile/src/features/staff-api/use-staff-workspace.ts:20](/home/owen/Projects/metastorage/apps/mobile/src/features/staff-api/use-staff-workspace.ts:20) | `staffDate` |
| [apps/web/e2e/support/flow5-fixture.ts:16](/home/owen/Projects/metastorage/apps/web/e2e/support/flow5-fixture.ts:16) | `f5manager` |
| [apps/web/src/components/ui/avatar.tsx:20](/home/owen/Projects/metastorage/apps/web/src/components/ui/avatar.tsx:20) | `AvatarImage` |
| [apps/web/src/components/ui/card.tsx:37](/home/owen/Projects/metastorage/apps/web/src/components/ui/card.tsx:37) | `CardFooter` |
| [apps/web/src/components/ui/chart.tsx:335](/home/owen/Projects/metastorage/apps/web/src/components/ui/chart.tsx:335) | `ChartLegend`, `ChartLegendContent`, `ChartStyle` |
| [apps/web/src/components/ui/dialog.tsx:51](/home/owen/Projects/metastorage/apps/web/src/components/ui/dialog.tsx:51) | `DialogDescription`, `DialogFooter` |
| [apps/web/src/components/ui/operational.tsx:79](/home/owen/Projects/metastorage/apps/web/src/components/ui/operational.tsx:79) | `OperationalSectionHeader`, `operationalToolbar`, `operationalField` |
| [apps/web/src/components/ui/table.tsx:88](/home/owen/Projects/metastorage/apps/web/src/components/ui/table.tsx:88) | `TableFooter` |
| [apps/web/src/config/routes/index.ts:14](/home/owen/Projects/metastorage/apps/web/src/config/routes/index.ts:14) | `publicRoutes` |
| [apps/web/src/features/administration/admin-parts.tsx:20](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin-parts.tsx:20) | `AdminBadge`, `AdminTable`, `AdminDrawer`, `AdminSnapshotView` |
| [apps/web/src/features/administration/admin.helpers.ts:119](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin.helpers.ts:119) | `downloadCsv` |
| [apps/web/src/features/administration/admin.schema.ts:5](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin.schema.ts:5) | `AdminUserDraftSchema`, `AdminAssignmentDraftSchema` |
| [apps/web/src/features/auth/permissions.tsx:7](/home/owen/Projects/metastorage/apps/web/src/features/auth/permissions.tsx:7) | `usePermission` |
| [apps/web/src/features/check-in/hooks.ts:24](/home/owen/Projects/metastorage/apps/web/src/features/check-in/hooks.ts:24) | `facilityKeys`, `checkInKeys` |
| [apps/web/src/features/facilities/hooks.ts:13](/home/owen/Projects/metastorage/apps/web/src/features/facilities/hooks.ts:13) | `facilityKeys` |
| [apps/web/src/features/facility-flow/use-check-in-flow.ts:42](/home/owen/Projects/metastorage/apps/web/src/features/facility-flow/use-check-in-flow.ts:42) | `normalizeLookup`, `inspectionKey` |
| [apps/web/src/features/facility-management/hooks.ts:183](/home/owen/Projects/metastorage/apps/web/src/features/facility-management/hooks.ts:183) | `useManagedFacility` |
| [apps/web/src/features/rentals/hooks.ts:7](/home/owen/Projects/metastorage/apps/web/src/features/rentals/hooks.ts:7) | `rentalKeys` |
| [apps/web/src/features/returns/integration-utils.ts:3](/home/owen/Projects/metastorage/apps/web/src/features/returns/integration-utils.ts:3) | `readWholeVnd` |
| [apps/web/src/features/returns/returns.messages.ts:223](/home/owen/Projects/metastorage/apps/web/src/features/returns/returns.messages.ts:223) | `returnStatusLabel`, `returnChecklistGroupLabel`, `returnAuditLabel`, `returnTimeChangeStatusLabel` |
| [apps/web/src/mocks/seeds/index.ts:14](/home/owen/Projects/metastorage/apps/web/src/mocks/seeds/index.ts:14) | `bookingSeeds` |
| [apps/web/src/modules/facility-staff/staff-work.data.ts:14](/home/owen/Projects/metastorage/apps/web/src/modules/facility-staff/staff-work.data.ts:14) | `bookingWork` |

**Unused exported types — 37**

| Location | Reported candidates |
| --- | --- |
| [apps/api/src/modules/facilities/facilities.access.ts:13](/home/owen/Projects/metastorage/apps/api/src/modules/facilities/facilities.access.ts:13) | `GlobalFacilityScope` |
| [apps/api/src/modules/payments/payments.types.ts:9](/home/owen/Projects/metastorage/apps/api/src/modules/payments/payments.types.ts:9) | `GatewayPaymentResult`, `PaymentGateway`, `SepayPaymentInstructions`, `SepayVerifiedPaymentEvent`, `PricingSnapshot` |
| [apps/api/src/modules/unit-types/unit-types.types.ts:3](/home/owen/Projects/metastorage/apps/api/src/modules/unit-types/unit-types.types.ts:3) | `UpdateUnitTypeData` |
| [apps/mobile/src/components/ui/workspace-ui.types.ts:9](/home/owen/Projects/metastorage/apps/mobile/src/components/ui/workspace-ui.types.ts:9) | `WorkspaceTab` |
| [apps/mobile/src/features/auth/auth-screen.types.ts:7](/home/owen/Projects/metastorage/apps/mobile/src/features/auth/auth-screen.types.ts:7) | `FormFieldProps` |
| [apps/mobile/src/features/demo/demo.types.ts:3](/home/owen/Projects/metastorage/apps/mobile/src/features/demo/demo.types.ts:3) | `DemoAccount`, `ScreenCode` |
| [apps/web/src/components/ui/chart.tsx:14](/home/owen/Projects/metastorage/apps/web/src/components/ui/chart.tsx:14) | `ChartConfig` |
| [apps/web/src/components/ui/spinner.tsx:4](/home/owen/Projects/metastorage/apps/web/src/components/ui/spinner.tsx:4) | `SpinnerSize`, `SpinnerVariant` |
| [apps/web/src/components/ui/spinner.types.ts:1](/home/owen/Projects/metastorage/apps/web/src/components/ui/spinner.types.ts:1) | `SpinnerVariant` |
| [apps/web/src/components/ui/states.tsx:23](/home/owen/Projects/metastorage/apps/web/src/components/ui/states.tsx:23) | `LoadingVariant` |
| [apps/web/src/features/administration/admin.types.ts:5](/home/owen/Projects/metastorage/apps/web/src/features/administration/admin.types.ts:5) | `AdminAccountStatus`, `AdminOutcome`, `AdminAction`, `AdminUser`, `AdminLogin`, `AdminAudit`, `AdminFilters`, `AdminUserDraft`, `AdminAssignmentDraft`, `AdminEditorProps` |
| [apps/web/src/features/auth/auth.types.ts:18](/home/owen/Projects/metastorage/apps/web/src/features/auth/auth.types.ts:18) | `VerifyEmailState`, `DemoAccountItem` |
| [apps/web/src/features/notifications/notifications.types.ts:10](/home/owen/Projects/metastorage/apps/web/src/features/notifications/notifications.types.ts:10) | `NotificationDisplayItem` |
| [apps/web/src/features/operations/operations.schema.ts:26](/home/owen/Projects/metastorage/apps/web/src/features/operations/operations.schema.ts:26) | `OperationsPriceDraft` |
| [apps/web/src/features/operations/operations.types.ts:4](/home/owen/Projects/metastorage/apps/web/src/features/operations/operations.types.ts:4) | `OperationsSection` |
| [apps/web/src/features/rentals/customer-storage-hub.types.ts:8](/home/owen/Projects/metastorage/apps/web/src/features/rentals/customer-storage-hub.types.ts:8) | `CustomerStorageRentalsFilters`, `CustomerStorageBookingsFilters` |
| [apps/web/src/features/reservations/checkout.types.ts:5](/home/owen/Projects/metastorage/apps/web/src/features/reservations/checkout.types.ts:5) | `CheckoutPanelProps` |
| [apps/web/src/modules/customer/dashboard/customer-dashboard.types.ts:3](/home/owen/Projects/metastorage/apps/web/src/modules/customer/dashboard/customer-dashboard.types.ts:3) | `CustomerDashboardState` |
| [apps/web/src/modules/facility-staff/staff-work.types.ts:1](/home/owen/Projects/metastorage/apps/web/src/modules/facility-staff/staff-work.types.ts:1) | `StaffWorkKind` |
| [packages/shared/src/types.ts:20](/home/owen/Projects/metastorage/packages/shared/src/types.ts:20) | `User` |

**Duplicate export groups — 5**

| Location | Aliases (same underlying value) |
| --- | --- |
| [apps/web/src/features/auth/auth-store.ts:13](/home/owen/Projects/metastorage/apps/web/src/features/auth/auth-store.ts:13) | `useAuthStore`, `authStore` |
| [packages/contracts/src/bookings.ts:202](/home/owen/Projects/metastorage/packages/contracts/src/bookings.ts:202) | `AssignPhysicalUnitInputSchema`, `AssignPhysicalUnitBodySchema` |
| [packages/contracts/src/bookings.ts:166](/home/owen/Projects/metastorage/packages/contracts/src/bookings.ts:166) | `AssignBookingStaffInputSchema`, `AssignStaffBodySchema` |
| [packages/contracts/src/facilities.ts:101](/home/owen/Projects/metastorage/packages/contracts/src/facilities.ts:101) | `facilityQuerySchema`, `facilityManagementQuerySchema` |
| [packages/contracts/src/facilities.ts:90](/home/owen/Projects/metastorage/packages/contracts/src/facilities.ts:90) | `facilityIdNestedParamSchema`, `updateFacilityIdParamSchema` |

**Additional entry-export scan candidates**

These are the additional 94 export and 96 type reports from `--include-entry-exports`, excluding the baseline entries above. Re-exports and their original declarations can both appear, so these counts are not unique deletable implementations. In particular, Zod schemas may remain necessary to derive live DTO types. The best whole-family removal candidates are in 10; other rows require local-use review under 09. Package public-entry compatibility must be checked before narrowing exports.

| Location | Additional exports | Additional exported types |
| --- | --- | --- |
| [apps/web/playwright.return.config.ts:2](/home/owen/Projects/metastorage/apps/web/playwright.return.config.ts:2) | `default` | — |
| [packages/api-client/src/index.ts:117](/home/owen/Projects/metastorage/packages/api-client/src/index.ts:117) | — | `TokenProvider` |
| [packages/api-client/src/types.ts:9](/home/owen/Projects/metastorage/packages/api-client/src/types.ts:9) | — | `TokenProvider` |
| [packages/contracts/src/activity-logs.ts:52](/home/owen/Projects/metastorage/packages/contracts/src/activity-logs.ts:52) | `ActivityLogSchema` | — |
| [packages/contracts/src/bookings.ts:18](/home/owen/Projects/metastorage/packages/contracts/src/bookings.ts:18) | `RequestGuestAccessLinkSchema`, `GuestContractParamsSchema`, `GuestContractDownloadQuerySchema`, `BookingMagicLinkInputSchema`, `BookingTrackingParamsSchema`, `BookingDraftInputSchema`, `PhysicalUnitAssignmentSchema`, `CheckInLookupTypeSchema`, `CheckInLookupInputSchema`, `CheckInReadinessReasonCodeSchema`, `CheckInReadinessSchema`, `CheckInBookingSummarySchema`, `CheckInPaymentSummarySchema`, `BookingListItemSchema`, `AssignPhysicalUnitInputSchema`, `BookingIdParamsSchema`, `AssignPhysicalUnitBodySchema`, `BookingListQuerySchema`, `CustomerBookingPageQuerySchema`, `StaffTasksQuerySchema` | `BookingClosure`, `CustomerBooking`, `CustomerBookingDetail`, `CustomerBookingPage`, `CustomerBookingPageCursor`, `BookingMagicLinkInput`, `PaidBooking`, `CheckInLookupType`, `CheckInReadinessReasonCode`, `CheckInReadiness`, `CheckInBookingSummary`, `CheckInPaymentSummary`, `FacilityBookingsParams`, `BookingIdParams`, `AssignPhysicalUnitBody`, `BookingListQuery`, `CustomerBookingPageQuery`, `AssignStaffBody` |
| [packages/contracts/src/bookings.types.ts:10](/home/owen/Projects/metastorage/packages/contracts/src/bookings.types.ts:10) | — | `BookingClosure`, `CustomerBooking`, `CustomerBookingDetail`, `CustomerBookingPageCursor`, `CustomerBookingPage` |
| [packages/contracts/src/catalog.ts:3](/home/owen/Projects/metastorage/packages/contracts/src/catalog.ts:3) | `CatalogFacilitySchema`, `CatalogUnitTypeSchema` | — |
| [packages/contracts/src/dashboard.types.ts:1](/home/owen/Projects/metastorage/packages/contracts/src/dashboard.types.ts:1) | — | `DashboardKpi`, `DashboardActivity` |
| [packages/contracts/src/facilities.ts:10](/home/owen/Projects/metastorage/packages/contracts/src/facilities.ts:10) | `FacilityAddressSchema`, `FacilitySchema`, `FacilityAssignmentRoleSchema`, `ApiFacilitySchema`, `ApiFacilityAssignmentSchema`, `facilityIdParamSchema`, `unitTypeIdParamSchema`, `FacilityUnitTypeManagementItemSchema` | `FacilityAddress`, `FacilitySummary`, `FacilityIdParam`, `FacilityIdNestedParam`, `FacilityAssignmentParam`, `FacilityUnitTypeManagementItem` |
| [packages/contracts/src/facility-tasks.ts:100](/home/owen/Projects/metastorage/packages/contracts/src/facility-tasks.ts:100) | `FacilityTaskDashboardSummarySchema` | — |
| [packages/contracts/src/facility-workspace.ts:5](/home/owen/Projects/metastorage/packages/contracts/src/facility-workspace.ts:5) | `FacilityWorkspaceQuerySchema`, `FacilitySupportQuerySchema`, `SupportOperationSchema` | `FacilityWorkspaceQuery`, `FacilitySupportQuery`, `SupportOperation` |
| [packages/contracts/src/facility-workspace.types.ts:2](/home/owen/Projects/metastorage/packages/contracts/src/facility-workspace.types.ts:2) | — | `SupportOperationsTicket`, `SupportOperationsMessage`, `SupportOperationsPage`, `SupportOperationsDetail` |
| [packages/contracts/src/flow3-read.types.ts:3](/home/owen/Projects/metastorage/packages/contracts/src/flow3-read.types.ts:3) | — | `GuestRentalPaymentItemDto`, `GuestIssuedContractDto`, `PrivateReturnPhotoDto` |
| [packages/contracts/src/handover-checklist.ts:4](/home/owen/Projects/metastorage/packages/contracts/src/handover-checklist.ts:4) | `HandoverChecklistItemDefinitionSchema`, `HandoverChecklistDefinitionSchema`, `HANDOVER_CHECKLIST_VERSION` | — |
| [packages/contracts/src/index.ts:21](/home/owen/Projects/metastorage/packages/contracts/src/index.ts:21) | `FACILITY_WORKSPACE_MESSAGES`, `FacilitySupportQuerySchema`, `FacilityWorkspaceQuerySchema`, `SupportOperationSchema` | `FacilitySupportQuery`, `FacilityWorkspaceQuery`, `SupportOperation`, `SupportOperationsDetail`, `SupportOperationsMessage`, `SupportOperationsPage`, `SupportOperationsTicket` |
| [packages/contracts/src/inspections.ts:7](/home/owen/Projects/metastorage/packages/contracts/src/inspections.ts:7) | `PolicyViolationFeeSchema`, `PolicyViolationFeeCatalogSchema`, `InspectionVersionInputSchema`, `InspectionPhotoSchema`, `InspectionPhotoContentSchema`, `InspectionSchema`, `InspectionTypeValueSchema`, `InspectionStatusValueSchema`, `InspectionListItemSchema`, `InspectionPageSchema` | `InspectionDraftInput`, `InspectionPhotoInput`, `InspectionPhoto`, `InspectionPage` |
| [packages/contracts/src/mobile-workflows.types.ts:38](/home/owen/Projects/metastorage/packages/contracts/src/mobile-workflows.types.ts:38) | — | `MobileRental` |
| [packages/contracts/src/payments.ts:13](/home/owen/Projects/metastorage/packages/contracts/src/payments.ts:13) | `BookingPaymentParamsSchema`, `BookingPaymentInputSchema`, `PaymentTypeSchema`, `PaymentRefundReasonSchema`, `PaymentSchema`, `PaymentDraftParamsSchema`, `PaymentStatusHeadersSchema`, `SepayPaymentInstructionsSchema`, `PaymentPendingResponseSchema`, `PaymentStatusResponseSchema` | `BookingPaymentParams`, `PaymentDraftParams`, `PaymentIdParams`, `PaymentStatusHeaders`, `PaymentPendingResponse`, `DebtPaymentRecord` |
| [packages/contracts/src/rental-documents.messages.ts:1](/home/owen/Projects/metastorage/packages/contracts/src/rental-documents.messages.ts:1) | `RENTAL_DOCUMENT_MESSAGES` | — |
| [packages/contracts/src/rental-documents.ts:3](/home/owen/Projects/metastorage/packages/contracts/src/rental-documents.ts:3) | `RENTAL_DOCUMENT_MESSAGES`, `RentalDocumentStatus`, `CONTRACT_PDF_MAX_BYTES`, `ContractBookingParamsSchema`, `ContractRentalParamsSchema`, `ContractDocumentParamsSchema`, `ContractUploadSchema`, `ContractIssueSchema`, `ContractDownloadQuerySchema` | `ContractUpload`, `ContractIssue` |
| [packages/contracts/src/rental-documents.types.ts:1](/home/owen/Projects/metastorage/packages/contracts/src/rental-documents.types.ts:1) | — | `ContractTermsSnapshot`, `RentalDocumentDto` |
| [packages/contracts/src/rentals.ts:60](/home/owen/Projects/metastorage/packages/contracts/src/rentals.ts:60) | `RentalActionStateSchema`, `RentalListItemSchema`, `ReturnSettlementSchema`, `RentalDetailSchema` | `CreateRentalRenewal`, `RentalRenewalPaymentInput`, `RentalActionState` |
| [packages/contracts/src/rentals.types.ts:32](/home/owen/Projects/metastorage/packages/contracts/src/rentals.types.ts:32) | — | `RentalRenewalPage`, `FacilityRentalPaymentItem` |
| [packages/contracts/src/reports.ts:7](/home/owen/Projects/metastorage/packages/contracts/src/reports.ts:7) | — | `MonthlyRevenuePoint`, `RentalReportItem`, `ReportPeriod` |
| [packages/contracts/src/reports.types.ts:40](/home/owen/Projects/metastorage/packages/contracts/src/reports.types.ts:40) | — | `ReportPeriod`, `MonthlyRevenuePoint`, `RentalReportItem` |
| [packages/contracts/src/reservations.ts:18](/home/owen/Projects/metastorage/packages/contracts/src/reservations.ts:18) | `ReservationStatusSchema`, `CreateReservationSchema` | `CreateReservationInput`, `UpdateReservationInput` |
| [packages/contracts/src/storage-units.ts:28](/home/owen/Projects/metastorage/packages/contracts/src/storage-units.ts:28) | `UnitAvailabilityOptionSchema`, `EligibleUnitSchema`, `StorageUnitResponseSchema` | `EligibleUnit`, `StorageUnitIdParam`, `SetFacilityUnitTypeInput` |
| [packages/contracts/src/storage-units.types.ts:33](/home/owen/Projects/metastorage/packages/contracts/src/storage-units.types.ts:33) | — | `StorageUnitTransitionAction` |
| [packages/contracts/src/support.ts:13](/home/owen/Projects/metastorage/packages/contracts/src/support.ts:13) | `SUPPORT_MESSAGE_KINDS`, `SUPPORT_IMAGE_MIME_TYPES`, `SUPPORT_IMAGE_MAX_COUNT`, `SupportMessageParamsSchema`, `SupportAttachmentParamsSchema` | — |
| [packages/contracts/src/support.types.ts:19](/home/owen/Projects/metastorage/packages/contracts/src/support.types.ts:19) | — | `SupportReplyInput`, `SupportImageInput`, `SupportMessageDto`, `SupportMessagePage`, `SupportReplyResult`, `SupportImageResult` |
| [packages/contracts/src/system-settings.ts:137](/home/owen/Projects/metastorage/packages/contracts/src/system-settings.ts:137) | — | `ConfigureOverdueRate` |
| [packages/contracts/src/unit-types.ts:3](/home/owen/Projects/metastorage/packages/contracts/src/unit-types.ts:3) | `ApiUnitTypeSchema` | — |
| [packages/contracts/src/users.ts:23](/home/owen/Projects/metastorage/packages/contracts/src/users.ts:23) | `BusinessUserRoleSchema`, `UserStatusSchema` | `CustomerRegistrationMonth`, `CustomerRegistrationQuery` |
| [packages/contracts/src/users.types.ts:16](/home/owen/Projects/metastorage/packages/contracts/src/users.types.ts:16) | — | `CustomerRegistrationMonth` |
| [packages/shared/src/booking-access.ts:14](/home/owen/Projects/metastorage/packages/shared/src/booking-access.ts:14) | `bookingAccessHash`, `bookingActiveMagicKey`, `bookingSessionKey` | `BookingAccessGrant`, `BookingAccessSession` |
| [packages/shared/src/booking-access.types.ts:1](/home/owen/Projects/metastorage/packages/shared/src/booking-access.types.ts:1) | — | `BookingAccessGrant`, `BookingAccessSession` |
| [packages/shared/src/mail.ts:12](/home/owen/Projects/metastorage/packages/shared/src/mail.ts:12) | `trackingLinkMailJobId` | — |
