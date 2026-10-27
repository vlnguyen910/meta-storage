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
`{ "action": "ENTER_MAINTENANCE", "reason": "..." }` or
`{ "action": "EXIT_MAINTENANCE" }`. FM can operate within the assigned facility;
System Admin and BOM can operate globally. No Admin request/approval step is part
of this Flow 5 implementation. Entering maintenance requires a reason of at least
3 characters and is rejected for occupied, reserved, inactive, rented, or actively
assigned units. Exiting returns the unit to `AVAILABLE`. The older
`PATCH /api/storage-units/:id/status` is kept for compatibility and uses the same
state machine.

`GET /api/storage-units/:id/maintenance-history?limit=20&offset=0` returns
`{ items, total, limit, offset }` newest first. Each row includes action, previous
and next status, reason, actor ID/name, and ISO timestamp. The state update and
history insert are atomic. FM can read history in their facility; System Admin and
BOM can read it globally.

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

## Manual task assignment

`POST /api/facility-tasks` — assigned FM only; returns 201:

```json
{
  "facilityId": "<facility UUID>",
  "assignedStaffId": "<active staff UUID>",
  "type": "INSPECT_UNIT",
  "title": "Kiểm tra ô kho trước bàn giao",
  "description": "Kiểm tra cửa và tình trạng bên trong",
  "storageUnitId": "<optional unit UUID>",
  "bookingId": "<optional booking UUID>"
}
```

Task types: `INSPECT_UNIT`, `PRINT_DOCUMENT`, `REPORT_TO_MANAGER`. Title is trimmed
and required (1..200 characters); description is optional (max 2000). Optional
unit/booking context must exist at the task facility. These links provide work
context; they do not assert that the unit is the booking's active assignment.
Unknown body fields are rejected. Actor IDs, versions and timestamps are set by
the server. Creation never changes a booking's assigned staff/unit, an inspection,
an issued document, a rental or unit status. Existing Flow 2 permissions still
govern inspection execution; use the existing booking assignment API when the
booking's responsible staff needs to change. A printing task does not generate,
issue or physically print a document; the existing contract PDF API remains the
source for documents.

`GET /api/facility-tasks?facilityId=<uuid>&assignedStaffId=<uuid>&type=INSPECT_UNIT&limit=20&offset=0`

- FM can view all tasks at the assigned facility and optionally filter assignee/type.
- FS can view only their own tasks; requesting another assignee returns 403.
- Same pagination bounds as inventory. Ordering is createdAt descending then ID
  descending. `data` is `{ items, total, limit, offset }`.

`GET /api/facility-tasks/:id` — same-facility FM or the currently assigned FS only.

Task execution uses the server-managed status sequence:
`ASSIGNED` → `IN_PROGRESS` → `AWAITING_APPROVAL` → `COMPLETED`.

- `POST /api/facility-tasks/:id/start` — currently assigned active FS only, no body.
  Moves a newly assigned task to `IN_PROGRESS` and records `startedAt`.
- `POST /api/facility-tasks/:id/reports` appends a report and moves the task to
  `AWAITING_APPROVAL`. While waiting, FS may append a supplemental report; the
  latest report is the one FM can accept. A report cannot be submitted before the
  task starts or after completion.
- `POST /api/facility-tasks/:id/reports/:reportId/accept` — active FM assigned to
  the task's facility only. The server verifies the task is awaiting approval and
  the requested report is the latest. In one transaction it records the accepting
  FM and time on the report and marks the task `COMPLETED` with the same actor/time.
  A stale report or invalid status returns 409. There is no reject action in this
  workflow; non-accepted tasks remain open for an additional report.

`POST /api/facility-tasks/:id/assign` — same-facility FM only:

```json
{
  "assignedStaffId": "<active staff UUID>",
  "version": 0
}
```

`version` is the version returned by the last GET/create. A changed assignment
increments it and saves the assigning FM/time. A stale version returns 409, so two
concurrent requests cannot silently overwrite each other. Same assignee with the
current version is a no-op preserving assignment actor/time/version. Previous staff
immediately lose task access; the new assignee gains access subject to facility scope.

Task DTOs contain ID, facility, type, status, title/description, nullable context IDs,
assigned staff ID/name, original creator, assigning FM ID/name, version, nullable
start/completion actor/time, and ISO assignment/create/update timestamps. Report DTOs
include nullable accepting FM ID/name/time. No credentials or private PDF storage
keys are exposed. Task responses use `private, no-store`.

Errors use the existing API envelope: 400 invalid input/staff/context, 401 missing
session, 403 role/facility/assignee access denied, 404 missing task/report/unit, 409
stale version or invalid lifecycle/latest-report state. Successful calls use the
existing `{ success, data, timestamp }` envelope.

## Staff work reports and history

`POST /api/facility-tasks/:id/reports` — currently assigned, active FS only:

```json
{ "content": "Đã kiểm tra cửa và tình trạng bên trong ô kho." }
```

Content is trimmed and required (1..5000 characters). Unknown fields are rejected;
the session supplies the author and the server supplies the timestamp. Every
successful request appends a separate record, including repeated identical text.
There is no edit/delete endpoint, attachment, or automatic change to the
unit/booking/rental/inspection. Task and current staff membership are rechecked
under row locks so submission serializes with task reassignment and approval.

201 `data`: `{ id, taskId, submittedBy, submitterName, content, submittedAt,
acceptedBy, acceptedByName, acceptedAt }`; acceptance fields are null until FM review.
`submittedAt` is ISO UTC; `submitterName` is the author's current display name.
The original author ID is preserved after reassignment.

`GET /api/facility-tasks/:id/reports?limit=20&offset=0` — active same-facility FM
or current assigned FS. FM opens a task from the existing task list to see its
report history. This endpoint is per task, not an aggregate staff report feed.
200 `data`: `{ items, total, limit, offset }`, ordered by submission time then ID,
both descending. Limit is 1..100, offset is nonnegative. Empty/out-of-range pages
return an empty list with the correct total. Reports remain visible to FM and the
new assignee after reassignment; the previous assignee loses access, including
to their earlier reports, consistently with existing task authorization.

Both endpoints use session auth, `private, no-store`, and the existing API envelope.
Errors: 400 invalid body/query, 401 missing session, 403 wrong role, facility,
assignee, inactive account or expired/revoked membership; 404 missing task.

## Database migration and verification

`0046_youthful_nightmare.sql` (tasks), `0047_perpetual_sue_storm.sql` (reports),
and `0049_cloudy_grey_gargoyle.sql` (FM acceptance and lifecycle state) are generated by `bun run db:generate`.
Apply through
`bun run db:migrate` to the intended database before serving task requests.
Development/business data is not required for the regression tests.

With the existing isolated PostgreSQL test environment configured (`NODE_ENV=test`,
matching loopback `DATABASE_URL`/`MY_STORAGE_LOCAL_DATABASE_URL` with a
`metastorage_inspection_test_*` database name, plus API test configuration):

```bash
bun test --cwd apps/api tests/integration/flow5-storage-units.test.ts
bun test --cwd apps/api tests/integration/flow5-facility-tasks.test.ts
bun test --cwd apps/api tests/integration/flow5-task-reports.test.ts
```

All three suites are also discovered by the existing `bun run --filter api test:db`
database CI runner. They verify real authentication, facility scope, persistence,
filters, pagination, rejected writes and concurrent versioned reassignment.
