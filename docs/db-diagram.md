# metastorage database diagram

## Flow 5 manual task assignment

`facility_tasks` stores manual work assigned by the active Facility Manager to an
active Facility Staff account at the same facility. Types are `INSPECT_UNIT`,
`PRINT_DOCUMENT` and `REPORT_TO_MANAGER`. Columns: UUID id, facility_id,
assigned_staff_id, created_by and assigned_by FKs, type, title (1..200 trimmed
characters), nullable description (up to 2000 characters), nullable storage_unit_id
and booking_id FKs, nonnegative integer version (default 0), lifecycle status,
nullable started_at, completed_by and completed_at, assigned_at, created_at and
updated_at. All foreign keys use RESTRICT to preserve assignments. Indexes cover
(facility_id, assigned_staff_id) and (facility_id, type).

Creation and reassignment validate current account roles, ACTIVE status and active,
unexpired facility assignments under row locks. Optional unit/booking references
must belong to the task facility. Reassignment uses the expected version; assigning
the same current staff member at the current version is a no-op. Lifecycle is
ASSIGNED → IN_PROGRESS → AWAITING_APPROVAL → COMPLETED. Only FM acceptance of the
latest report completes a task; the report stores the accepting FM and time. Task
metadata does not change booking assignees, inspection permissions, physical
occupancy, contracts, rentals or maintenance. Existing Flow 2/contract APIs remain
authoritative for execution; creating a printing task does not assert that a
document has actually been printed.

Facility staff membership cannot be revoked while bookings or tasks remain
assigned; those items must be reassigned first.

## Flow 5 staff work reports (confirmed 2026-10-22)

`facility_task_reports`: UUID id, task_id FK facility_tasks (RESTRICT),
submitted_by FK users (RESTRICT), nullable accepted_by FK users and accepted_at,
content text (trimmed, 1..5000 characters), submitted_at timestamptz default now.
Index (task_id, submitted_at, id) supports ordered history; a partial unique index
allows at most one accepted report per task. One task has many immutable
submissions; each submission keeps its original author even after reassignment.
No edit/delete report API.

Only the current active assigned FS with a valid same-facility assignment may
submit. Same-facility FM and current assigned FS may read task report history.
Submission rechecks authorization under task/account/membership row locks in the
same order as task reassignment. Identity/time are server-generated. Reporting
does not itself complete a task or mutate booking/unit/rental/inspection state.
The assigned-facility FM accepts the latest report to complete the task.

## Flow 5 physical-unit maintenance history

`storage_unit_maintenance_history` records each allowed maintenance transition:
UUID id, storage_unit_id FK, action (`ENTER_MAINTENANCE` or `EXIT_MAINTENANCE`),
previous/next storage-unit status, optional reason, changed_by FK users, and
changed_at. A status update and its history record commit in the same transaction.
The actor and reason are retained for audit; history prevents hard deletion of the
physical unit and the acting account.

## Booking contract PDFs (confirmed 2026-10-20)

MVP customer identity is existing booking contactName/contactEmail/contactPhone only;
no CCCD/passport columns or identity-document storage are introduced.
`booking_contracts`: UUID id, booking_id FK, immutable positive version (unique per
booking), UPLOADED/ISSUED status, filename, byte_size (1..20MiB), positive page_count,
SHA256, private unique object_key, idempotency_key unique per booking, uploaded_by/at,
issued_by/at nullable until issuance, JSONB terms_snapshot nullable until issuance.
The latest ISSUED version is current; uploading alone never replaces the issued
version or creates a signature. No revoke, signing, renewal or transfer workflow.
`booking_contract_audit`: UUID id, booking_id/contract_id/actor_id FKs, action,
JSONB details, occurred_at. Immutable upload/issuance/handover audit.
`handover_inspections.contract_id`: nullable FK booking_contracts; existing handovers
remain null, new handovers require an issued valid linked PDF and save its exact
version. Booking → Rental remains the authoritative contract linkage after handover.
Issue snapshots existing customer/facility/unit-type/pricing/deposit/term and verified
successful payment. Issuance and new handover share booking-first row locks; a stale
current-issued expectation conflicts. No uploads/issues after physical handover.
Private authenticated Cloudinary raw PDFs use unique immutable object keys as public IDs;
no public storage URLs in DTOs. Backend
checks role, ownership/facility scope and linkage before reading bytes. Failed DB
writes clean up only their new object; preserved versions are never deleted by API.

## Return workflow (confirmed 2026-10-20)

This additive feature is independent of handover inspections/check-in checklist.
`return_checklist_versions`: UUID id, unique integer version, JSONB items
(code/label/group/serious), created_by FK users and created_at. Versions are immutable;
Admin appends a version with optimistic concurrency. There is no inferred initial
checklist; all four confirmed groups must be configured before starting inspection.

`facility_return_calendars`: facility_id PK/FK, timezone, JSONB holiday dates,
reminder_time (09:00 default), version, updated_by FK users and updated_at. Admin
configures it; operating hours and check_in_slots remain existing sources. Slots
are 90 minutes, capacity one and a 15-minute cooldown; schedule changes flag
confirmed appointments for manual review while preserving time snapshots.

`system_settings` key OVERDUE_FEE_RATE stores integer rate 0–100 (seed 25),
version, updated_by FK users nullable for seed and updated_at. Changes are BOM-only
and audited. Missing policy blocks financial assessment; no runtime fallback.

`return_requests`: UUID id, rental_id/facility_id/slot_id FKs, local date, UTC starts_at/
ends_at and timezone snapshots, assigned_staff_id FK nullable, reason, status
(PENDING/CONFIRMED/INSPECTING/FAILED/COMPLETED/CANCELLED), version, manual_review_required,
created_by FK nullable for a guest magic-link submission, and created_at. Partial unique index permits only one open return per
rental. Rental/booking locks serialize workflow and financial changes; schedule
capacity/buffer checks serialize on the facility row.
PENDING does not reserve capacity. A partial unique (facility_id,date,slot_id) index
for CONFIRMED/INSPECTING/FAILED backs capacity-one confirmation; buffer conflicts
between different slots are checked under the same facility lock.

`return_inspections`: UUID id, request_id FK, unique (request_id, attempt),
checklist_version_id FK, JSONB definition/results snapshots, DRAFT/PASS/FAIL status,
version, property_disposition/receiver/handled_at/evidence_photo_ids, created_by,
completed_by/at and created_at. FAILED retries append a new attempt and change the
request FAILED → INSPECTING; frozen results are never overwritten. Remaining property
does not by itself FAIL inspection but blocks closure until resolved or stored.
`return_inspection_photos`: UUID id, inspection_id/uploaded_by FKs, filename, MIME,
byte_size, private storage public_id/format and created_at; maximum five per inspection.
No photo bytes or public URLs are persisted in the normal inspection DTO.
`return_evidence_photos`: UUID id, request_id/uploaded_by FKs, purpose
(TIME_CORRECTION or REFUND), filename/MIME/byte_size, private public_id/format and
created_at. Financial/time evidence is independent of frozen inspection evidence
and its five-photo limit, allowing proof to be added after rental closure.

`return_time_changes`: UUID id, request_id FK, previous_at/proposed_at, reason,
JSONB evidence_photo_ids, idempotency_key, PENDING/APPROVED/REJECTED status,
proposed_by/decided_by FKs, decision_reason/decided_at and created_at. Unique
(request_id,idempotency_key). FS proposes corrections; assigned-facility FM decides.
Initial physical receipt is also audited. Approvals compare previous_at against
the current confirmed value to reject competing corrections.

`return_settlements`: immutable UUID id and unique (request_id,revision), FK request,
integer-VND numeric(14,0) deposit/overdue/damage/unused-rent-refund/refund-entitlement/
debt snapshots, integer rate_snapshot, actual_return_at, refund_due_date,
calendar_snapshot JSONB, approved_by FK, reason and approved_at. Corrections append
new revisions, retain the original rate/deposit snapshot, and calculate debt if
already-refunded money exceeds the corrected entitlement. No automatic collection.
SLA is three business days following FM approval, excluding weekends and the saved
holiday calendar. Original revision deadlines are retained in history.

`return_refunds`: UUID id, request_id/payment_id/settlement_id FKs, positive integer-VND
amount, reference, evidence_photo_ids JSONB, idempotency_key, confirmed_by FK and
confirmed_at. Unique request/idempotency and transfer reference; rows represent
explicitly confirmed manual transfers, not refund submissions. No existing payment
status is overwritten. Settlement closure does not wait for transfers.

`return_audit`: UUID id, nullable request_id/facility_id FKs, nullable actor_id FK, action,
JSONB details and created_at. Guest request creation has null actor_id/created_by and
details containing source `GUEST_MAGIC_LINK` and the verified bookingId; the request's
rental also identifies that booking. No fake account or session token is persisted.
Account/Staff mutations continue to record their users FK. Append-only approvals/config/transition records.
No unrelated workflow, renewal/upgrade or check-in policy is introduced.

Flow 4 pricing: `system_settings` key DEPOSIT_MONTHS stores positive integer value
and shared positive pricing version, nullable updated_by FK users and updated_at. The one-month starting policy is explicitly seeded, never a runtime
fallback. Missing policy prevents new quotes. `unit_types.monthly_price` remains
the sole current global price per type. Updating either price or deposit locks
the settings row first, validates expectedVersion, increments the shared version
and appends `pricing_changes` in the same transaction. Existing booking monetary
snapshots are never recalculated. Drafts created before a change keep their
snapshot, including when they start payment after the change.

`pricing_changes`: UUID `id`, unique positive integer `version`, enum `operation`
(`DEPOSIT_POLICY`, `UNIT_TYPE_PRICE`), required JSONB `before`/`after` storing the
specific changed values, required `changed_by` FK users (RESTRICT), and timestamp
`changed_at`. No API modifies or deletes audit records. Settings are not exposed
to public/FS/FM/SA callers; configuration endpoints require BOM.

This diagram records every table and column currently declared in
`packages/database/src/schema`. Flow 2 now activates rentals at Staff handover; guest account access remains future work;
Booking and Payment are introduced by issue #18.

Issue #24 adds `handover_inspections` and `inspection_photos` under the H6_V1 decision:

- One inspection per check-in verification; linked to the booking, facility, exact assignment
  and physical unit. A changed assignment/verification requires a new inspection, retaining history.
- New inspections use checklist version `H6_4PASS_V1`: DRAFT accepts incomplete results;
  COMPLETED requires PASS for ASSIGNED_UNIT, DOOR_LOCK, UNIT_CONDITION and EXISTING_INVENTORY.
  Notes/photos/signature are optional. Results and the immutable definition snapshot are stored
  with the inspection. Nullable checklist columns distinguish historical records; no inferred PASS
  or backfill. Saving explicit results on an old draft adopts the new policy; completed history stays unchanged.
- FM assignment atomically sets a free physical unit RESERVED. Other bookings cannot reserve
  that unit, even for non-overlapping dates. Reassign/cancel/no-show release RESERVED units only
  if no other live assignment or ACTIVE rental remains. Handover changes RESERVED to OCCUPIED.
- Completion records actor/time and freezes the baseline; it does not create a Rental,
  consume verification, mark CHECKED_IN or change the unit's occupancy (#25).
- `version` plus booking/inspection row locks reject stale/concurrent writes. Only current
  verified assignments can be edited. Completed and superseded records remain readable by facility scope.
- Photos are private authenticated evidence, bounded to 8 JPEG/PNG/WebP files, 3 MiB each.
  New evidence is stored as authenticated Cloudinary assets, referenced by public ID and format.
  Nullable Base64 content is retained only for legacy evidence until verified migration;
  metadata-only DTOs avoid loading bytes in normal lists. Photo GET uses private/no-store caching.
- FM prepares unit/staff assignment and monitors records; only the assigned Facility Staff
  can verify, edit inspection evidence, complete inspection and confirm handover.
- A separate handover transaction records `handed_over_by/at`, creates exactly one ACTIVE rental
  per booking, marks booking CHECKED_IN, unit OCCUPIED (business In Use), and consumes verification.
  Rental dates use the registered booking period. No PIN/NFC or access-control requirement.
- Signature is optional and not a completion requirement. No automatic AI comparison or
  checkout/deposit charging is implemented by this issue.

```mermaid
erDiagram
  facility_tasks {
    uuid id PK
    uuid facility_id FK
    uuid assigned_staff_id FK
    uuid created_by FK
    uuid assigned_by FK
    facility_task_type type
    facility_task_status status
    varchar title
    text description
    uuid storage_unit_id FK "nullable"
    uuid booking_id FK "nullable"
    integer version
    timestamptz started_at "nullable"
    uuid completed_by FK "nullable"
    timestamptz completed_at "nullable"
    timestamptz assigned_at
    timestamptz created_at
    timestamptz updated_at
  }
  facility_task_reports {
    uuid id PK
    uuid task_id FK
    uuid submitted_by FK
    uuid accepted_by FK "nullable"
    timestamptz accepted_at "nullable"
    text content
    timestamptz submitted_at
  }
  facilities ||--o{ facility_tasks : scopes
  users ||--o{ facility_tasks : performs
  users ||--o{ facility_tasks : creates
  users ||--o{ facility_tasks : assigns
  storage_units o|--o{ facility_tasks : references
  bookings o|--o{ facility_tasks : references
  facility_tasks ||--o{ facility_task_reports : records
  users ||--o{ facility_task_reports : submits
  users o|--o{ facility_task_reports : accepts
  system_settings {
    text key PK
    jsonb value
    text description
    integer version
    uuid updated_by FK
    timestamptz updated_at
  }
  system_setting_changes {
    uuid id PK
    text key FK
    jsonb before
    jsonb after
    uuid actor_id FK
    text source
    timestamptz created_at
  }
  system_settings ||--o{ system_setting_changes : audits
  users ||--o{ system_setting_changes : changes
  pricing_changes {
    uuid id PK
    integer version UK
    pricing_change_operation operation
    jsonb before
    jsonb after
    uuid changed_by FK
    timestamptz changed_at
  }
  users o|--o{ system_settings : updates
  users ||--o{ pricing_changes : changes
  handover_inspections {
    uuid id PK
    uuid booking_id FK
    uuid facility_id FK
    uuid physical_unit_id FK
    uuid unit_assignment_id FK
    uuid verification_id FK,UK
    varchar unit_code
    varchar policy_version
    varchar checklist_version "nullable legacy"
    jsonb checklist_results "nullable legacy"
    jsonb checklist_definition "nullable legacy"
    inspection_status status
    integer version
    boolean correct_unit
    text condition_notes
    uuid created_by FK
    uuid completed_by FK
    timestamptz completed_at
    uuid handed_over_by FK
    timestamptz handed_over_at
    timestamptz created_at
    timestamptz updated_at
  }
  inspection_photos {
    uuid id PK
    uuid inspection_id FK
    uuid uploaded_by FK
    varchar filename
    varchar mime_type
    integer byte_size
    text data_base64 "nullable legacy"
    text cloudinary_public_id
    varchar cloudinary_format
    timestamptz created_at
  }
  check_in_slots ||--o{ bookings : schedules
  users ||--o{ accounts : authenticates_with
  users ||--o{ sessions : signs_in_with
  users ||--o{ facility_assignments : receives
  facilities ||--o{ facility_assignments : has
  facilities ||--o{ facility_unit_types : offers
  unit_types ||--o{ facility_unit_types : shared_by
  facility_unit_types ||--o{ storage_units : materializes
  facility_unit_types ||--o{ reservation_drafts : selects
  facility_unit_types ||--o{ capacity_allocations : allocates
  facility_unit_types ||--o{ bookings : books
  unit_types ||--o{ storage_units : materializes
  facilities ||--o{ storage_units : contains
  facilities ||--o{ facility_operating_hours : schedules
  facilities ||--o{ reservation_drafts : receives
  unit_types ||--o{ reservation_drafts : selects
  unit_types ||--o{ capacity_allocations : allocates
  facilities ||--o{ capacity_allocations : reserves
  users o|--o{ bookings : saves_history
  users o|--o{ bookings : assigned_to
  bookings ||--o| rentals : becomes
  facilities ||--o{ rentals : hosts
  storage_units ||--o{ rentals : occupies
  rentals ||--o{ rental_charges : owes
  users ||--o{ rental_charges : submits
  users o|--o{ rental_charges : approves
  rental_charges ||--o{ payments : attempts
  bookings ||--o{ payments : records
  users o|--o{ payments : confirms_manual_refund
  rental_charges ||--o{ rental_charge_adjustments : adjusts
  rental_charges ||--o{ rental_charge_events : audits
  rental_charges ||--o{ rental_charge_refunds : refunds
  payments ||--o{ rental_charge_refunds : refunds
  return_requests ||--o{ return_settlements : revises
  rental_charges o|--o{ return_settlements : debt_obligation
  bookings ||--o{ checkin_verifications : verifies
  bookings ||--o{ handover_inspections : records_baseline
  facilities ||--o{ handover_inspections : scopes
  storage_units ||--o{ handover_inspections : inspected
  unit_assignments ||--o{ handover_inspections : snapshots
  checkin_verifications ||--o| handover_inspections : authorizes
  users ||--o{ handover_inspections : creates_and_completes
  handover_inspections ||--o{ inspection_photos : evidence
  users ||--o{ inspection_photos : uploads
  users ||--o{ checkin_verifications : performs
  facilities ||--o{ checkin_verifications : scopes
  unit_assignments ||--o{ checkin_verifications : snapshots

  check_in_slots {
    uuid id PK
    text name
    time start_time
    time end_time
  }

  users {
    uuid id PK
    text name
    varchar email UK
    boolean email_verified
    text image
    varchar phone UK
    varchar password_hash
    role role
    status status
    timestamptz created_at
    timestamptz updated_at
  }

  accounts {
    text id PK
    uuid user_id FK
    text account_id
    text provider_id
    text access_token
    text refresh_token
    text id_token
    timestamptz access_token_expires_at
    timestamptz refresh_token_expires_at
    text scope
    text password
    timestamptz created_at
    timestamptz updated_at
  }

  sessions {
    text id PK
    uuid user_id FK
    text token UK
    timestamptz expires_at
    text ip_address
    text user_agent
    timestamptz created_at
    timestamptz updated_at
  }

  verifications {
    text id PK
    text identifier
    text value
    timestamptz expires_at
    timestamptz created_at
    timestamptz updated_at
  }

  facility_assignments {
    uuid id PK
    uuid user_id FK
    uuid facility_id FK
    timestamptz assigned_at
    timestamptz ended_at
    boolean is_active
    role role
  }

  facilities {
    uuid id PK
    varchar code UK
    varchar name
    text address
    text description
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  unit_types {
    uuid id PK
    varchar code UK
    varchar name
    varchar size_label
    numeric length_m
    numeric width_m
    numeric height_m
    numeric size_cbm
    integer monthly_price
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  facility_unit_types {
    uuid facility_id PK,FK
    uuid unit_type_id PK,FK
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  storage_units {
    uuid id PK
    uuid facility_id FK
    uuid unit_type_id FK
    varchar code UK
    varchar floor "nullable"
    varchar location_description "nullable"
    storage_unit_status status
    timestamptz created_at
    timestamptz updated_at
  }

  storage_unit_maintenance_history {
    uuid id PK
    uuid storage_unit_id FK
    storage_unit_maintenance_action action
    storage_unit_status previous_status
    storage_unit_status next_status
    text reason "nullable"
    uuid changed_by FK
    timestamptz changed_at
  }
  storage_units ||--o{ storage_unit_maintenance_history : records
  users ||--o{ storage_unit_maintenance_history : changes

  facility_operating_hours {
    uuid id PK
    uuid facility_id FK
    integer day_of_week
    time open_time
    time close_time
    varchar timezone
  }

  reservation_drafts {
    uuid id PK
    uuid facility_id FK
    uuid unit_type_id FK
    timestamptz check_in_at
    timestamptz rental_end_at
    integer duration_months
    varchar contact_name
    varchar contact_email
    varchar contact_phone
    reservation_draft_status status
    reservation_pricing_status pricing_status
    jsonb pricing "nullable, immutable checkout price snapshot"
    timestamptz created_at
    timestamptz updated_at
  }

  capacity_allocations {
    uuid id PK
    uuid facility_id FK
    uuid unit_type_id FK
    uuid reference_id
    capacity_allocation_kind kind
    capacity_allocation_status status
    timestamptz starts_at
    timestamptz ends_at
    timestamptz created_at
    timestamptz updated_at
  }

  bookings {
    uuid id PK
    varchar booking_code UK
    uuid user_id FK "nullable for guest; ON DELETE SET NULL"
    varchar access_token_hash "nullable"
    varchar contact_name "nullable before payment; booking-specific"
    varchar contact_email "nullable before payment; booking-specific"
    varchar contact_phone "nullable before payment; booking-specific"
    uuid facility_id FK
    uuid unit_type_id FK
    integer requested_months
    date check_in_date
    uuid check_in_slot_id FK
    timestamptz rental_end_at
    numeric monthly_rate_snapshot
    numeric rental_fee_amount
    numeric deposit_amount
    numeric total_amount
    varchar status "default DRAFT"
    uuid assigned_staff_id FK "nullable"
    varchar qr_token_hash UK
    timestamptz created_at
    timestamptz updated_at
  }

  rentals {
    uuid id PK
    uuid booking_id FK,UK
    uuid facility_id FK
    uuid physical_unit_id FK
    varchar status
    timestamptz start_at
    timestamptz expected_end_at
    timestamptz actual_return_at "nullable"
    timestamptz closed_at "nullable"
    numeric deposit_amount
    timestamptz created_at
    timestamptz updated_at
  }

  rental_charges {
    uuid id PK
    uuid rental_id FK
    rental_charge_source source
    rental_charge_category category
    numeric amount "integer VND"
    varchar currency "VND"
    text evidence
    date due_date "nullable for return debt; extra charges require a due date"
    rental_charge_status status
    uuid created_by FK
    uuid approved_by FK "nullable"
    text decision_reason "nullable"
    timestamptz disputed_at "nullable"
    timestamptz created_at
    timestamptz updated_at
  }

  rental_charge_adjustments {
    uuid id PK
    uuid charge_id FK
    uuid settlement_id FK "nullable"
    rental_charge_adjustment_direction direction
    numeric amount "positive integer VND"
    text reason
    uuid created_by FK
    timestamptz created_at
  }

  rental_charge_events {
    uuid id PK
    uuid charge_id FK
    rental_charge_event_type type
    uuid actor_id FK "nullable for provider/system events"
    text reason "nullable"
    jsonb details
    timestamptz created_at
  }

  rental_charge_refunds {
    uuid id PK
    uuid charge_id FK
    uuid payment_id FK
    uuid settlement_id FK "nullable"
    numeric amount "positive integer VND"
    text reason
    rental_charge_refund_status status
    text reference "nullable until confirmed"
    uuid confirmed_by FK "nullable"
    timestamptz confirmed_at "nullable"
    timestamptz created_at
  }

  return_settlements {
    uuid id PK
    uuid request_id FK
    uuid rental_charge_id FK "nullable debt obligation"
    integer revision
    numeric deposit_snapshot
    integer rate_snapshot
    numeric overdue_fee_amount
    numeric damage_amount
    numeric unused_rent_refund_amount
    numeric refund_entitlement
    numeric debt_amount
    timestamptz actual_return_at
    date refund_due_date
    jsonb calendar_snapshot
    uuid approved_by FK
    text reason
    timestamptz approved_at
  }

  payments {
    uuid id PK
    uuid booking_id FK "nullable for legacy checkout; required in target flow"
    uuid draft_id FK "nullable; legacy checkout only"
    uuid rental_charge_id FK "nullable; source-specific charge attempt"
    varchar provider
    varchar provider_payment_id
    varchar payment_code UK
    varchar hold_token_hash "nullable for charge payment"
    varchar idempotency_key UK
    numeric total_amount
    varchar currency
    payment_status status
    timestamptz paid_at
    timestamptz expires_at "nullable payment quote expiry"
    varchar refund_reason "nullable; NO_CAPACITY, CHECK_IN_CLOSED, OFFERING_UNAVAILABLE, CUSTOMER_CANCELLATION or NO_SHOW"
    numeric refund_amount "nullable; legacy refund falls back to total_amount"
    numeric deposit_forfeited_amount "NOT NULL DEFAULT 0"
    varchar refund_reference "nullable; bank transfer reference/evidence"
    timestamptz refunded_at "nullable"
    uuid refunded_by FK "nullable; ON DELETE RESTRICT"
    timestamptz created_at
    timestamptz updated_at
  }

  payment_provider_events {
    uuid id PK
    varchar provider
    varchar provider_event_id
    uuid payment_id FK
    varchar payment_code
    numeric amount
    varchar transfer_type
    varchar reference_code
    payment_provider_event_status status
    jsonb payload_metadata
    timestamptz created_at
    timestamptz updated_at
  }

  unit_assignments {
    uuid id PK
    uuid booking_id FK
    uuid physical_unit_id FK
    uuid assigned_by FK
    varchar status
    timestamptz assigned_at
    timestamptz ended_at
    text reason
  }

  checkin_verifications {
    uuid id PK
    uuid booking_id FK
    uuid facility_id FK
    uuid staff_id FK
    uuid unit_assignment_id FK
    checkin_verification_status status
    timestamptz verified_at
    timestamptz consumed_at
    timestamptz invalidated_at
    text invalidated_reason
    timestamptz created_at
    timestamptz updated_at
  }
```

## Existing constraints and behavior

- New booking access emails have an intent/snapshot in the existing durable outbox,
  inserted in the payment transaction. The worker prepares the 24-hour tracking link
  and encrypted payload, then bridges to the existing BullMQ job/delivery ID.
  Legacy jobs remain readable; ENQUEUED differs from provider-confirmed SENT.

- UUID primary keys on `users`, `facilities`, `facility_assignments`,
  `facility_tasks`, `facility_task_reports`, `storage_unit_maintenance_history`,
  `unit_types`, `storage_units`, `facility_operating_hours`, `check_in_slots`,
  `reservation_drafts` and `capacity_allocations` default to generated random UUIDs. Auth tables
  `accounts`, `sessions` and `verifications` use text primary keys.
- `users.email`, `users.phone`, `facilities.code`, `storage_units.code` and
  `sessions.token` are unique. `users.phone` is nullable. Booking contact email is not unique.
- Varchar limits are `users.email` 255, `users.phone` 20,
  `users.password_hash` 255; Booking contact name/email/phone 150/320/32; `facilities.code` 50, `facilities.name` 150;
  `unit_types.code` 80, `unit_types.name` 100, `unit_types.size_label` 50;
  `storage_units.code` 80; `facility_operating_hours.timezone` 64; and
  reservation draft contact name/email/phone 150/320/32.
- Nullable columns are `users.image`, `users.phone`, `users.password_hash`,
  `users.role`, `users.status`, `bookings.user_id`, `facilities.description`,
  `facility_assignments.ended_at`, `storage_units.floor`,
  `storage_units.location_description`, `storage_unit_maintenance_history.reason`,
  `facility_tasks.description`, `facility_tasks.storage_unit_id`,
  `facility_tasks.booking_id`,
  `sessions.ip_address`,
  `sessions.user_agent`, and the optional token, expiry, scope and password
  fields in `accounts`. Every other column shown is required.
- User role/status values are defined once in `packages/contracts/src/users.ts` and
  reused by Drizzle and API contracts. Changing those values still requires a database migration.
- Enum values are `role`: `CUSTOMER`, `FACILITY_STAFF`, `FACILITY_MANAGER`,
  `BUSINESS_OPERATION_MANAGER`, `SYSTEM_ADMIN`; `status`: `ACTIVE`, `INACTIVE`;
  `storage_unit_status`: `AVAILABLE`, `RESERVED`, `OCCUPIED`, `MAINTENANCE`,
  `INSPECTION`, `RETURN_PENDING`, `LOCKED`, `INACTIVE`;
  `storage_unit_maintenance_action`: `ENTER_MAINTENANCE`, `EXIT_MAINTENANCE`;
  `facility_task_type`: `INSPECT_UNIT`, `PRINT_DOCUMENT`, `REPORT_TO_MANAGER`;
  `reservation_draft_status`: `DRAFT`; `reservation_pricing_status`:
  `PRICING_NOT_CONFIGURED`, `PRICED`; `capacity_allocation_kind`: `HOLD`, `BOOKING`; and
  `capacity_allocation_status`: `ACTIVE`, `RELEASED`, `EXPIRED`.
- Composite unique `accounts(provider_id, account_id)` ensures one owner per provider
  identity, including concurrent OAuth linking. Existing duplicates must be resolved
  explicitly before applying this constraint; never merge users automatically.
- Composite unique indexes exist on `facility_assignments(user_id, facility_id)` and
  `facility_operating_hours(facility_id, day_of_week)`.
- Each User may work at at most one Facility at a time. A partial unique index
  `facility_assignments_active_user_idx` on `user_id WHERE is_active = true`
  enforces this rule, including concurrent assignments. Inactive assignments are
  retained. End or revoke the current assignment before assigning another Facility;
  elapsed `ended_at` rows must be deactivated before reassigning. The API does not
  automatically revoke a still-effective assignment to another Facility.
- Login through the shared API client and `GET /api/auth/me` include
  `user.assignedFacilityId`: the current assignment's Facility ID or `null`.
  Only assignments matching the User's Facility Staff/Manager role, with
  `is_active = true` and no elapsed `ended_at`, qualify. This field is derived,
  not a new column on User or Session, and does not replace backend scope checks.
- Before applying the single-Facility index migration, check for Users with
  multiple `is_active = true` assignments. Resolve them explicitly before
  migrating; the migration must not choose a Facility or discard history.
- `unit_types.code` is globally unique. `facility_unit_types` has a composite
  primary key `(facility_id, unit_type_id)` and an index on `unit_type_id`.
- `storage_units`, `bookings`, `reservation_drafts` and `capacity_allocations`
  each use a composite foreign key `(facility_id, unit_type_id)` to
  `facility_unit_types(facility_id, unit_type_id)`. `capacity_allocations.reference_id` is a UUID
  reference value without a database foreign key at this stage.
- User foreign keys use `ON DELETE CASCADE` for `accounts`, `sessions` and
  `facility_assignments`, and `ON DELETE SET NULL` for `bookings.user_id`.
  Facility task/report and unit maintenance history references use `ON DELETE RESTRICT`
  to preserve assigned work, reports, transition history and actor references.
  Facility foreign keys use `ON DELETE CASCADE` for `facility_unit_types`,
  `storage_units`, `facility_operating_hours` and `facility_assignments`, and
  `ON DELETE RESTRICT` for reservation drafts and capacity allocations.
  Composite Facility Unit Type foreign keys use `ON DELETE RESTRICT`.
  `facility_unit_types.unit_type_id` references `unit_types.id` with
  `ON DELETE RESTRICT`, so linked unit types cannot be deleted.
- `created_at` and `updated_at` columns default to `now()` wherever shown;
  `assigned_at` also defaults to `now()`. `facilities.is_active`,
  `unit_types.is_active`, `facility_unit_types.is_active` and
  `facility_assignments.is_active` default to true.
  `storage_units.status` defaults to `AVAILABLE`,
  `reservation_drafts.status` to `DRAFT`,
  `reservation_drafts.pricing_status` to `PRICING_NOT_CONFIGURED`, and
  `capacity_allocations.status` to `ACTIVE`. The default operating timezone is
  `Asia/Ho_Chi_Minh`.

Unit Types are a shared catalog across facilities; their definition and monthly
price are stored once in `unit_types`. Exact length, width and height are positive
decimal measurements in meters (`length_m`, `width_m`, `height_m`). `size_cbm`
is a stored generated column in cubic meters equal to `length_m * width_m * height_m`.
Catalog floor area is calculated from length and width when reading; it is not stored.
Each physical
`storage_unit` inherits these dimensions through `unit_type_id`; physical units
with different dimensions must reference different unit types. The `facility_unit_types` join table
records which facilities offer each type and can disable an offering without
disabling the shared type. Availability and capacity are scoped to the pair
`(facility_id, unit_type_id)`, never to the shared Unit Type ID alone.

For public catalog queries, a facility is eligible when it is active and has at
least one `storage_units.status = AVAILABLE` for an active shared type and active
facility offering. Unit Type availability is grouped by `unit_types.id` within
the selected facility and counts only `AVAILABLE` units. Reservation, hold and
booking flows reference the Unit Type ID; a physical unit is assigned later by
operations and is never selected by the customer.

## Guest booking and optional account history (supersedes #77/#92 Customer model)

There is no Customer table. A guest can rent without creating a User. Each Booking
owns its contact name, email and phone; equal emails do not merge contacts or grant
access to any other Booking. Contact remains on the client until payment starts.

`bookings.user_id` is nullable and references the authenticated account that saved
this Booking. Creating a Booking while signed in records the session user, never a
client-supplied user ID. Guest bookings have no account owner. Signing up, verifying
an account email, or logging in never attaches guest bookings by email. To save a
previous guest booking, the user must explicitly verify that booking and choose
“Save to account”. OTP and claim endpoints remain separate implementation work;
claim conflict behavior is TBD until that endpoint is designed.

Guest access uses a 24-hour magic link sent only to the contact email stored on that
Booking. Exchanging it creates a short-lived session scoped to that Booking; requesting
a replacement link revokes the previous magic grant and is rate-limited/audited. The
guest session does not attach the Booking to an account; account history ownership
remains independent of guest access.
Deleting an account sets its Booking user IDs to NULL and preserves business history.
Payments and Rentals derive account ownership through Booking, with no duplicated
Customer or user foreign keys.

The legacy reservation/payment workflow still creates a Booking at payment success.
It now copies contact directly from that reservation draft and creates no Customer.
Its account association is not implemented; authenticated ownership is supported by
the new Booking draft endpoint. `POST /api/bookings/:bookingId/pay` starts payment
on that draft, preserving ownership and snapshot pricing. The booking webhook
finalizes the same row or records a full manual refund when a late payment cannot
receive capacity/check-in. See `docs/booking-payment.md`.
The project uses disposable dev data: no backfill or historical synchronization.

## Payment and Booking notes (#18)

- New checkout drafts store an immutable `pricing` snapshot: rental fee equals
  the monthly rate times the requested months; the deposit equals one month's
  rate; total equals rental fee plus deposit, in VND. Payments use this stored
  quote even if catalog prices change later. Legacy unpriced drafts must be recreated.

- Booking stores per-booking contact and pricing snapshots. All three contact fields
  are either NULL together or present together; every non-DRAFT state requires all
  three. Operational readers use these fields directly and exclude DRAFT.
- `bookings.user_id` is nullable, indexed and references users with ON DELETE SET NULL.
  It controls saved account history, not guest access. Payment and Rental have no
  customer_id columns.
- paidAt comes from the earliest non-null payments.paid_at with status SUCCEEDED,
  REFUND_PENDING or REFUNDED. Booking queries join slots and aggregate payments before joining,
  preventing duplicate booking rows. Other consumers retain their timestamp
  projection until their dedicated query refactors.
- Booking status defaults to DRAFT; a CHECK limits it to DRAFT, CONFIRMED,
  CANCELLED, NO_SHOW or CHECKED_IN. Pricing columns remain required.
- Bookings retain nullable unique booking_code/qr_token_hash, nullable
  assigned_staff_id and nullable access_token_hash. Operational lists/details
  exclude DRAFT; drafts cannot be assigned a unit/staff or verified through QR.
- Payment stores the transaction total, currency, provider references, status
  and paid_at; the monthly rate, rental fee and deposit breakdown belong to
  Booking. The legacy checkout obtains this breakdown from the immutable draft
  pricing snapshot when creating a confirmed Booking. Its readers project
  booking contact and date/slot timestamps for the existing API contracts.
  The payment simplification migration removes the redundant breakdown columns;
  apply it together with the compatible backend before using the checkout.
- Payment status values are PENDING, SUCCEEDED, FAILED, REFUND_PENDING and REFUNDED,
  defined in the payment contract and reused by Drizzle. A valid incoming payment
  that cannot receive capacity/check-in becomes REFUND_PENDING with paid_at and
  refund_reason, while its booking stays DRAFT and holds are released. The full
  payment total (rent plus deposit) must be refunded manually. Only an admin or
  business operations manager may record REFUND_PENDING -> REFUNDED with a
  nonblank transfer reference, server timestamp and actor. Replays with the same
  reference preserve the original audit; a different reference conflicts.
- Customer cancellation and NO_SHOW retain the original payment total and snapshot
  `refund_amount = bookings.rental_fee_amount` and
  `deposit_forfeited_amount = bookings.deposit_amount`. Refund reasons distinguish
  CUSTOMER_CANCELLATION and NO_SHOW from full refunds for unfulfillable checkout.
  Refund amounts and forfeitures must be nonnegative, cannot individually exceed
  total_amount, and their sum cannot exceed total_amount. Existing pending/refunded
  rows with NULL refund_amount retain the previous full-total refund behavior.
  Manual refund readers/confirmation use the snapshotted refund amount.
- Payment provider integration is selected through a gateway adapter. The
  current implementation provides a mock/test adapter; the production provider
  pricing policy uses the confirmed one-month deposit rule for checkout.
- A successful payment changes the matching active capacity allocation from
  `HOLD` to `BOOKING` inside the same transaction. No physical unit is assigned
  at checkout.
- `payments.idempotency_key` and `(provider, provider_payment_id)` are unique.
- `payments` references exactly one source: booking, legacy reservation draft, or
  rental charge. Booking/draft attempts require a hold-token hash; charge attempts
  do not. Partial unique indexes permit one pending attempt and one applied
  (`SUCCEEDED`) attempt per charge; late/duplicate provider captures remain
  separate refund-pending attempts. Charge payment quote expiry is stored separately from the
  charge due date; an expired quote can be retried with a new idempotency key.
- `rental_charges` stores source-specific obligations in integer VND. `EXTRA` is
  the charge itself; each return settlement revision points to its return-debt
  obligation with a typed FK. Future renewal rows will point to their charge in
  #163. No generic polymorphic source ID is used. Charge adjustments and refunds
  are append-only records; events retain submit/approve/dispute/payment/refund audit.
- `payments.draft_id` is nullable during the #113 expansion; a CHECK requires
  exactly one of booking_id, draft_id, or rental_charge_id. Legacy writers keep draft_id, while the target workflow
  references the DRAFT Booking from payment start. Existing booking_id FK/index
  and idempotency/provider uniqueness remain unchanged. Legacy replay still uses
  draft_id plus hold-token hash until Payment refactoring; target replay uses
  booking_id plus hold-token hash. Plaintext tokens are never stored.
- Task 2 deliberately retains reservation_drafts and its FK for current writers.
  The project is in development: existing data may be cleared and seeded again.
  No legacy-data mapping/backfill or checkout compatibility layer is required.
  Dropping the table follows the consumer refactor in the final contract phase.

Check-in slots are shared time-of-day definitions with exactly four required
columns: `id`, `name`, `start_time`, `end_time`. A Booking stores a required
`check_in_date` and `check_in_slot_id` instead of start/end timestamps. The
calendar date is interpreted in the facility timezone (currently Vietnam time).
Referenced slots cannot be deleted (`ON DELETE RESTRICT`). This change is
represented in the database by date and slot. Booking, payment, check-in and
rental readers project the start/end timestamps into existing API DTOs in
Asia/Ho_Chi_Minh time. Legacy draft requests map check_in_at to the containing
slot (start inclusive, end exclusive) and normalize draft/hold dates to that
slot's start before charging. A request outside the slots is rejected. Previously
created drafts with an unnormalized schedule must be recreated before payment.

Return closure marks the linked active unit assignment `COMPLETED` with `ended_at`,
and releases the linked active BOOKING capacity allocation in the same transaction.
`unit_assignments.status` is varchar; the shared status list now includes `COMPLETED`.
All nonclosed rental statuses (ACTIVE, RETURN_PENDING, OVERDUE) block reassignment/handover.


## Flow 3 review fixes — durable notifications and overdue review

- `rentals.abandoned_review_at`: nullable server timestamp, set once after seven
  full facility-local calendar days from the first overdue midnight while physical return remains unconfirmed.
  This flags FM manual review only; it grants no disposal or forfeiture authority.
- `notification_outbox`: one row per `(event_key, recipient_key)` with UUID id,
  booking/facility foreign keys, optional recipient user, snapshotted recipient email,
  event type, subject/text, occurred_at and in-app visibility. Customer email uses
  booking contact; FM recipients are active facility assignments. No guest identity schema.
- Email delivery fields: PENDING/PROCESSING/SENT/REVIEW_REQUIRED, attempt count,
  next_attempt_at, first_attempt_at, lease token/expiry, provider message id and sent_at.
  Worker claims rows with row locks, sends outside the transaction, and conditionally
  acknowledges its lease. Retried sends retain one provider idempotency key and frozen
  content. Stop automatic retries after the provider's 24-hour idempotency window;
  retain REVIEW_REQUIRED for manual investigation. Do not promise exactly-once delivery.
- Outbox insert shares business transactions. Unique logical keys deduplicate callbacks,
  retries, concurrent cron runs and immediate/scheduled expiry reminders.
  In-app reads enforce current ownership or current FM facility assignment.
- Disposition updates may resolve property on an older failed inspection without
  changing its original checklist or PASS/FAIL. Closure checks every inspection attempt.

## Flow 3 review corrections (2026-10-20)

Confirmed: partial mixed refunds explicitly allocate deposit/rent; depositHeld is
refundable deposit after approved fees minus confirmed deposit refunds, floored at zero.
`return_refunds.deposit_refund_amount` / `rent_refund_amount`: nullable numeric(14,0),
both null for legacy data or both nonnegative with sum equal to amount. New API
infers only unambiguous single-source refunds; mixed refunds require both components.
Historical unallocatable refunds are reconciliation issues, never guessed.

`notification_outbox.booking_email`: nullable JSONB snapshot (booking code, facility
name, unit type, verified paidAt, optional tracking-link delivery id/createdAt/expiry),
for customer BOOKING_CONFIRMED or guest tracking-link emails.
`mail_payload`: nullable encrypted existing mail-job payload; `mail_expires_at`: nullable
timestamp; `queued_at`: nullable timestamp. ENQUEUED means queued, not provider SENT.
No raw token in inbox or logs. The existing BullMQ queue/job ID/delivery ID and
24-hour TTL from link creation remain authoritative. Provider attempts record first_attempt_at
at send time, not enqueue time; ambiguous outcomes beyond 24h require review.
No historical booking email replay. Old queue jobs are adopted by the same job ID.

## Rental lifecycle configuration and guest rental access (2026-10-20)

`system_settings` includes `EXPIRY_REMINDER_DAYS` and `ABANDONED_REVIEW_DAYS`;
the legacy lifecycle API filters reads/writes to these two keys. Values are nonnegative PostgreSQL
integers; no business min/max is imposed. Seed values are 7 days for each setting.
System Administrator changes use optimistic version, store actor/time, and append
system_setting_changes plus legacy return_audit in the same transaction. A sweep reads one settings snapshot for its
candidate query and state changes. Existing logical notification keys and review flags
remain stable after configuration changes.

`booking_access_audit`: UUID id, booking_id FK, idempotency_key, action, JSONB details,
and created_at; `(booking_id, idempotency_key)` is unique. Guest resend attempts store
an HMAC of the submitted email, never raw email or tokens. A matching attempt inserts
the corresponding durable customer row in `notification_outbox` in the same transaction;
the outbox id is also the mail delivery id. Magic links expire 24 hours after request;
the latest issued link revokes the prior magic grant. Session cookies remain 30 minutes
and are scoped to one booking. The resend limits are 3 per booking/hour and 10 per IP/hour.
Guests can read their linked rental, payment/refund history, and ISSUED contract PDFs.
A valid booking session can list its return requests, read return-slot availability,
and submit a new return request through `/booking/tracking/:bookingCode` routes.
These reuse the account workflow's notice, availability, open-request and rental-state
rules; POST requires an allowed Origin. Guest sessions do not grant access to account
rental or Staff endpoints, return edits/cancellations, financial decisions or other bookings.

## Unified system settings (2026-10-20; supersedes global settings tables above)

`system_settings` is the single active global configuration table: key PK, scalar JSONB
value, description, nonnegative version, updated_by FK users and updated_at. API keys
are an allowlist with per-key validation and permissions. Initial keys are
EXPIRY_REMINDER_DAYS (7), ABANDONED_REVIEW_DAYS (7), OVERDUE_FEE_RATE (25) and
DEPOSIT_MONTHS (1). Days use nonnegative PostgreSQL integers, rate 0–100 and months
positive. DEPOSIT_MONTHS retains the positive shared pricing revision: price changes
also lock/increment this row. Existing quote/rental/settlement snapshots are unchanged.
System Admin manages rental-day settings; BOM exclusively manages financial settings.
Facility calendars/checklists, unit type prices and financial snapshots remain relational
domain data rather than global scalar settings. No new runtime fallback or cache.

`system_setting_changes`: UUID id, key FK, JSONB before/after value+version snapshots,
actor_id FK, source and created_at. Append-only changes share the update transaction;
existing pricing_changes and return_audit are retained for domain history.

The migration runner snapshots legacy pricing_settings, return_overdue_settings and
rental_lifecycle_settings under row locks, runs generated DDL, and restores values
with original versions, descriptions and actor/timestamps in the same transaction.
The legacy configuration tables are retired only as part of that atomic migration.
Use `bun run db:migrate`; invoking drizzle-kit migrate directly bypasses this data step.
