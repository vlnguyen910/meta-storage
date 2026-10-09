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
