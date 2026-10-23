# Flow 5 Web Integration Implementation Plan

**Goal:** Let FM, FS, Admin and BOM exercise existing Flow 5 APIs through role-specific web screens.

**Architecture:** Keep the existing backend contracts and permissions. Add an isolated `flow5` group to the shared API client, a feature slice for query/form state, and thin actor route adapters. Preserve Flow 2 booking assignment and Flow 4 pricing screens. Continue in the current checkout so uncommitted Flow 5 backend work remains available.

**Tech Stack:** Next.js App Router, TanStack Query, React Hook Form, shared Zod contracts, Playwright and axe.

---

### Task 1: API client and server state
- Create `packages/api-client/src/flow5.ts`; integrate through `createMetastorageApiClientImpl` without replacing existing groups.
- Create `apps/web/src/features/facility-management/{hooks,management.types,management.messages}.ts`.
- Scope query keys by authenticated actor and facility; paginate inventories, tasks and histories. Refresh reads after writes and conflicts.

### Task 2: Units and maintenance
- Add FM unit inventory route, create/edit form, unit detail, maintenance reason/confirmation, paginated history.
- Admin/BOM may inspect units and operate maintenance globally; unit create/edit remains FM-only.
- Use shared schemas; never accept arbitrary status updates or choose business defaults for the server.

### Task 3: Tasks and reports
- Add FM task list/create/detail/reassign and FS task list/detail/report form.
- Preserve assignment versions; reload after 409; display report history and prevent duplicate submits while pending.
- No approval/completion controls: these APIs are not implemented. Printing task context does not issue/print a document.

### Task 4: Administration
- Add Admin/BOM facility list/create/edit, type catalog create/edit, facility offering toggles, membership list/assign/revoke.
- Replace the Admin membership route's mock workspace. Only Admin can list accounts; BOM uses an explicit existing account UUID and role.
- Add actor navigation entries. Keep global type pricing updates in Flow 4; initial price only on type creation.

### Task 5: Verification
- Run `bun run check`, `bun run check-types`, targeted web regression tests and web build.
- Add Playwright contract-driven UI coverage for scoped inventory, maintenance success/error/history, task assignment conflict, FS report and FM history, administration forms and role boundaries.
- Exercise browser at desktop/mobile viewports, run axe, check keyboard/dialog focus, loading/error/empty states, and capture screenshots. Clearly distinguish stubbed UI tests from live backend persistence checks.
- Use the existing local API on port 4000 via the frontend proxy, with an isolated web test server when needed. Do not reseed/reset existing application data for UI tests.
