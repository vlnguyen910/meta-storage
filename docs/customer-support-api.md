# Customer Support API — #165

Implemented on `feat/165-customer-support-api`, based on the approved #164
[policy](customer-support-policy.md) and [model](customer-support-model.md).
This delivers customer backend APIs, contracts, migrations and the shared client.
Web/Mobile screens are a separate integration. Operations queue, assignment,
FS reports, FM approval, close/reopen and role inbox updates belong to #166.

## Authentication and context

Use an active CUSTOMER account session cookie from `POST /api/auth/sign-in/email`.
Guest booking tracking/magic-link sessions do not authorize Support. Other roles
use the future operations APIs; they cannot call these customer endpoints.

Every ticket requires a `bookingId` owned by the authenticated account. The server
sets owner, facility, initial OPEN/NORMAL state, actor/source and the 12-hour
`actionDueAt`. Input objects are strict: sending `userId`, `ownerUserId`, `facilityId`,
`rentalId`, `storageUnitId`, assignee, status or priority is rejected.

- UNIT, LOCK, ACCESS_CODE, STORED_ITEMS: booking must have completed actual
  handover (`CHECKED_IN`), with a matching rental that is not closed and its physical
  unit at the booking facility. Creating a Support ticket does not change that unit.
- PAYMENT: available before successful payment, including pending/failed payments
  and cancelled bookings. Optional `paymentId` must be associated with that booking,
  directly or through its rental charge. A payment transaction is not mandatory.
- Closing the rental does not delete or hide existing customer conversation/images.
  Account deactivation, role change or ownership mismatch revokes access; ownership
  never automatically transfers based on a matching contact email.

## Endpoints

All paths below begin with `/api/support`. JSON success responses use the existing
`{ success: true, data, timestamp }` envelope. Binary image responses do not.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/tickets` | 201: ticket and first page of public messages |
| GET | `/tickets` | 200: customer's tickets, newest first |
| GET | `/tickets/:ticketId` | 200: ticket and newest 20 public messages |
| GET | `/tickets/:ticketId/messages` | 200: public conversation page |
| POST | `/tickets/:ticketId/messages` | 201: ticket and appended public reply |
| POST | `/tickets/:ticketId/messages/:messageId/attachments` | 201: ticket and private image metadata |
| GET | `/tickets/:ticketId/attachments/:attachmentId` | 200: authenticated image bytes |

Swagger is available at `/docs` and `/docs/json` in non-production environments,
under **Customer Support**. Use the same host as the login cookie and an allowed
origin. This API uses session authentication, not a bearer token.

### Create a ticket

```json
{
  "bookingId": "11111111-1111-4111-8111-111111111111",
  "category": "PAYMENT",
  "subject": "Đã bị trừ tiền nhưng booking chưa ghi nhận",
  "content": "Nhờ kiểm tra giao dịch của booking này.",
  "idempotencyKey": "customer-create-support-001"
}
```

Subject: trimmed 1–200 characters. Content: trimmed 1–5000 characters.
`idempotencyKey`: 8–128 characters, letters/digits and `._:-`.
Use a fresh key for a new command; preserve the original key and payload on retry.
Do not put passwords, access codes, card secrets or full credentials in content.

Creation atomically writes the ticket, first PUBLIC_REPLY, CREATED audit,
idempotency result and email outbox receipt. The worker sends the acknowledgement
through the existing mail adapter and retry/lease mechanism. It confirms receipt
and the 12-hour handling commitment; it does not promise resolution within 12 hours.
A running worker plus valid mail-provider configuration is needed to deliver email.
#165 does not implement IN_APP operations notifications or a dispatch/SLA engine.

### Reply and concurrency

```json
{
  "content": "Tôi bổ sung thông tin về vấn đề đang gặp.",
  "version": 0,
  "idempotencyKey": "customer-public-reply-001"
}
```

Use the latest `ticket.version`. Replies and uploads increment it. A stale version
returns 409: reload the ticket before submitting a new command. An identical retry
returns the original child ID without duplicating a message/image, even if a later
operation closed the ticket. Ticket fields in replay responses reflect current state.
Reusing a key with different input returns 409. Idempotency is scoped to the
account and operation (including the ticket/message for replies/uploads).
Closed tickets reject new replies/uploads. Customer close and FM/BOM reopen are
operations transitions delivered by #166.

### Private images

Upload JSON to a public message authored by the current customer:

```json
{
  "filename": "unit-condition.png",
  "mimeType": "image/png",
  "dataBase64": "<base64 of the image bytes, without a data: prefix>",
  "version": 1,
  "idempotencyKey": "customer-evidence-image-001"
}
```

JPEG, PNG and WebP only, maximum 5 MiB decoded per image and **10 images total per
ticket**, including future internal notes/reports. Images are optional. Filename
must be 1–120 characters without path separators/control characters. Request size
is bounded to accommodate base64 plus metadata. File MIME/content is checked
before storage; SVG/PDF and MIME spoofing are rejected.

Normal DTOs contain attachment ID, ticket/message IDs, filename, MIME, byte size
and timestamp. They exclude object keys, checksums, signed URLs and provider data.
Read bytes through the authenticated GET endpoint; it checks current owner and
PUBLIC_REPLY visibility again after storage IO. Responses use `private, no-store`,
`nosniff`, sandbox CSP and an encoded filename. Do not make storage keys public or
persist a provider URL in the frontend.

The existing Cloudinary adapter stores authenticated raw assets so downloaded
bytes retain their SHA-256 checksum. Integration tests substitute only the external
storage boundary. Real Cloudinary/mail delivery needs provider configuration and
is not covered by the isolated DB test.

Upload count/finalization runs under the ticket lock. A definitely rolled-back,
unreferenced new object can be removed. A failed/uncertain upload is not proof that a new object can be deleted.
A lost COMMIT acknowledgement or failed
post-commit response read must not delete potentially committed evidence. An
uncertain/unreferenced object may need operational orphan reconciliation; there is
no destructive background cleanup or image delete/edit endpoint in this issue.

### Pagination and customer DTO boundary

List query: `limit` (1–100, default 20), optional `bookingId`, `category`, `status`,
`cursor`. Messages: `limit`, `cursor`. Responses contain `items` and nullable
`nextCursor`; pass that cursor unchanged until it is null.

Ordering is `(createdAt DESC, id DESC)` with timestamp precision 3. Equal timestamps
use the UUID tie-breaker. New records inserted after page one do not shift the
remaining cursor window. Invalid cursors are rejected. Only PUBLIC_REPLY messages
and their attachments are selected. INTERNAL_NOTE, STAFF_REPORT, audit metadata,
payment provider payloads, unit access credentials and user account records are
not exposed by customer list/detail.

## Error handling

| HTTP | Meaning / frontend action |
| --- | --- |
| 400 | Invalid schema, unknown/forged fields, unsupported MIME or invalid filename; show validation |
| 401 | Missing account session; ask the customer to sign in |
| 403 | Wrong role or inactive account; stop the action |
| 404 | Missing or unauthorized booking/ticket/message/image; do not reveal another owner's data |
| 409 | Missing handover/closed rental on create, closed ticket, stale version, changed idempotency payload or image cap |
| 413 | Request exceeds route body limit |
| 422 | Invalid payment association, cursor or image content/decoded size |
| 503 | Storage unavailable or stored image checksum/size mismatch; allow safe retry |
| 500 | Unexpected database failure; retry the identical command/key rather than creating a new command |

Errors use the existing `{ success: false, error: { code, message, details? },
timestamp }` envelope. Do not infer existence from 404.

## Shared client handoff

`createMetastorageApiClient(...)` now exposes `client.support`:

```ts
const created = await client.support.create(input);
const page = await client.support.list({ status: "OPEN", limit: 20 });
const detail = await client.support.detail(created.ticket.id);
const history = await client.support.messages(created.ticket.id, { limit: 20 });
const reply = await client.support.reply(created.ticket.id, replyInput);
const image = await client.support.uploadImage(created.ticket.id, reply.message.id, imageInput);
const bytes = await client.support.image(created.ticket.id, image.attachment.id);
```

`image` returns binary data (`ArrayBuffer` in browsers; Axios may return a Buffer
in Node). Use an authenticated fetch through this client; create/revoke a local
Blob URL in a future screen as appropriate. Web/Mobile must preserve mutation keys
across retries, use current ticket versions and paginate public conversation.
No Support screen or browser UI behavior changes in #165.

## Database and verification

Migration `0052_small_sumo.sql` is generated with `bun run db:generate`. Apply using
`bun run db:migrate`. It adds five Support tables and nullable outbox ticket linkage,
without rewriting existing domain data. Work reports and operations channels are
reserved for #166. Do not manually edit generated SQL/snapshots.

Configure an isolated loopback database named `metastorage_inspection_test_*` and
fake external credentials per [local-database-tests.md](local-database-tests.md).
Never point these commands at a development/production database.

```sh
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/customer-support.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter worker check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
bun run --filter worker lint
git diff --check
```

A skipped opt-in suite is not acceptance evidence. Tests exercise real auth/routes,
PostgreSQL persistence/locks/constraints, replay, owner isolation, public/private
visibility, closed history, image limit/concurrency and transaction failure recovery.
Actual provider delivery and future customer UI need separate verification.
