# Flow 2 UI — Stitch reference

Source: Stitch project `12493673820177325935`, retrieved 2026-10-05.

| Stitch screen | Source screen ID | Application entry |
| --- | --- | --- |
| F2-01: Check-in & Bàn giao kho | 430fa20dad004375968ed8221bb11935 | `/facility-manager/dashboard`, `/staff/dashboard` |
| F2-02: Gán & Đổi ô kho | 17962d9a2aca4a738772c0a4d10860b7 | `/facility-manager/check-in?view=assign&bookingId=…` |
| F2-03: Tìm & Xác minh Booking | 5dd0be3eb3bb4a96b7d773564120c108 | `/<actor>/check-in?bookingCode=…` |
| F2-04: Kiểm tra hiện trạng kho | ec5f13e82d7447668435a17bfe347aea | `/<actor>/check-in?bookingCode=…&view=inspect` |
| F2-05: Review & Hoàn tất kiểm tra | 1f4667baf8234760b1cc66dbf6590134 | `/<actor>/check-in?bookingCode=…&view=review` |
| F2-06: Bàn giao kho & Kích hoạt | c92a18152f9844f3b6ff2cee0210874f | `/<actor>/check-in?bookingCode=…&view=handover` |

FM uses preparation/assignment and read-only monitoring. Verification, inspection, review and handover execution are restricted to the assigned Staff. Staff lists its assigned tasks, not the manager's full booking list.

## Integration boundaries

- Uses the existing centralized API client for booking assignment, check-in verification, inspection history, draft updates, photo upload/delete/read, and inspection completion.
- Inspection forms use the shared `InspectionDraftInputSchema` and optimistic version supplied by the backend. Review requires correct unit, nonempty condition notes, and at least one uploaded photo; these are the actual H6 API requirements.
- Draft is saved explicitly. Photo upload/removal first saves pending form edits. Unsaved edits prompt on in-app links and the explicit back action; browser unload also has a guard.
- Completed inspection is immutable. Assigned Staff separately confirms customer handover; the atomic, idempotent API creates one ACTIVE rental, marks booking CHECKED_IN and unit OCCUPIED, consumes verification and records handover actor/time. Rental dates/deposit follow the paid booking. FM cannot execute this action.
- PIN, NFC and electronic access controls are outside the agreed scope and removed from this flow. No hardware credential is required for handover. IoT readings, GPS/hash signatures and SMS delivery are not fabricated.
- Dashboard counts use actual bookings, missing unit/staff assignment and completed handovers.
- Illustrative storage photos from Stitch are labeled as illustration. Inspection evidence exclusively comes from uploaded API photos.
- Operations overview uses the existing KPI component within the same metastorage OS shell; there is no new overview screen in the retrieved set of six Stitch screens.

## Verification

```sh
bun run --filter web check-types
bun run --filter web test
bun run --filter web build
cd apps/web
bunx playwright test --config flow2.playwright.config.ts
```

The dedicated Playwright configuration serves the frontend on port 3100 and intercepts API responses using test fixtures. It does not write to the real database or test live IoT/payment/handover services. Coverage includes manager navigation and assignment, verified inspection with real file input, save/reload, immutable completion, failed API history, mobile navigation/overflow, unsaved navigation guard, wrong-unit blocking, invalid image upload, and staff scope.

## Nielsen usability review (2026-10-05)

Source: [Jakob Nielsen, 10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/).
The review concerns the six Flow 2 screens; it is a heuristic review, not a user research study or proof of full usability compliance.

| Principle | Flow 2 response |
| --- | --- |
| 1. System status | Steps mark completion from assignment/verification/inspection data, not page position. Refresh status and result totals are announced; saved/unsaved/busy states remain visible. |
| 2. Familiar language | Translate technical status codes and labels into Vietnamese; use “khung giờ”, “hiện trạng” and “nhân viên”. |
| 3. User control | Preserve back/edit navigation and unsaved guards; allow cancelling reassignment and evidence removal before sending a mutation. Locked records remain explicitly immutable. |
| 4. Consistency | Retain the Stitch layout, shared shell, buttons and labels for both manager and staff. Current step is exposed with aria-current. |
| 5. Error prevention | Require lookup input; show customer and old/new unit in reassignment confirmation; confirm evidence deletion. Preserve eligibility, required evidence and explicit lock acknowledgment. |
| 6. Recognition | Keep booking/customer/unit context on the work screens; list unmet eligibility conditions, completion requirements and explanations next to blocked actions. |
| 7. Efficiency | Booking/QR lookup supports Enter and keyboard scanners; preserve filters, card radio selection and note suggestions. Direct lookup is also visible on mobile. |
| 8. Focus | Help is collapsed by default; optional integrations retain their pending status rather than distracting users with invented data. Preserve the complete operational layout from Stitch. |
| 9. Error recovery | Explain next actions for each known eligibility reason. Failed background refresh keeps cached bookings with a stale-data warning; failed evidence loading explains retry. |
| 10. Help | Provide concise, expandable task instructions covering assignment, verification, evidence, drafts and irreversible locking. |

Browser coverage additionally verifies truthful progress, Enter lookup, cancelling reassignment/deletion, and recovery from a failed list refresh. Test API fixtures do not validate live backend/payment/device services. No backend lifecycle rules were changed for this usability review.

### Build directory isolation

Local Next.js development uses `.next-dev`; the dedicated Flow 2 Playwright server uses `.next-playwright`; production build/start uses `.next`. This prevents tests or production builds from replacing the active development server's generated route files. `METASTORAGE_NEXT_DIST_DIR` overrides the output directory when explicitly needed. These generated directories are ignored by Git.

### Appointment slot persistence

Payment completion persists `checkInSlotEnd = checkInAt + 2 hours` alongside the chosen start, using the check-in slot policy shared by the repair script. This applies to mock checkout, sandbox confirmation and SePay webhook completion. The separate 2-hour grace period after slot end remains unchanged. Existing missing ends can be filled without changing appointment starts or booking statuses:

```sh
bun --env-file=apps/api/.env apps/api/src/scripts/backfill-check-in-slots.ts
# Review the dry-run before applying. Existing non-null ends are retained.
bun --env-file=apps/api/.env apps/api/src/scripts/backfill-check-in-slots.ts --apply
```

The repair on the local database filled six missing ends on 2026-10-05; a second dry-run found zero. Past appointments are not rescheduled or extended by this repair.

### Cloudinary inspection evidence

Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET only in apps/api/.env. New uploads use authenticated assets; the DB keeps public ID, format and audit metadata, with legacy Base64 nullable. The upload API still accepts bounded Base64 as transport, but new images are not stored as Base64 in PostgreSQL. Existing bytes remain readable.

The scoped photo endpoint generates a private download URL valid for five minutes. The UI refreshes URLs every four minutes/on window focus and provides retry for failed delivery. Signed download links are bearer links until expiry and use Cloudinary API bandwidth rather than public CDN caching. Original evidence is uploaded without transformations/overwrite.

Cloudinary upload takes place under the existing booking/inspection lock after draft/version checks. A failed DB write attempts to remove the orphan; response-load failure does not delete committed evidence. Removal commits DB deletion before deleting the external asset. Cleanup failures are logged for reconciliation; Cloudinary and PostgreSQL do not share an atomic transaction. Secret/provider error text is not sent to clients.

Migration 0020 adds Cloudinary columns while preserving legacy bytes. On this local DB, migration 0019 had already been applied with the exact same SQL hash but an older journal timestamp; its applied timestamp was aligned with the current journal before applying 0020. No business rows were removed. The API environment can be loaded explicitly for migrations:

```sh
cd packages/database
bun --env-file=../../apps/api/.env run db:migrate
```

## Responsibility and migration update

FM assigns units and Staff, then monitors read-only records. Staff execution requires both facility permission and current `assignedStaffId` on every API; assignment is checked again inside booking-locked mutations. Reassigning Staff invalidates the existing verification and requires a fresh inspection, preserving old records. Terminal bookings cannot be reassigned.

Migration 0021 adds nullable handover actor/time to inspection records. It does not activate historical bookings. Apply with `cd packages/database && bun --env-file=../../apps/api/.env run db:migrate`; restart API after deployment.

## Branding and demo identities

The live brand is `metastorage`; fonts and images use `/fonts/metastorage` and `/images/metastorage`. Demo accounts use `@metastorage.test`. Existing demo identities and facility names can be renamed in place without resetting bookings or unit status:

```bash
bun --env-file=apps/api/.env apps/api/src/scripts/rename-demo-branding.ts
bun --env-file=apps/api/.env apps/api/src/scripts/seed-flow2-demo.ts
```

Staff login is `staff@metastorage.test` / `Demo@123`. The seed keeps the existing Staff ID and facility assignment and adds units `HCM-01-009` through `HCM-01-018` only when missing. Inspection integration tests require a dedicated `metastorage_inspection_test_*` database.

Existing QR signing bytes and stored Cloudinary public IDs remain compatible with old records; new evidence uses the `metastorage/inspections` prefix. Historical planning documents, actual filesystem locations and external source names are not live branding.

## Connect Flow 2 to the deployed API

Use these settings in `apps/web/.env` and restart the web development server:

```dotenv
NEXT_PUBLIC_API_MODE=api
NEXT_PUBLIC_API_BASE_URL=/api
API_PROXY_TARGET=https://kekongpath.site/api
```

The browser calls its own `/api` origin; Next.js rewrites requests to the configured upstream, including the `/api` prefix. This keeps session cookies first party. `API_PROXY_TARGET` is server configuration, not a client secret. The backend must trust the actual web origin for authentication; the proxy preserves Origin and does not bypass backend checks. Serve the web over HTTPS in production for Secure auth cookies. To use a local backend, set `API_PROXY_TARGET=http://localhost:4000/api`. Set `NEXT_PUBLIC_API_MODE=mock` for the offline prototype. The shared API client remains the only HTTP boundary.

Log in with an active backend account that has the FM or FS role and facility assignment. Frontend mock accounts do not authenticate against the backend. Swagger development credentials may require the deployment's auth seed; do not assume they are available. FM prepares unit/staff assignment and monitors records. The assigned FS verifies the booking, creates/edits the inspection, uploads evidence, completes inspection, and separately confirms handover. Rental dates follow the current backend behavior.

API errors use the backend's nested `error.message` envelope, with support for legacy top-level messages. Assignment failures refresh booking/unit eligibility; changing unit or staff refreshes lookup and inspection context. Handover refreshes booking and rental queries. Logout clears the server-state cache. Staff assignment submits only `staffId`; the unused notes field is omitted because the backend currently does not persist it.

The Flow 2 Playwright config uses first-party `/api` requests and a dedicated HTTP upstream on port 4100 for session tests. It verifies login errors, cookie persistence on reload, logout and protected navigation through the actual Next.js rewrite. Operational booking/inspection cases use intercepted API fixtures, including nested errors, staff assignment retry, stale inspection version recovery and desktop/mobile accessibility. These tests validate frontend integration and proxy behavior, not deployment database transactions or notification delivery.

## Database-backed facility screens

Normal builds now default to API mode. The offline prototype requires an explicit `NEXT_PUBLIC_API_MODE=mock`; Vitest and offline browser suites opt into mock mode separately.

FM/FS overview reads the same scoped booking endpoints as dispatch: facility bookings for FM and assigned-to-me bookings for FS. Counts and recent bookings come from those API responses, with error/retry instead of sample metrics. Recent bookings are ordered by their real creation timestamps; they are not an activity/audit feed. Staff overview never requests the manager's full facility booking list. Scope loading/errors/empty assignments are handled before rendering overview or staff tabs.

Operational unit screens no longer display bundled stock photos as a particular unit's image. They show a neutral warehouse icon until the API supports real unit photos. Inspection evidence remains loaded exclusively through the inspection photo endpoint. Seeded customer names and booking codes are actual rows in the local PostgreSQL database; their resemblance to prototype fixtures does not imply a mock response.

The standalone BOM and System Administrator prototype workspaces are also gated by explicit mock mode. In API mode, their sample queries are disabled, their mock mutations are blocked, and their shells hide the demo badge. They display an unavailable state until those screens are integrated with the required backend endpoints. This does not add reporting, audit/history, pricing or account-management functionality to the local backend.

## Manual Flow 2 verification

Use `manager@metastorage.vn` and `staff@metastorage.vn` with the local seed password `StoreXDev123!`. The normal path requires a CONFIRMED booking, a SUCCEEDED payment, a suitable unit at the same facility, an assigned Staff account and a valid check-in appointment. Follow the appointment start/end/deadline displayed by the backend; a future or expired appointment is not a valid happy-path fixture.

1. Sign in as FM at `/facility-manager/dashboard`. Open a booking, assign a suitable physical unit, then assign the Staff account from the facility's staff list.
2. To test reassignment, select a different available unit and enter an optional reason. The in-app confirmation shows booking/customer, current/new unit and reason. Cancel or Escape preserves the existing assignment and sends no mutation. Confirm sends the reviewed selection; pending requests disable both actions. A backend conflict stays visible in the dialog. A successful change requires fresh verification/inspection for the new unit.
3. Keep the assigned FS signed in using another browser/profile to observe the realtime assignment notification, or sign out and sign in as the assigned FS. Open the booking from assigned tasks or search its booking code/QR. Check customer, payment, assigned unit and appointment eligibility. Confirm verification to create/open the inspection.
4. Record explicit PASS/FAIL for all four checklist items. Notes and JPEG/PNG/WebP photos are optional (up to 3 MB each, at most 8 photos). Save draft, reload and confirm results and any evidence persist. Missing or FAIL checklist items block completion.
5. Select review, acknowledge the immutable record and complete inspection. The inspection becomes COMPLETED/read-only; the booking remains CONFIRMED and the rental has not yet been activated.
6. On handover, acknowledge that the customer received the unit and confirm. Expect booking CHECKED_IN, unit OCCUPIED, rental ACTIVE and recorded handover actor/time. Reload and verify the completed state persists. FM monitors the record; FM cannot execute Staff verification/inspection/handover.

Also check: an unassigned/wrong Staff cannot execute the booking; early/late arrival is blocked; invalid/oversized photos are rejected; API errors allow retry; a stale inspection version reloads the current record; repeated handover cannot create a duplicate rental. Automated browser fixtures cover the workflow separately from live database/provider behavior. Photo upload on the local API requires valid Cloudinary configuration.

The original local seed's bookings include today-morning, tomorrow and terminal no-show scenarios. Seeding them does not guarantee an appointment is eligible at the time of manual testing. Create a separate correctly scheduled test booking or use the existing booking within its configured appointment; do not bypass the eligibility policy or overwrite a booking already being tested.

## Backend checklist alignment

- Inspection uses the shared four-item checklist: ASSIGNED_UNIT, DOOR_LOCK,
  UNIT_CONDITION and EXISTING_INVENTORY. Each item must explicitly PASS to complete.
- Drafts accept missing/FAIL results. Save and reload preserve `results`, per-item
  notes/photo references and the server checklist definition/version.
- General condition notes and evidence photos are optional. Photo size/count/type
  limits remain enforced. Review and read-only/handover screens show all checklist results.
- Legacy records without detailed checklist data remain distinguishable; the UI
  never converts `correctUnit: true` into four PASS results.
- Completion freezes the baseline. Staff handover still creates the rental through
  the existing backend transaction; FM monitors without Staff mutation controls.
- Dispatch reads NO_SHOW from backend booking status. It does not calculate a
  deadline from slot end plus two hours. Check-in details show API `graceEndsAt`.

Validation: browser coverage for partial/FAIL drafts, reload, four PASS completion
without notes/photos, version conflicts, handover and desktop/mobile accessibility;
isolated PostgreSQL integration suites validate checklist persistence and atomic handover.


## Staff realtime notifications (2026-10-20)

The authenticated Staff shell opens the existing cookie-authenticated
`GET /api/notifications/ws` endpoint through the centralized API client's URL builder.
FM never opens this channel. A valid `STAFF_TASK_ASSIGNED` event for the current user
refreshes booking queries, shows a toast and offers a link to the task list without
interrupting an inspection. Duplicate event IDs are ignored within the connection
lifecycle. No notification history, unread count, offline replay or email is implied.

The shell displays connecting/connected/reconnecting/offline/rejected states. It retries
unexpected disconnects with bounded exponential backoff; connection success and returning
to the page refresh assignments so missed events are recovered from the database.
Policy rejection (1008) stops automatic retry and offers a manual reconnect. Offline
browsers wait for the online event. Existing polling remains as fallback. Leaving the
Staff shell or changing the authenticated account closes the socket and cancels timers.
The API must trust the actual web Origin, and deployment proxies must forward WebSocket
upgrades as well as ordinary HTTP requests.

Read-only FM inspection records distinguish a locked baseline awaiting handover from
an actual handover with its recorded actor/time. Only the assigned FS confirms customer
receipt; the backend transaction activates the rental and updates booking/unit status.

The supported normal path is assignment → verification → four PASS checklist → immutable
inspection → customer receipt → rental activation. Same-type unit reassignment is supported.
Upgrade/downgrade pricing and refusal/refund branches remain TBD under the approved backend
completion plan; they are not represented as completed frontend actions.
