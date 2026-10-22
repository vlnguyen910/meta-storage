# Flow 3 return APIs — implementation record, 2026-10-20

Implemented backend/database scope: My Storage reads, guest rental access, lifecycle
configuration, return requests and scheduling,
versioned return inspections, physical receipt/corrections, FM settlement/manual
refund confirmation, BOM overdue-rate configuration, authorization and audit.
See [my-storage-api.md](my-storage-api.md) for rental reads and provider audit.
No Web, Mobile or API-client files changed. This is not completion of all Flow 3.

## Decision-to-code status

| Decision | Implementation |
| --- | --- |
| Default ACTIVE/RETURN_PENDING/OVERDUE + CLOSED history | Rental reads; stable expiry/UUID keyset pagination |
| PENDING does not reserve, capacity one from CONFIRMED | Facility-row lock; reserved-slot partial unique index; 15-minute interval conflict check |
| 90-minute slots, operating hours/holidays, 24-hour notice | Existing check_in_slots + facility_operating_hours; calendar config; create/edit validation |
| Admin config changes preserve confirmed appointments | Immutable time snapshots, manualReviewRequired flag; no reschedule/cancel |
| Admin return checklist/severity | Append-only versions, four groups; snapshot at each inspection attempt |
| Assigned FS only; FM assigns/reassigns | Backend role + live facility membership + current assignment checks |
| FAILED retry | New attempt, FAILED → INSPECTING; previous result preserved |
| Photos/property/closure | Five inspection photos; issue requires note/evidence; property resolved/stored before closure |
| Actual-return corrections | Assigned FS proposal with proof; FM approval; append financial revision after settlement |
| One-time overdue fee | Assessed in settlement using actual-return local date, integer rate/deposit snapshots and half-up VND |
| Settlement/debt/refund | FM approval; deposit deduction, nonnegative refund, ledger-only debt; separate immutable revisions/refund records |
| Refund SLA | Three following business days after FM approval, weekends/holiday snapshot excluded |
| Contract PDFs/handover gate | Implemented separately; see rental-contracts-api.md. No CCCD/passport schema |
| Automatic OVERDUE + seven-full-day manual-review flag | Facility-local cron updates rental only; preserves open request and sends deduplicated manual-review notice; no disposal |
| Durable email/in-app outbox, expiry reminders | Implemented DB outbox, notification inbox, worker claims/leases/retry, current FM authorization check, configurable 7-day local reminder at configured time or 09:00 fallback for facilities with consistent operating-hour timezone |
| Lifecycle day settings | System Administrator-only `rental_lifecycle_settings`; optimistic version and `return_audit` update in one transaction; seeded 7-day expiry and manual-review values; no business min/max |
| Guest rental portal | Booking-scoped cookie GETs for rental/payment/refund/issued contracts; private PDF backend read; generic audited resend request, 24-hour link, old grant revoked on replacement, 3/booking/hour and 10/IP/hour |
| Existing finance reports with return settlement/refunds | Cash refunds by confirmedAt; latest effective settlement; explicit deposit/rent allocations; unknown legacy splits flagged; fees/debt are not automatically classified as revenue |
| Renewal/upgrade | Intentionally excluded; no schema/API/job added |

## Lifecycle jobs and notifications

API cron evaluates rental expiry using the return-calendar timezone, or reuses the
single consistent timezone already configured in facility operating hours when no
return calendar exists. Missing/inconsistent operating-hour timezone leaves the
rental unchanged. At 00:00 on the local day after expiry, it changes rental status
to OVERDUE without changing return-request status. After seven full local days
from that overdue boundary, it stamps `abandoned_review_at` and queues an FM review
notice. The customer already receives the overdue notice; no automatic disposal occurs.

Rental creation less than 7 local calendar days before expiry queues an immediate
customer reminder. Otherwise the worker queues one reminder at the configured
facility local time (default 09:00). Stable event/recipient keys deduplicate
concurrent sweeps and retries. Verified payment, booking, return scheduling,
inspection, settlement, refund and time-change records also enqueue notifications
inside their business transaction. Booking confirmation now persists a customer
intent with its template snapshot in the same outbox, alongside FM notifications.
The worker prepares the existing access email and enqueues the existing BullMQ job
with a frozen encrypted payload. New intents bypass the former API enqueue path;
legacy jobs keep their delivery ID/template. ENQUEUED is not provider-confirmed SENT.
See booking-tracking.md for queue recovery, TTL and rollout behavior.
Cancel transitions to OVERDUE write the same deduplicated overdue event atomically;
sweeps repair missing events and advance through batches even without recipients.

`GET /api/notifications?limit=20&offset=0` returns the authenticated customer's
own booking events or FMs' events for currently assigned facilities. Email attempts
reuse one Resend idempotency key. After 23h59m of unresolved delivery attempts the
record becomes `REVIEW_REQUIRED` for manual investigation; no second unprotected
send is attempted after Resend's 24-hour key retention window.

## Endpoints

`GET /api/return-policy/lifecycle-settings` and `PUT` on the same path are restricted
to System Administrator. The PUT body is `{ "key": "EXPIRY_REMINDER_DAYS" | "ABANDONED_REVIEW_DAYS", "value": 7, "expectedVersion": 0 }`.
Values must be nonnegative PostgreSQL integers; there is no business min/max. Each
change increments the row version and appends old/new values, actor and timestamp to
`return_audit` atomically. Defaults are inserted by the standard `db:seed` command after
migration; the lifecycle job fails closed if either row is missing.

Guest access routes and contracts are documented in [booking-tracking.md](booking-tracking.md).

All paths have `/api` prefix and private/no-store responses. Existing success/error
envelopes apply. UUID/body/query validation: 400; no session: 401; forbidden role/
facility/assignment: 403; missing/not-owned rental: 404; stale state/version or slot
conflict: 409; invalid business values/incomplete evidence: 422. POST creates return
requests/inspection attempts/photos/evidence/time proposals with 201; other actions
return 200. Auth requires active users; no implicit BOM/Admin operational authority.

| Method/path | Actor and purpose |
| --- | --- |
| GET `/rentals/:rentalId/return-slots?date=YYYY-MM-DD` | Owner; valid slots with at least 24-hour notice; advisory availability |
| GET/POST `/rentals/:rentalId/return-requests` | Owner; list own requests/create PENDING request |
| GET `/facilities/:facilityId/return-requests` | Facility FM; FS sees only requests assigned to that FS |
| GET `/return-requests/:requestId` | Owner, facility FM, currently assigned facility FS; detail, attempts/photos metadata, settlement revisions, refunds, audit |
| PATCH `/return-requests/:requestId` | Owner; PENDING edit, revalidates schedule and notice |
| POST `/return-requests/:requestId/cancel` | Owner; PENDING only |
| PATCH `/return-requests/:requestId/staff` | Facility FM; assign/change eligible active FS, reason required |
| POST `/return-requests/:requestId/confirm` | Assigned FS; PENDING → CONFIRMED, rechecks schedule/capacity/buffer |
| POST `/return-requests/:requestId/inspections` | Assigned FS; CONFIRMED/FAILED → INSPECTING, creates new attempt |
| PUT `/return-requests/:requestId/inspections/:inspectionId` | Assigned FS; save current DRAFT checklist/property data |
| POST `/return-requests/:requestId/inspections/:inspectionId/complete` | Assigned FS; evaluate frozen checklist; serious issue FAIL, minor PASS; remaining property alone does not FAIL |
| PUT `/return-requests/:requestId/inspections/:inspectionId/property` | Assigned FS; record resolved/stored property, receiver/time/proof |
| POST `/return-requests/:requestId/inspections/:inspectionId/photos` | Assigned FS; maximum five total per attempt, private existing photo adapter |
| GET `/return-requests/:requestId/inspections/:inspectionId/photos/:photoId` | Authorized reader; short-lived private photo URL |
| POST `/return-requests/:requestId/physical-return` | Assigned FS; initial confirmed actualReturnAt with reason/audit |
| POST `/return-requests/:requestId/evidence` | Assigned FS for TIME_CORRECTION; FM for REFUND, including after closure |
| GET `/return-requests/:requestId/evidence/:photoId` | Authorized reader; short-lived private evidence URL |
| POST `/return-requests/:requestId/time-changes` | Assigned FS; propose corrected time with proof/reason/idempotency key |
| POST `/return-requests/:requestId/time-changes/:changeId/decision` | Facility FM; approve/reject, append financial adjustment if already assessed |
| POST `/return-requests/:requestId/settlement` | Facility FM; approve damage/unused-rent exception, close rental/release occupancy atomically |
| POST `/return-requests/:requestId/refunds/confirm` | Facility FM; explicit manual completed-transfer confirmation with reference/proof/idempotency key |
| GET/PUT `/return-policy/checklist` | System Admin; read/append checklist version |
| GET/PUT `/facilities/:facilityId/return-calendar` | System Admin; timezone/holidays/reminder time and optional operating-hours replacement |
| GET/PUT `/return-policy/overdue-rate` | BOM only; integer 0–100%, expectedVersion/audit |

Facility queue query: `limit` 1–100 (20 default), `offset` >=0, optional request `status`.
Results order by creation/UUID descending. Request payloads are the shared input Zod
schemas in `packages/contracts/src/returns.ts`; integer-VND money uses decimal
strings. Mutation `expectedVersion` is the request version, except inspection save/
complete/property/photo actions use the inspection version. Reload detail after writes.

Calendar PUT accepts `{ expectedVersion, timezone, holidays, reminderTime,
operatingHours? }`. Each hours item is `{ dayOfWeek: 0..6, openTime: 'HH:mm',
closeTime: 'HH:mm' }`. Supplied hours replace that facility's existing operating
hours atomically and also affect check-in, which shares this source. Omission
preserves hours; a timezone change requires matching hours. Missing required calendar/
hours blocks scheduling. Existing 90-minute seed slots are reused without splitting
or moving them. Adjacent slots whose intervals violate the buffer are unavailable.
Changing calendar/hours preserves confirmed time snapshots and flags manual review.
The flag is informational for staff; there is no automatic appointment cancellation.

PENDING requests may select the same slot. Confirmation serializes facility
reservations and revalidates current configuration; exactly one overlapping
confirmation succeeds. The 24-hour rule applies at customer creation/edit, not the
later FS confirmation. An already started/past appointment cannot be confirmed.
Booking/request/financial mutations serialize under facility → booking → rental →
request locks to avoid conflicting schedule updates and duplicate assessment.
This favors simple consistency for MVP over parallel mutations within one facility.

Inspection results freeze on completion. Property handling/photos can be appended
on the latest PASS inspection before closure without changing those results. Every
issue needs a note and valid photo. Serious remaining-property classification still
does not itself FAIL. Closure needs actual physical receipt, latest PASS, financial
determination and resolved/stored property (receiver required for storage). Damage
fees require evidence from a completed inspection attempt and explicit FM approval.
Failed inspection sets MAINTENANCE; a later successful attempt is required to close.
Closure atomically sets rental CLOSED, linked active assignment COMPLETED/endedAt,
BOOKING capacity RELEASED and unit AVAILABLE. Refund completion is independent.

Overdue assessment compares the confirmed actual-return local calendar date with
rental expiry's local date: the next day is overdue. Initial assessment snapshots
rate/deposit once; corrections retain those snapshots and append revisions.
`fee = (deposit × integerRate + 50) / 100` in BigInt integer arithmetic. Approved
fees deduct from deposit; unused-rent refunds require FM reason. Debt is recorded
when fees exceed deposit or a correction reduces entitlement below money already
refunded. No automatic debt collection. Later BOM changes do not recalculate fees.

SePay PG currently has no refund-create/status adapter. This module therefore uses
the confirmed manual fallback. `/refunds/confirm` attests an **already completed**
manual transfer, never a refund submission. It records FM/reference/proof and does
not call a provider or rewrite original payment success. Automatic provider refund
integration is outstanding. Proof for refunds/time corrections is separate from
inspection photos so a frozen five-photo inspection does not prevent later audit.
For property disposition on an older failed attempt, proof may belong to any
inspection of the same request; its source attempt is audited. Capture new handoff
proof in the current retry attempt; five photos per attempt remains enforced.

Mixed manual refunds require both `depositRefundAmount` and `rentRefundAmount`
(integer-VND strings), summing to `amount` and each within its remaining entitlement.
Single-source transfers can omit both; the server records the unambiguous split.
A replay with a changed component conflicts. Historical ambiguous splits appear
in report reconciliation and block further confirmations requiring an unknown
component balance; no history is overwritten or guessed.
`depositHeld` is refundable deposit after approved fees and confirmed deposit
transfers, floored at zero. Reports include return refunds without rewriting the
original payment; overview separates FM return obligations from the legacy refund queue.
Private photos reuse the existing Cloudinary adapter; that is not the future
S3-compatible PDF contract implementation.

## Flow 3 operational and financial contracts (issue #148)

Facility queue items now include `context`; authorized FM/assigned FS detail has the
same context at the detail root. Customer-owned detail returns `context: null`.
The queue remains an array with the existing limit/offset/status/order behavior.
Context selects only:

- `booking`: id, bookingCode (nullable for historical bookings).
- `customer`: id (nullable account User ID, not a separate Customer entity),
  name and phone from the booking contact snapshot. Guests remain visible;
  email, auth tokens and profile data are not exposed.
- `rental`: id, status, expectedEndAt (ISO), depositSnapshot (integer VND string
  normalized from the rental deposit; never current catalog pricing).
- `unit`: id, code, unitTypeName, sizeLabel; `facility`: id, name.
- `assignedStaff`: id/name or null when unassigned, available only to operational readers.

### Settlement preview

`POST /api/return-requests/:requestId/settlement/preview` is facility-FM-only and
accepts the exact existing settlement input:

```json
{
  "expectedVersion": 5,
  "damageAmount": "0",
  "unusedRentRefundAmount": "300000",
  "reason": "Approved early-return exception"
}
```

The success envelope's data contains `requestId`, `version`, `canClose`,
`blockingReasons: [{ code, message }]` and `calculation`. Calculation contains
`depositSnapshot`, `rateSnapshot`, `overdueFeeAmount`, `damageAmount`,
`unusedRentRefundAmount`, `debtAmount` and all fields of the refund summary below.
Amounts are integer VND strings; rates and versions are numbers.

A valid but ineligible preview returns 200 with `canClose: false`. Blocker codes:
`REQUEST_NOT_INSPECTING`, `INSPECTION_NOT_PASSED`, `ACTUAL_RETURN_MISSING`,
`RENTAL_CLOSED`, `PROPERTY_UNRESOLVED`, `EVIDENCE_INVALID`,
`DAMAGE_EVIDENCE_MISSING`, `CONFIGURATION_MISSING`.
When actual return, calendar or rate is missing, `calculation` is null: missing
financial data is never represented as a zero fee. Otherwise calculations remain
available even when another closure condition blocks approval.

Preview validates ownership scope and request version under the existing lock
order, but writes no settlement/refund/audit/outbox, rental/request status, unit,
assignment or capacity changes. It neither uploads evidence nor calls a provider.
Stale preview versions return 409; malformed input 400; rent refund above the
booking rental fee 422. All current closure gates remain in the mutation.
Settlement recomputes under transaction locks. A rate or calendar change may alter
results even when request version is unchanged; a preview is not an approval token.
Completed settlement replay with matching financial inputs remains read-only and
returns the existing revision even with the original stale version. New mutations
always check version. Replays never authorize a new financial adjustment.

### Source-aware refund summary

Detail adds `refundSummary` at its root (null before any settlement); confirmation
adds `refundSummary` and the current request `version` alongside existing
id/amount/confirmedAt. Preview embeds summary fields in `calculation`:

```json
{
  "refundEntitlement": "1050000",
  "remainingRefund": "850000",
  "remainingDepositRefund": "650000",
  "remainingRentRefund": "200000",
  "confirmedDepositRefund": "100000",
  "confirmedRentRefund": "100000",
  "allocationKnown": true
}
```

Entitlement uses the latest settlement revision. Confirmed source payments use
immutable refund records and, for supported legacy records, their originating
settlement; later corrections never reallocate transfers. Existing historical
settlement DTOs remain compatible; use root summary for current balances.
If legacy source allocation is ambiguous, `allocationKnown` is false and the
four source fields are null. Aggregate entitlement/remaining remain known; detail
and history stay readable, but further confirmations needing unknown balances
return 409. No backfill or guessed split is performed.

After a correction, the sum of the two remaining source balances can exceed total
remainingRefund if one source was already overpaid. Confirmation checks both
source limits and the aggregate limit, plus the existing original payment cap.
Do not sum source fields to bypass the aggregate limit or move money between them.

Refund idempotent replay is checked before request-version validation: it returns
the same transfer ID and current summary/version, without a second transfer or
new audit. Compare amount/reference/evidence/actor and normalized stored allocation;
expectedVersion is a concurrency token, not part of the financial fingerprint.
Changed financial/reference/evidence payload conflicts. Both source components
remain required for new mixed transfers, including replay. A legacy transfer
whose stored components are both null accepts its original amount-only retry
when amount/reference/evidence/actor match, even if source allocation is unknown;
this never creates or rewrites a transfer. A single-source replay
may omit both and uses its stored source regardless of later refunds/corrections.
This is semantic payload equivalence, not byte-for-byte JSON comparison.

These endpoints have shared Zod input/response schemas, documented success
envelopes and Swagger/OpenAPI response shapes. Frontend branch integration still
needs to consume context/refundSummary, request preview, handle null/unknown values,
and refresh after transitions before enabling the corresponding controls.

## Database and compatibility

Additive generated migrations: `0037_graceful_sister_grimm`,
`0038_aromatic_metal_master`, `0039_woozy_toad_men`, `0040_solid_umar`,
`0041_useful_blindfold`, `0042_moaning_zaran`; generated using
`bun run db:generate`, never hand-edited. No existing rentals/payments are backfilled
or reclassified. The existing assignment status varchar supports new COMPLETED;
its shared constant/diagram are updated without a DDL alteration. Active occupancy
queries now also protect RETURN_PENDING/OVERDUE rentals.

Normal deployment preparation, against an aligned migration history:

```bash
bun run db:migrate
bun run db:seed
```

The seed inserts default 25% only when absent; it never overwrites BOM settings.
Admin must configure an actual return checklist/calendar/hours. There is no guessed
initial severity list or runtime rate fallback.

Local database originally had a divergent older migration journal. Migration 0042
was generated and applied successfully with the normal db:migrate command on the
existing localhost:5433/metastorage container. Regression checkout then detected
missing pricing tables despite older journal entries: the existing additive 0035
SQL was reviewed and applied transactionally to restore those tables/type/FKs.
No old journal entries were rewritten and no database reset/clone/new test DB was
created. This repairs that observed schema gap, not a full historical schema audit.

## Verification

Run from root, pointing to existing local containers. No cron/worker is registered
in integration fixtures. Object storage is mocked at its adapter boundary; DB/auth/
constraints/transactions are real. Fixtures use UUID scope and remove their own rows;
BOM configuration-change tests run in a rolled-back transaction to preserve settings.

```bash
export NODE_ENV=test LOG_LEVEL=silent PAYMENT_PROVIDER=mock
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/metastorage
export MY_STORAGE_LOCAL_DATABASE_URL="$DATABASE_URL"

bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/returns.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rentals-read.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/units/returns.policy.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/units/inspections.policy.test.ts apps/api/tests/units/bookings/bookings.service.test.ts
bun run --filter @metastorage/contracts test
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --limit 1000 --repo .
```

Observed after review fixes: return integration 21 passed / 260 assertions; rental-read integration
5 passed / 67 assertions; return policy 3 passed / 14 assertions; existing inspection/
booking-service regression 19 passed; shared contracts 12 passed. API/contracts/DB
typecheck and lint passed. Contracts lint initially found export ordering, which was
fixed before rerunning successfully. These results do not represent a full monorepo
suite, external provider/storage verification or UI verification.

Earlier booking-identity regression: 2 passed, 6 failed due to missing local
pricing_settings and overlapping legacy slot fixtures; not fixed by this feature.
Contract API/handover checks are implemented and tested with private storage mocked;
real S3 configuration is not verified. No production S3 verification; email delivery still depends on worker/provider configuration. Abandoned-property handling stays manual and legal review is still required. No commit/push/deploy performed.

GitNexus pre-edit occupancy impact: activeRental/findEligibleUnits/assignPhysicalUnit
LOW; releaseReservedUnit CRITICAL (check-in/cancellation callers), reported before
editing. New ReturnsService initially UNKNOWN/not indexed, corroborated through
text caller search. Refreshed index includes return symbols. Tracked diff detection
reports HIGH, 26 symbols/6 flows. CLI output lists only a subset and does not include
untracked-file changes; index also warned about truncated process walks/callees.
This is a limited graph review, not a clean full-coverage verdict. New module review
also used direct inspection, real DB tests, lint and typechecks.

## Review-fix verification (2026-10-20)

Current runs: returns integration 25 passed / 320 assertions; reports integration
11 / 60; selected checkout regression 5 / 80; rental reads 5 / 67; Redis booking
link retry 1 / 9. All use existing local containers; mail/storage boundaries are mocked.
The checkout run selected `authorized status verifies SePay|unauthorized status never|starts SePay checkout|concurrent same-key|full API flow`;
78 unrelated cases were filtered out. Global cron tests were not run against shared
local data. No skipped/filtered cases are counted as passed.
API/worker/contracts/database/shared typecheck and lint, API/worker build passed.
Real Resend/S3 delivery was not exercised. See plans/my-storage-review-fixes.md.

## Common system configuration

Global day settings, overdue rate and deposit-month policy now share `system_settings`.
See [system settings API](./system-settings.md). Legacy lifecycle/overdue/pricing paths
retain their contracts, access controls, shared versions and audit history. Migration
0044 plus `bun run db:migrate`'s transactional data step preserves existing values.
