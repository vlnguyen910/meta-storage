# Stitch → mobile API decisions

Source project: `259132084655583484`. Original HTML/JPEG files are in `designs/`.
Hosted screen URLs required authentication; `download_file` supplied the original files.
The two illustrative facility photos were downloaded with the skill's `curl -L` script.

| Surface | Current contract | Implementation decision |
| --- | --- | --- |
| Home appointments and calendar | `GET /appointments/mine` → `AppointmentRecordDto[]` | Session determines ownership. Filter the complete array by actual type/status, facility, Vietnam date and selected week; no invented pagination or transport/renewal statuses. |
| Appointment detail | `GET /appointments/:id` | Show the actual facility, staff, assignment, contact, slot and reservation. Missing assignment stays “Chờ phân bổ”; missing values stay unknown. |
| Unit dimensions | `GET /facilities/:id/unit-types?limit=100` | Match the appointment's unit-type ID. Do not invent floor/zone or dimensions if unavailable. |
| Rental count | `GET /rentals/mine?view=current&limit=100` | Count active items; append `+` when a next cursor exists, rather than claiming a complete total. |
| Facility cards and search | `GET /facilities/catalog` | Search natively with the `search` parameter; show up to six alphabetically sorted results and real starting prices. No geolocation, stock or featured-rank claims. Photos are explicitly illustrative. |
| QR | Confirmed reservation plus open CHECK_IN appointment | Generate the same customer reservation URL used by the web receipt. Label it a record lookup QR, not a verified admission token. No smart-door/PIN actions or unlock claims. |
| Money and dates | Joined reservation snapshot and actual appointment slot | Show rental fee/deposit/total separately; appointment date does not imply activation. No assumed VNPay method; current reservation payment flow uses SePay. |
| Other flows | Existing web routes | Facility selection opens `/customer/booking/new?facilityId=…&new=1`. The new-appointment action opens `/customer/facilities` to start a reservation and CHECK_IN flow. CHECK_OUT and SUPPORT still require their existing rental/support contexts on web. Rentals and notifications open their existing web routes. The browser may require its own sign-in. |
| Roles and offline demo | Existing session role | These three new surfaces are for API-mode CUSTOMER sessions. Staff and offline demo retain the account/waiting screen; no legacy booking records are recast as current appointments. |

Backend evidence: `packages/contracts/src/appointments.ts`, `reservations.ts`, `rentals.ts`,
`facilities.ts`, `unit-types.ts`; `apps/api/src/modules/appointments/appointments.routes.ts`,
`appointments.repository.ts`, `appointments.service.ts`; `packages/api-client/src/index.ts`.
The implementation changes only mobile files and uses the existing centralized client.

Theme: extracted source colors are recorded in `theme.json`; the native implementation keeps
existing fonts, primary palette, reusable controls and NativeWind. Two scoped canvas tokens
provide Stitch's pale lavender surfaces. No parallel StyleSheet/theme system was introduced.
Material Symbols are retained only in the untouched reference HTML; the native UI uses Lucide.

Verification uses typed contract fixtures and Playwright HTTP interception, not a live backend.
Native device checks remain separate from Expo Web viewport and accessibility evidence.
Per the user's instruction, no further E2E runs are required; acceptance will be verified by
the user through UAT. Type checking and linting are the final automated checks.
