# System settings API

All global scalar configuration is stored in `system_settings`. This replaces
pricing_settings, return_overdue_settings and rental_lifecycle_settings. The JSONB
value supports scalar types; the current four registered keys are integers. Admin
cannot create/delete keys or supply validation/permission rules through the API.

| Key | Seed value | Validation | Read/write role | Effect |
| --- | --- | --- | --- | --- |
| EXPIRY_REMINDER_DAYS | 7 | Integer 0..2147483647 | SYSTEM_ADMIN | Next sweep/new rental; existing event dedupe remains |
| ABANDONED_REVIEW_DAYS | 7 | Integer 0..2147483647 | SYSTEM_ADMIN | Next sweep; never clears an existing review flag |
| OVERDUE_FEE_RATE | 25 | Integer 0..100 | BUSINESS_OPERATION_MANAGER | Future assessments; saved snapshots unchanged |
| DEPOSIT_MONTHS | 1 | Integer 1..2147483647 | BUSINESS_OPERATION_MANAGER | Future quotes; saved booking/payment snapshots unchanged |

No new business limits were invented for day settings. PostgreSQL integer bounds
are technical bounds. Keys, validation, role, category and unit are defined in the
shared contracts catalog. Seed reads defaults from that catalog using conflict-do-
nothing; the runtime reads persisted values and never substitutes seed defaults.

- `GET /api/system-settings`: 200 with keys the authenticated role may manage.
  Returns key, value, description, version, updatedBy/At, category, unit and valueType.
- `PUT /api/system-settings`: body `{ "key": "EXPIRY_REMINDER_DAYS", "value": 7,
  "expectedVersion": 0 }`; 200 `{ key, value, version }`. Only value is editable.
- `GET /api/system-settings/:key/history?limit=20&offset=0`: paginated new common
  audit entries, before/after value+version, actor, source and timestamp.

All responses are private/no-store. Missing session: 401; wrong role/key access:
403; malformed/unknown keys or invalid values: 400; stale version: 409. Domain
configuration missing: the existing domain's 404/409/503 behavior remains. Financial
keys are not exposed to System Admin by inference; BOM authority remains explicit.

Old `/api/return-policy/lifecycle-settings`, `/api/return-policy/overdue-rate` and
`/api/business-rules/pricing` endpoints remain supported against the SAME rows.
A concurrent old/new request using one expectedVersion yields one success and
one conflict. Pricing price changes also lock/increment DEPOSIT_MONTHS.version;
that shared revision was not split into independent price and deposit revisions.

Updates and audits commit atomically. Existing `pricing_changes`/`return_audit`
records are retained as domain history; new common history starts at this migration.
No API edits/deletes audit entries. No runtime cache or Redis invalidation is added.

Run `bun run db:migrate`: the runner holds an advisory lock, snapshots legacy values
under row locks, executes generated Drizzle DDL, transfers original values/version/
actor/time and commits journal+data together. A failure rolls back DDL and data.
Do not bypass it with drizzle-kit migrate. Stop old API/worker writers during the
schema rollout; there is no mixed-version compatibility with retired physical tables.
For fresh installations, `bun run db:seed` creates defaults; repeating it preserves
Admin/BOM changes. No database creation/reset is required.

Facility calendars, holiday lists and checklist versions remain domain entities, as
do unit-type prices, booking snapshots and assessments. They are not redundant
global config tables. This task does not turn every constant into an editable rule.

Candidates for a later policy migration (current values unchanged): magic-link TTL
24h, session 30m, resend 3/booking/hour + 10/IP/hour, return slot 90m, buffer 15m,
24h return notice, checkout hold 10m, PDF limit 20MiB and inspection photo limits.
Before exposing each key, specify whether changes affect existing tokens, scheduled
appointments, in-flight payments or existing evidence. Security/provider credentials
remain environment secrets; enums, protocol constants and retries are not arbitrary
Admin-editable settings. No renewal/upgrade or frontend UI was added.
