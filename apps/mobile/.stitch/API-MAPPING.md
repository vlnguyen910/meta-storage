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
| Facility cards and search | `GET /facilities/catalog` | Home shows up to six alphabetically sorted facilities. Submit opens the separate native explorer, using `search`, `city`, `sort` (name or ascending price), and ten results per page with load-more pagination. Show real starting prices. No geolocation, stock or featured-rank claims. Photos are explicitly illustrative. |
| QR | Confirmed reservation plus open CHECK_IN appointment | Generate the same customer reservation URL used by the web receipt. Label it a record lookup QR, not a verified admission token. No smart-door/PIN actions or unlock claims. |
| Money and dates | Joined reservation snapshot and actual appointment slot | Show rental fee/deposit/total separately; appointment date does not imply activation. No assumed VNPay method; current reservation payment flow uses SePay. |
| Unimplemented flows | User-confirmed mobile behavior | Facility selection, new appointments, rentals and notifications show a dismissible in-app unsupported-feature notice. They do not launch the browser. Existing native appointments, details and catalog search remain available. |
| Roles and offline demo | Existing session role | These three new surfaces are for API-mode CUSTOMER sessions. Staff and offline demo retain the account/waiting screen; no legacy booking records are recast as current appointments. |

Backend evidence: `packages/contracts/src/appointments.ts`, `reservations.ts`, `rentals.ts`,
`facilities.ts`, `unit-types.ts`; `apps/api/src/modules/appointments/appointments.routes.ts`,
`appointments.repository.ts`, `appointments.service.ts`; `packages/api-client/src/index.ts`.
The implementation changes only mobile files and uses the existing centralized client.

Theme: extracted source colors are recorded in `theme.json`; the native implementation keeps
existing fonts, primary palette, reusable controls and NativeWind. Scoped customer tokens
provide Stitch's pale lavender surfaces, mint selection and readable secondary text. No parallel StyleSheet/theme system was introduced.
Material Symbols are retained only in the untouched reference HTML; the native UI uses Lucide.

Verification uses typed contract fixtures and Playwright HTTP interception, not a live backend.
Native device checks remain separate from Expo Web viewport and accessibility evidence.
Per the user's instruction, no further E2E runs are required; acceptance will be verified by
the user through UAT. Type checking and linting are the final automated checks.

## Visual alignment

The app display name and visible wordmark are **MetaStorage**. Customer headers inherit
the body canvas and have no divider. Shared `SummaryTile`, `FacilitySummary`,
`FacilityCard`, `SectionHeading` and `ActionLink` remove repeated markup. Existing
`SearchField`, `Button`, `Card`, `StatusPill` and `MobilePhoto` gained optional presentation
props instead of introducing a second UI library or style system.

Expo Web captures in `../.impeccable/review/` compare the actual mobile components
against the pinned Stitch JPEG. Captures use existing contract-shaped fixtures, not
production customer data. They are visual evidence, not a functional E2E/UAT result.
The original reference HTML and JPEGs remain unchanged.

## Facility explorer

Stitch screen `d2b08938d1d34a809ba7edde4f796e8b` is retained as
`designs/discovery.html` and `designs/discovery.jpg`. Hosted screen download URLs
returned authentication errors; original files came from Stitch `download_file`.
The five illustrative result photos were downloaded with `curl -L` from the source HTML.

`facility-search-screen.tsx` is a separate screen. Its hook owns query parameters,
pagination, filter drafts and at most four real search terms in session memory.
History clears when the customer navigator unmounts/signs out. No fixture history,
proximity ordering, unit-availability badges, cold-room or insurance claims are added.
The bottom navigation stays in the home group because catalog discovery is not an
active rental. The booking action still uses the confirmed in-app unavailable notice.

The shared search field uses a flexing View around the core React Native TextInput,
a full-width input, and non-shrinking trailing actions. NativeWind v5 supports this
core input directly. Inverse search text and the primary submit-button label are white.

## Đặt kho: 5 bước native (2026-11-06)

Downloaded the five original Stitch HTML/JPEG pairs as `designs/booking-*.{html,jpg}`.
Reusable UI was implemented first in `features/booking/components/booking-parts.tsx`:
`BookingFrame` (progress, scroll/keyboard area, footer), `BookingSummary`, `BookingCosts`,
`UnitChoice`. Existing `Card`, `Field`, `Button`, `ChoiceTabs`, `CalendarField`, `Row`,
`FacilitySummary`, `MobilePhoto`, `BookingQr` and Lucide icons supply the foundation.
Each step has its own screen file; hooks/services own the workflow, common/ owns types/utilities.

| Step | Current API | Decision |
| --- | --- | --- |
| Chọn loại kho | `GET /facilities/:id/unit-types` | Active types only. Area derives from real length × width. Photos are explicitly illustrative; no invented security/climate amenities. |
| Thông tin & Lịch hẹn | `GET /appointments/check-in-slots`, `GET /facilities/:id/availability` | Session supplies name/email. Editable validated phone and optional notes. Tomorrow is the earliest date, matching production policy. No sample discounts or free months. |
| Xem đơn thuê | `POST /reservations/drafts`, `GET /appointments/mine`, `POST /appointments` | Persist the draft before creating its appointment; query existing context before retries. Editing a priced selection closes its unpaid appointment through the existing customer endpoint and produces a new draft. It never invokes reservation cancellation/refunds. All fees and period bounds come from the API; the current server uses 30 days per requested month. No client VAT/discount calculations. |
| Thanh toán | `POST /reservations/:id/make-payment`, `GET /payments/:id/status` | SePay replaces sample VNPay. Persist a stable idempotency key before sending. Native bank QR uses actual bank instructions when available; otherwise signed checkout POST opens in an embedded WebView, with no app-web bridge or external browser. Expiry uses the API timestamp and disables payment actions; only server status decides success/failure/refund. Poll every 15s and refresh on foreground/manual check. |
| Thành công | `GET /reservations/:id`, existing appointment | Only canonical `SUCCEEDED` + confirmed/checked-in reservation permits the paid receipt. QR opens the existing reservation lookup URL and is not an admission/unlock code. Show actual appointment and allocation state; payment itself does not start a rental. |

Bank QR format follows [SePay QR documentation](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code).
Missing bank-account instructions never produce a fake transfer QR. Source-only QR download
is replaced by copying amount/content and opening the actual gateway, so no unsupported storage
permission or placeholder download action is introduced.

Resume state is scoped to the authenticated owner (SecureStore on native, sessionStorage on web).
An uncertain payment request retains its key and blocks edits; reopening resumes that reservation.
A definitive rejection unlocks editing only after the canonical record proves no payment exists.
Terminal failed payments may restart with fresh availability and a new draft. Refund states cannot
trigger repayment. Navigating to another facility cannot overwrite an in-flight payment.

Validation: TypeScript and focused unit checks; Expo Web screenshots at 390×844, 375×667, 430×932, 768×1024 and
844×390 with deterministic API fixtures. No E2E suite and no real charge were executed. Real
provider completion and Android banking-app handoff remain user UAT.
