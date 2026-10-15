# StoreX mobile — Stitch integration and manual verification

Updated: 2026-10-14. Target: existing `apps/mobile` (React Native / Expo SDK 57 / NativeWind).
No new application, WebView implementation, backend endpoint or database migration was created.

## Design inventory

Project: https://stitch.withgoogle.com/projects/15161264923633714884

The provided `.stitch/mobile/screens.json` and `docs/mock-data.md` did not exist in this checkout.
The new `.stitch/mobile/inventory.json` records MCP screen metadata and relevant canvas instances.
`.stitch/mobile/screens.json` records the selected reference IDs, source artifact timestamps,
device metadata and local HTML/screenshot paths. The MCP list does not expose creation timestamps;
source HTML timestamps and visual/content inspection were used to distinguish variants.

38 mobile-named candidates were downloaded and inspected. Some have DESKTOP metadata despite
390px canvas frames. MOBILE references were preferred. The older C07 reference is retained for
request-sheet layout context. No FM/BOM/Admin/OPTIONAL designs were imported or generated.

| Screen | Native implementation | Reference status |
| --- | --- | --- |
| M-P00 / M-P01 / M-P02 | `screens/public-screens.tsx` | MOBILE references |
| M-A01 / M-A02 / M-A03 / M-A04 | `screens/auth-screens.tsx` | MOBILE references |
| M-CK01 / M-CK02 / M-CK03 / M-CK04 / M-CK05 | `screens/checkout-screens.tsx` | MOBILE references |
| M-C01 / M-C02 / M-C03 / M-C04 / M-C05 / M-C06 / M-C07 | `screens/customer-screens.tsx` | MOBILE references, including C07 sheets |
| M-FS01 / M-FS02 / M-FS03 / M-FS04 / M-FS06 / M-FS07 | `screens/staff-screens.tsx` | MOBILE references |
| M-FS05 | `screens/staff-screens.tsx` | Not found in MCP list or canvas; native step composed using FS06/FS07 layout and the existing H6 contract |
| M-E01 | `features/mobile-shell/mobile-app.tsx` | MOBILE reference |
| M-E02 | `features/mobile-shell/mobile-app.tsx` | Found, but DESKTOP metadata; content adapted to mobile |

Screenshots are reference artifacts, not app screens or backgrounds. Original embedded image
URLs returned HTTP 403 during download. The app reuses the repository's local storage-interior
illustration, labels it as illustrative, and avoids temporary image URLs. This image differs
from the Stitch originals. Static decorative inspection photos were omitted in favor of actual
optional camera captures. The native implementation does not claim pixel-identical asset fidelity.

Generated claims about CCCD/passport collection, ISO/security certifications, guaranteed refunds,
free fees, precise dimensions, PIN/NFC/IoT and remote access were excluded. Form success, failure
and loading blocks shown simultaneously in Stitch are rendered conditionally in the app.

## Architecture and business boundary

`Screen → feature hook/form → centralized api-client → mobile-only Axios adapter → demo service`.

- Existing API mode is retained with `EXPO_PUBLIC_API_MODE=api`; the new default is local mock.
- TanStack Query owns workspace/availability data. React Hook Form and shared Zod schemas own forms.
- New `packages/contracts/src/mobile-workflows*` and `packages/api-client/src/mobile-workflows.ts`
  describe local demo actions. They do **not** imply that corresponding production endpoints exist.
- The adapter intercepts every request; an unsupported path fails locally, with no network fallback.
- Mutations are serialized and persisted before publishing state. Version checks protect inspections.
- Web preview uses its own `storex.mobile.demo.v1` localStorage record. Android uses revisioned,
  chunked Expo SecureStore. A revision becomes visible only after all writes complete.
- Session and domain data survive reload. Account switches replace scoped workspace data and remove
  other mobile query caches. Customer records are scoped by owner ID, not matching contact email.
- Guest booking ownership remains with the device's guest identity. Signing in does not claim
  a guest booking automatically. Guest can reopen its paid booking on the original device.
- Holds last 10 minutes; booking advance window is 30 days; duration is 1–12 months.
- Price snapshots display rent/deposit/total separately. Sample deposit is one sample monthly rate,
  not a production pricing policy.
- Booking code/QR is created only after successful simulated payment. Payment retry is idempotent.
- Reschedule preserves facility/type/duration/price, checks full-period capacity and records history;
  it requires at least 24 hours before the old slot and permits at most two changes.
- Cancellation releases capacity and records cancellation; it does not send money or pretend a
  provider refund succeeded. Policy explanation distinguishes rent refund from deposit forfeiture.
- Only assigned FS in an authorized facility can verify/inspect a booking. Verification leaves
  `CONFIRMED`; locking the complete H6 checklist still leaves rental inactive. Explicit handover
  confirmation creates an active rental once.
- Return/change sheets save requests awaiting FM. They do not swap units, settle charges or close
  contracts. Assigned FS may record PASS/FAIL observations and send a return report to FM; failures
  do not generate deductions or refund approvals.

### Gaps / TBD

- Native/device storage is independent of the existing web FM workspace's localStorage. A new
  mobile booking genuinely waits for FM assignment; the app does not fabricate that assignment.
  Existing seeded assignments demonstrate the FS flow. Live cross-app synchronization/import is
  not implemented and would need a separately agreed transport/workflow.
- New return/change requests wait for FM. Only the seeded return request already assigned by FM
  is available for FS reporting. FM approval and settlement remain outside this mobile scope.
- Production reschedule/cancel/request/report endpoints are not implemented by this task.
- Fees, settlement timing, refund execution and detailed return/transfer policy remain TBD.
- Identical local request retries reuse their record. Rules for triaging distinct concurrent
  requests are TBD for FM; the demo records intent without approving either request.
- M-FS05 has no verified Stitch source. M-E02 lacks a MOBILE export. No replacement Stitch designs
  were generated. Camera, keyboard, SecureStore performance and hardware back still require Android
  emulator/device checks; browser rendering is not evidence of native-device behavior.

## Run from repository root

```powershell
bun install
bun run --filter mobile dev --localhost --port 8081
```

Mock mode is default; no API, Redis, PostgreSQL or worker is needed. Remove any local
`EXPO_PUBLIC_API_MODE=api` override while checking this implementation.

For the Expo browser preview (same native screen components via React Native Web):

```powershell
bun run --filter mobile web --port 8082
```

Open http://localhost:8082. The root `bun run dev` still starts the existing web workspace.
`bun run dev:mock` did not exist in this checkout and was not assumed or added.

Windows installation hit Bun copyfile ENOENT in the long repository path. The affected cached
packages were restored using Node's filesystem API, then `bun install` completed successfully.
`S:\storeX` was used as a temporary drive alias for this same repository during Metro verification;
it is not a second checkout/application. Do not use `bun install --force` merely to start the app.

## Genymotion setup

1. Start a Genymotion Android device.
2. In **Genymotion → Settings → ADB → Use custom Android SDK tools**, select the SDK root,
   not `platform-tools`. On this machine the detected SDK root is:
   `D:\CHUYEN NGANH\SEMESTER 7 SU26\MMA\AndroidSDK`.
3. In PowerShell, run `adb devices`. The device must appear with status `device`.
4. Install an Expo Go build compatible with **SDK 57** from https://expo.dev/go.
   Expo Go and project SDK versions must match. If a matching build or the correct emulator ABI
   is unavailable, stop at that environment gap; use a compatible development build rather than
   changing the app framework or pretending another SDK is compatible.
5. Start the mobile bundler with the command above. In another terminal:

```powershell
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

If multiple devices are connected, add `-s <serial>` to both adb commands. If Expo Go reports
an SDK/ABI mismatch, record its exact message before choosing a build path. An Android JavaScript
export was validated; this repository does not include a newly generated/installable APK.

References:
[Genymotion ADB setup](https://docs.genymotion.com/usage/desktop/general_settings/),
[Expo Go SDK compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/),
[Genymotion APK/ABI compatibility](https://docs.genymotion.com/usage/desktop/install_apps/).

## Demo accounts and manual flows

Password for all seeded accounts: **Demo@123**.

| Account | Purpose |
| --- | --- |
| `customer@metastorage.test` | Own paid bookings, two hold examples (valid/expired), active rental, requests |
| `staff@metastorage.test` | Assigned check-in and return-inspection tasks at Sài Gòn Central |
| `other@metastorage.test` | Verify that another Customer cannot see the first Customer's records |

New signups always become Customer. On the email screen, **Mô phỏng xác thực email** demonstrates
verification without sending mail. Forgot-password demonstration records only the local request;
it does not send a link or silently change a password.

1. **Guest booking:** Home → find facility → detail → select type → contact/date/months → hold/review
   → payment. Check rent/deposit/total, simulate failure and retry, then inspect paid code/QR. Reload
   on the hold screen before paying to confirm persistence. A paid booking waits for FM assignment.
2. **Customer records:** Use the Customer shortcut on login, then sign in. Paid bookings and holds
   use separate tabs. Open `BK-2026-0002` to reschedule (future slot); try more than two changes and
   check that type/duration/price stay fixed. Cancellation requires an explicit confirmation.
3. **Hold recovery:** Open valid and expired holds from the Customer hold tab. Expired hold must
   acquire capacity again before payment; it must never display a successful booking QR.
4. **Rental requests:** Open the active rental from Kho của tôi. Open the return/change sheet,
   enter a reason/time and select the same or another type for a change request. The record remains
   awaiting FM, with no unit or money change.
5. **Staff check-in:** Sign out, sign in as FS. `BK-2026-0001` is assigned and in the ready window
   relative to demo creation. Verify → complete every H6 item → save → review → lock → explicitly
   confirm handover. Before the last action, rental must remain inactive. Returning to the same
   completed handover must not create a second rental.
6. **Staff return:** Open the assigned return request for `BK-2026-0003`. Record PASS/FAIL and notes;
   optional photos can be captured only after camera permission is requested by the user. Submit
   to FM. The report becomes read-only; rental remains active, with no fee/refund decision.
7. **Authorization/reload:** Switch Customer accounts, reload, and verify ownership. Customer opening
   `#M-FS01` in browser preview must see the forbidden screen. Unknown hash paths show not-found.
8. **Reset demo:** At login, choose Khôi phục dữ liệu demo, then the explicit confirmation. It clears
   only this mobile demo and rebuilds current-time fixtures. Use this when ready-slot samples age.

On Genymotion additionally verify camera denial/retry, QR scan, keyboard-covered fields, Android
back, portrait/landscape rotation, text scaling and safe areas. No physical-device result is claimed.

## Verification

- Scoped Biome checks and repository type-checks.
- `bun test apps/mobile/tests/demo-policy.test.mts`: focused ownership/capacity/state-transition
  checks; no E2E suite invocation.
- Android JS export with Expo (`--platform android --no-bytecode --max-workers 2`), not an APK build.
- Browser inspection of checkout failure/retry/reload, Customer actions, forbidden access, FS
  verification/checklist/handover and return report. Screenshots under `.stitch/mobile/review/`.
- Viewports 375×667, 390×844, 430×932, 768×1024 and landscape 844×390. No horizontal overflow in
  inspected states. Native photo sizing was corrected after the initial visual inspection.
- Browser-only axe checks; initial landmark/heading issues were fixed. Follow-up report is stored
  in `.stitch/mobile/review/review.json`. These checks do not establish native screen-reader compliance.
- Final browser review: 32 captured states, 15 critical-state axe audits with no violations,
  no page errors or transaction/email/backend requests. Invalid checkout submission focuses the
  first invalid input; malformed/unknown hash routes recover to not-found.
- `expo install --check` could not finish because the Expo service connection returned ECONNRESET.
  The CLI announced a newer SDK 57 patch. No framework/SDK upgrade was performed; exact native
  package recommendations and Expo Go/Genymotion ABI compatibility still need environment checking.
- No transaction/backend/email requests in the inspected mock flows. Android ADB had no connected
  device during implementation. Existing desktop source files were not modified.

Usability review follows [Nielsen's ten heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/):
visible progress/status, familiar labels, explicit cancel/back, consistent cards/navigation,
validation before mutation, visible scoped records, demo-account shortcuts, restrained content,
recoverable hold/payment errors and contextual explanations for locked actions.
