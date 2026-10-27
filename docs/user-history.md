# System administration and user history — issue #185

## Confirmed decisions (2026-10-25)

- One new `login_history` table: successful sign-ins only, recording when a user
  signed in and the available device/browser/OS/model. No failed attempts/logout.
- One new `user_activity_logs` table: successful mutation API requests across
  Customer, FS, FM, BOM and SA. Read/list/search/download access is excluded.
- Both histories are best-effort: the user explicitly approved that log failure
  must not block or roll back the main operation; emit an operational warning.
- Hardware model is best-effort client metadata, never an authentication factor.
  Browsers may hide the model. Optional native client headers `x-device-model` and
  `x-device-platform` (`ios`/`android`) can supply descriptions; this change does
  not modify the mobile client to send them.
- Administrators cannot edit other users' profile fields. Each authenticated ACTIVE
  user can edit only their own name/phone; email remains on its authentication flow.

## Account and assignment policy (D1–D4 approved)

- One bootstrap SYSTEM_ADMIN. A partial database unique index prevents a second
  SA even under concurrent database writes. Management create/role bodies accept
  only CUSTOMER, FACILITY_STAFF, FACILITY_MANAGER and BUSINESS_OPERATION_MANAGER;
  SA input returns 400. Locking/demoting the bootstrap SA returns 403.
- Account lifecycle is serialized under a user row lock. A role change or lock
  returns 409 while directly assigned work remains open:

| Work | Blocking states |
| --- | --- |
| Booking | CONFIRMED |
| Facility task | ASSIGNED, IN_PROGRESS |
| Support ticket | OPEN, IN_PROGRESS |
| Return request | PENDING, CONFIRMED, INSPECTING, FAILED |

Completed/closed work and historical creator/assigner references do not block the
change. Handoff uses existing domain reassignment flows; no work is transferred
automatically. Account updates check across all facilities; assignment revocation
checks that facility. The same query serves both checks.

After handoff, changing the role or locking the account updates the user, ends
active memberships and deletes all Better Auth sessions in one transaction. A
same-role update is a no-op for membership/session policy. Reactivating an account
restores neither sessions nor memberships: the user must log in and an authorized
actor must explicitly assign a facility again.

SA/BOM retain assignment create/revoke permissions. Active-user role/status checks
are repeated after acquiring the target user lock; one active facility per user
remains enforced by the existing unique index. An expired assignment with open
work at another facility cannot be silently discarded during reassignment.

Assignment-only changes retain sessions. Existing membership guards and auth/me
read the current assignment at the next request. Role changes/locking revoke all
sessions, including the target user's current session; old cookies return 401 and
do not revive after reactivation. Session insertion holds a user share lock and
rechecks ACTIVE in the same transaction as the insert, including when Better Auth
already has an outer transaction. This serializes sign-in with account locking.

Before migrating a legacy database, inspect existing SA rows:

```sql
SELECT id, status FROM users WHERE role = 'SYSTEM_ADMIN';
```

If more than one exists, resolve the conflict explicitly before migrating. The
unique-index migration fails atomically without deleting or disabling accounts.
No migration/reset/reseed of the shared business database was performed here.

## Implemented APIs

`PATCH /api/users/me/profile`, authenticated ACTIVE user:

```json
{"name":"Nguyen An","phone":"0900000000"}
```

At least one field is required. Name is trimmed, 1–150 characters. Phone is
trimmed, 1–20 characters, or null to clear. Duplicate phone returns 409. Additional
fields including userId/email/role/status/password return 400. Target ID comes
from the session. Success returns the public user DTO in the existing success
response envelope. User reads/create/role/status responses and auth/me now use an
explicit field allowlist, excluding legacy passwordHash and auth secrets.

`GET /api/users`, SYSTEM_ADMIN: existing array response and limit/offset remain.
Optional `search` matches name/email/phone by case-insensitive literal substring,
including literal `%`/`_`/backslash. Optional `role` and `status` combine with search
using AND. Order remains createdAt DESC, id DESC. Search is trimmed and bounded to
150 characters. DTO timestamps are ISO strings and contain no password hash.

`GET /api/admin/login-history`, SYSTEM_ADMIN per the original issue:

- Optional `userId`, `from`, `to`.
- Only successful sign-ins are represented, so no eventType/outcome filters.

`GET /api/admin/activity-logs`, SYSTEM_ADMIN per the original issue:

- Optional `actorId`, `action`, `entityType`, `entityId`, `facilityId`, `from`, `to`.

Both APIs accept `limit` (1–100, default 20), `offset` (0–100000, default 0).
`from`/`to` must be ISO timestamps with an explicit timezone; both bounds are
inclusive and from must not be after to. Stored timestamps are timezone-aware;
DTO timestamps are ISO UTC strings. Order is occurredAt DESC, id DESC. One read-only
repeatable-read transaction keeps each page and its total consistent. Offset pages
can shift between requests when new records arrive; there is no cross-request
snapshot guarantee.

Response envelope example:

```json
{
  "success":true,
  "data":{"items":[],"total":0,"limit":20,"offset":0},
  "timestamp":"2026-10-25T00:00:00.000Z"
}
```

Unauthenticated reads return 401; authenticated non-SA users return 403. Invalid
query/body returns 400. The existing common error envelope applies. No public
create/edit/delete log endpoints exist. The session correlation ID is not exposed.

## Automatic capture

Login history uses Better Auth's session-create after hook for password sign-in
and Google callback (including Expo clients using those auth paths). Only a
successfully created sign-in session is captured. A unique session correlation
ID prevents recording the same session twice; it is not a credential and is not
returned by the read API. Session refresh/read, failed login and logout do not
create login-history records. The recorded time is the session's creation time.

Activity capture runs after successful POST/PUT/PATCH/DELETE responses, independently
of the business transaction. It applies to all roles without changing their
permissions. The event contains the server-resolved actor, method/route template,
a safe UUID target when available and facility ID when present in route/input.
Missing actor/target/facility remains null; never infer a user from submitted
userId/email, or store magic-link tokens, tracking codes or raw request URLs.
POST check-in lookup and settlement preview are excluded as reads. Auth/session
exchange and provider callbacks are excluded from this hook. Better Auth user-create
and explicit update-user hooks capture registration and self-profile changes.

An activity represents an accepted write request, rather than a certified state
change. Idempotent repeats/no-op writes may produce another activity; internal
cron/worker activity and failed requests are not captured. Existing domain audit
records remain authoritative for exact business transitions and before/after facts.
No raw request body, credentials or copied domain audit payloads are stored.
Logs can be missing after insertion failure or process interruption after commit;
there is no retry queue or rollback. This matches the approved noncritical log policy.

## History retention and limits

- Retention/cleanup has no approved duration; no automatic deletion is implemented.
- No historical backfill is allowed from current sessions/users. History begins
  when capture is enabled. The mobile client is unchanged; a hardware model will
  remain null when the client/browser does not supply it.

## Verification for this increment

- Bun unit tests for own-profile validation/DTO secret exclusion, device extraction
  and history query bounds/timezone handling.
- Real API curl checks against isolated local PostgreSQL database
  `metastorage_inspection_test_issue185_20261025` on port 5433 and API port 4185.
  Initial read checks use marked fixture rows; follow-up checks exercise real
  successful sign-ins, own-profile writes and admin-created FS/FM/BOM accounts,
  then read automatically captured records through the APIs.
- Profile success, duplicate phone 409, unauthenticated 401, forbidden extra fields
  400, absent other-user profile endpoint 404, sanitized user/auth DTOs; history
  authorization 401/403, paging/filtering and equal UTC date boundaries.
- Temporarily rename the two log tables in the isolated database and use curl to
  verify login/profile still return 200 and the profile change persists. Restore
  both table names immediately in a finally block.
- Unit cases cover Google callback capture; a real Google OAuth round trip was not
  run. Session reads and invalid-password curl calls add no login-history records.
- Migrations 0056/0057/0058 generated with `bun run db:generate`, applied to the isolated
  database only. Existing shared database was not migrated/reset/reseeded.
- Integration/E2E suites were not run, per the user's instruction. Concurrency,
  rollback of unrelated business audits and every domain flow have not been verified.

Additional lifecycle verification:

- 78 API unit tests and 13 affected Web auth unit tests pass. Shared API/contracts/
  database/client and Web/Mobile type checks pass; Biome checks on changed source
  and git diff --check pass. Web changes only align auth fixtures with the public
  ISO-date DTO and removal of passwordHash; no UI flow was changed.
- curl verifies create/promote SA 400, lock/demote SA 403; open booking/task/ticket/
  return work blocks account lock, role change and assignment revocation with 409.
  Fixture work moved to terminal states no longer blocks these actions.
- A real task reassignment through the existing FM API releases the old assignee
  for role change. Old cookies return 401 after role change/lock; reactivation
  preserves that revocation and restores no membership. New sign-in works after
  reactivation. BOM can assign/revoke and read facility assignments, but cannot
  read the SA history APIs. Assignment changes retain a session and auth/me shows
  the new scope at the next request.
- Six parallel curl races among assignment, locking and login leave no active
  membership/stale session; reactivation restores neither. These selected manual
  races do not replace a comprehensive PostgreSQL concurrency integration suite.
- Search/role/status filters, literal wildcard matching and safe DTOs pass via curl.
- GitNexus was refreshed in index-only mode and detect-changes rerun with scope
  all and limit 1000. Aggregate risk is CRITICAL because auth and membership flows
  are shared. The analyzer warns that global flow enumeration is capped; the
  graph is an impact guide, not an exhaustive regression certificate.
