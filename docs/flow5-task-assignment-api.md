# Flow 5 inventory and manual task assignment API

This backend slice provides scoped physical-unit inventory and manual staff task
assignment plus staff work reports and FM approval. A task is completed only when
the assigned-facility FM accepts its latest report. This change does not add the
separate FM-to-Admin maintenance request flow.

## Authentication and facility scope

Use the existing authenticated session cookie. FM/FS facility scope comes from
active, unexpired `facility_assignments`, never from a caller-supplied role/user ID.
An expired/revoked facility assignment removes access even to previously assigned
tasks. Task assignment is FM-only; assignees must be ACTIVE Facility Staff with a
current assignment at the same facility. Admin/BOM do not receive task assignment
permissions from this feature.

Inventory read endpoints retain operational read access for assigned FM/FS and
global System Admin/BOM. Customers cannot use these operational endpoints.

## Physical-unit inventory

`GET /api/storage-units?facilityId=<uuid>&status=AVAILABLE&unitTypeId=<uuid>&limit=20&offset=0`

- `facilityId` is required. `status` and `unitTypeId` are optional.
- `limit` defaults to 20, accepts 1..100; `offset` defaults to 0 and is nonnegative.
- Successful `data`: `{ items, total, limit, offset }`. Each item contains `id`,
  `facilityId`, `unitTypeId`, `code`, nullable `floor`/`locationDescription`, `status`,
  ISO `createdAt`/`updatedAt`, `unitTypeName`, and `unitTypeSizeLabel`.
- `total` is the filtered total before pagination. Ordering is code then ID.
- Empty pages still return the correct total; a missing facility returns 404 to a
  globally authorized reader. A facility-scoped actor requesting an unassigned
  facility receives 403.

`GET /api/storage-units/:id` returns the existing unit detail shape with ISO dates
and now checks role and facility scope. The `/api/units` alias has identical list
and detail authorization. Both successful read responses use `private, no-store`.

FM may create a unit within the assigned active facility:
`POST /api/facilities/:facilityId/storage-units`, body
`{ unitTypeId, code, floor?, locationDescription? }`. The offering and shared type
must both be active. New units start `AVAILABLE`; callers cannot set their status.

`PATCH /api/storage-units/:id` lets the assigned FM change `code`, `floor`,
`locationDescription`, or `unitTypeId`. The facility is resolved from the stored
unit and cannot be changed in the request. A new type must be offered at that
facility. Type changes are rejected while the unit has an active rental or a live
booking assignment. Status changes must use the explicit transition APIs below.

`POST /api/storage-units/:id/transitions` takes either
`{ "action": "ENTER_MAINTENANCE" }` or `{ "action": "EXIT_MAINTENANCE" }`.
FM can operate within the assigned facility;
System Admin and BOM can operate globally. No Admin request/approval step is part
of this Flow 5 implementation. Entering maintenance is rejected for occupied,
reserved, inactive, rented, or actively assigned units. Exiting returns the unit to
`AVAILABLE`. The older
`PATCH /api/storage-units/:id/status` is kept for compatibility and uses the same
state machine.

## Facility, type catalog, and membership management

- `GET /api/facilities/management?isActive=true&limit=20&offset=0` is Admin/BOM only
  and includes inactive facilities when requested. Public `GET /api/facilities`
  stays active-only.
- `GET /api/facilities/:facilityId` is available to an assigned FM/FS or global
  Admin/BOM. `PATCH /api/facilities/:facilityId` is Admin/BOM only and can update
  code, name, address, description, and active state. Deactivation is blocked while
  the facility has an active booking or an unexpired hold.
- `GET /api/unit-types?isActive=true&limit=20&offset=0`, `POST /api/unit-types`,
  and `PATCH /api/unit-types/:id` are Admin/BOM catalog operations. Creating a
  shared type requires its initial monthly price. Update requests cannot change
  `monthlyPrice`; pricing remains owned by Flow 4. Deactivation is soft.
- `GET /api/facilities/:facilityId/unit-types/management` lists facility offerings.
  `PATCH /api/facilities/:facilityId/unit-types/:unitTypeId` accepts
  `{ "isActive": true|false }`; enabling an offering can create the association
  when the shared unit type is active. Admin/BOM only. Public
  `GET /api/facilities/:facilityId/unit-types` remains unchanged.
- `GET/POST /api/facilities/:facilityId/assignments` and
  `DELETE /api/facilities/:facilityId/assignments/:userId` are Admin/BOM only.
  The account must be active and its role must match the assignment. The existing
  one-active-facility constraint is retained. Delete deactivates the membership and
  preserves its row; it returns 409 while confirmed bookings or tasks remain
  assigned. Reassign those items first. Account creation and role/status changes
  continue to use the existing users API.

Task completion ownership is confirmed: an FS report leaves the task awaiting
approval, and an FM must accept the latest report before it becomes completed.

## Facility task work queue

`facility_tasks` covers `CHECK_IN_HANDOVER`, `UNIT_INSPECTION`, and `HANDLE_SUPPORT`.
Statuses are `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED`. Each task has
one `referenceType` (`BOOKING`, `STORAGE_UNIT`, or `SUPPORT_TICKET`) and one
`referenceId`. The server validates that the referenced record exists at the same
facility; a polymorphic reference cannot use a conventional foreign key.

FM assigning staff to a confirmed booking creates or reassigns its
`CHECK_IN_HANDOVER` task in the same transaction. This task cannot be created through
the generic create endpoint. FM creates `UNIT_INSPECTION` or `HANDLE_SUPPORT` tasks
through `POST /api/facility-tasks`, body:

```json
{
  "facilityId": "<facility UUID>",
  "assignedStaffId": "<active staff UUID>",
  "type": "UNIT_INSPECTION",
  "referenceType": "STORAGE_UNIT",
  "referenceId": "<unit UUID>"
}
```

`UNIT_INSPECTION` may reference a booking or a storage unit. `HANDLE_SUPPORT` must
reference a support ticket. Actor, version and timestamps come from the session or
server. Reassignment requires the current version; changing staff resets an
unfinished task to `ASSIGNED`. Repeating the same assignee is a no-op.

Minimum task API:

- `POST /api/facility-tasks` — FM creates and assigns an inspection or support task.
- `GET /api/facility-tasks?facilityId=<uuid>&assignedStaffId=<uuid>&type=UNIT_INSPECTION&limit=20&offset=0` — FM lists facility tasks; FS sees only their own.
- `GET /api/facility-tasks/:id` — same-facility FM or current assigned FS reads a task.
- `PATCH /api/facility-tasks/:id` — FM changes the assigned staff member; body contains `assignedStaffId` and current `version`.
- `POST /api/facility-tasks/:id/start` — assigned active FS moves `ASSIGNED` to `IN_PROGRESS`.
- `POST /api/facility-tasks/:id/complete` — assigned active FS moves `IN_PROGRESS` to `COMPLETED`.
- `POST /api/facility-tasks/:id/cancel` — assigned-facility FM cancels unfinished work.

There are no report-submission or manager-approval endpoints. Inspection evidence
and support-ticket content remain in their owning domain records. Completing a task
only changes its work status; it does not replace inspection, booking, rental, unit
or support-ticket lifecycle transitions. Booking cancellation/no-show cancels its
open check-in/handover task in the same transaction.

Successful responses use `{ success, data, timestamp }` and `private, no-store`.
Errors use 400 for invalid references/input, 401 for missing session, 403 for role,
facility or assignee violations, 404 for a missing task, and 409 for stale version
or invalid lifecycle transitions.

## Database migration and verification

The current task schema change is generated by `bun run db:generate`; apply it with `bun run db:migrate`. The migration preserves valid legacy inspection tasks and stops for manual resolution if unsupported legacy print/report tasks remain.
Apply through
`bun run db:migrate` to the intended database before serving task requests.
Development/business data is not required for the regression tests.

With the existing isolated PostgreSQL test environment configured (`NODE_ENV=test`,
matching loopback `DATABASE_URL`/`MY_STORAGE_LOCAL_DATABASE_URL` with a
`metastorage_inspection_test_*` database name, plus API test configuration):

```bash
bun test --cwd apps/api tests/integration/flow5-storage-units.test.ts
bun test --cwd apps/api tests/integration/flow5-facility-tasks.test.ts
```

All three suites are also discovered by the existing `bun run --filter api test:db`
database CI runner. They verify real authentication, facility scope, persistence,
filters, pagination, rejected writes and concurrent versioned reassignment.
