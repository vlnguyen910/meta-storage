# Booking contract PDFs — implementation record, 2026-10-20

MVP uses existing booking `contactName`, `contactEmail`, `contactPhone` as customer
information. No CCCD/passport columns, identity-document collection or extra identity
schema. FM manually uploads/ issues PDFs; no PDF generation or e-signature workflow.

## Current implementation

| Requirement | Code/behavior |
| --- | --- |
| Link to booking before handover | booking_contracts.booking_id; rental access resolves rental → booking |
| Distinguish upload/issue | UPLOADED / ISSUED, separate endpoints; upload never issues or claims signed |
| Complete data + confirmed payment | Issue checks customer contact, facility/address, unit type, integer-VND price/rent/deposit, requested term/start/end/booking and persisted provider-verified SUCCEEDED payment/paidAt/currency/amount |
| Preserve versions | Booking lock, increasing immutable version; unique booking/version and booking/idempotency key |
| Current issued PDF | Highest ISSUED version; new UPLOADED draft does not replace it. Issue uses expectedCurrentIssuedId to detect competing changes |
| Valid private PDF | Strict PDF parser, nonempty valid page tree/dimensions, unencrypted, SHA-256 and 1..20 MiB; object bytes rechecked before issue/download/handover |
| Handover gate | Recheck exact current issued version, payment and binding/financial/contact/term data under booking transaction; store handover_inspections.contract_id |
| Atomic handover | Contract-use audit/link, rental, booking, unit and verification commit together; failure rolls back all |
| Authorization | FM upload/issue within live assigned facility. Customer only own issued documents; assigned facility FS only issued documents. No assumed Admin/BOM rights |
| Retry/failure | Upload idempotency; issue/handover retries preserve original audit; unknown upload commit outcome never deletes a referenced object |

Payment success here is read from the backend payment state already maintained by
provider callbacks/reconciliation. The API accepts no client-paid flag. It does not
perform another payment-provider call or modify payment state. Existing price/deposit
snapshots are used; current catalog prices are not substituted.

PDF validation is structural validation of a readable, unencrypted page document,
not OCR/legal review or verification that the PDF's clauses match the snapshot. FM
is responsible for reviewing and uploading the correct document before issuance.
Source library behavior: [PDF-lib load options](https://pdf-lib.js.org/docs/api/interfaces/loadoptions),
[AWS S3 SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).
The two new API dependencies are pdf-lib (parser) and @aws-sdk/client-s3 (S3 adapter).

## API

All routes require an ACTIVE authenticated user and carry `Cache-Control: private,
no-store`. JSON uses the existing response envelope. Inputs/types are shared in
`packages/contracts/src/rental-documents{,.types,.messages}.ts`.

| Method/path | Access/result |
| --- | --- |
| GET `/api/bookings/:bookingId/contracts` | Owner/assigned FS: issued versions only. Facility FM: uploaded and issued versions |
| GET `/api/rentals/:rentalId/contracts` | Same ownership/facility checks via rental's booking; includes historical versions |
| POST `/api/bookings/:bookingId/contracts` | Facility FM; 201 UPLOADED metadata |
| POST `/api/bookings/:bookingId/contracts/:contractId/issue` | Facility FM; 200 ISSUED metadata |
| GET `/api/bookings/:bookingId/contracts/:contractId/pdf?download=false` | Authorized binary application/pdf; inline by default, download=true uses attachment |

Upload body:

```json
{
  "filename": "contract.pdf",
  "mimeType": "application/pdf",
  "dataBase64": "BASE64_PDF_BYTES",
  "idempotencyKey": "92b8028f-6f79-4cca-9ebd-e6f915340fe2"
}
```

JSON body limit is 28 MiB to accommodate base64; decoded PDF limit is 20 MiB.
A reused idempotency key with different bytes, filename or uploader conflicts.
Upload is permitted before handover on DRAFT/CONFIRMED bookings; issue requires
CONFIRMED + successful payment + all required data. No new uploads/issues after
physical handover. Previously issued documents remain readable. There is no
revoke/delete/sign/renewal/transfer API; those unspecified workflows are not invented.

Issue body: `{ "expectedCurrentIssuedId": null }` for the first issued version,
or the current issued UUID when issuing a later version. Concurrent issuance of
*different* versions has one winner; the other request returns 409. Retrying the
same already-issued version returns the saved result without creating new history.

Metadata DTO: id, bookingId, version, status, filename, byteSize, pageCount,
uploadedAt, issuedAt, terms, currentIssued, usedForHandover. It never exposes object
keys/URLs, provider secrets or idempotency keys. Download filenames are server-generated;
responses use nosniff and sandbox headers. Customers cannot access unpublished drafts.
Guest email matching does not grant access or create an account/claim workflow;
existing guest-to-account access remains outside this change.

Errors: 400 invalid input/type/base64 length; 401 no session; 403 wrong role/facility/
FS assignment; 404 missing/not-owned/unpublished document; 409 missing successful
payment/current issued document or stale/invalid workflow; 422 malformed/encrypted/
oversized decoded PDF, inconsistent metadata/hash or incomplete issue data;
503 unconfigured/unavailable/missing private object storage. Failure is closed:
no issue or new handover succeeds without a validated readable object.

## Storage and transactions

Current storage: authenticated Cloudinary raw PDFs, with the existing object key as
public ID and API-proxied downloads. See [Google and Cloudinary setup](./google-auth-cloudinary.md)
for configuration, migration/cutover and verification. The S3 setup below is historical
and retained for legacy-data migration only; application reads/writes no longer use it.

Configure the existing API environment, using a **private** S3-compatible bucket:

```dotenv
CONTRACT_S3_ENDPOINT=
CONTRACT_S3_REGION=
CONTRACT_S3_BUCKET=
CONTRACT_S3_ACCESS_KEY_ID=
CONTRACT_S3_SECRET_ACCESS_KEY=
```

The bucket must deny public access; the application does not provision a bucket or
change its policies. SDK operations use server credentials, unique immutable keys,
conditional create, bounded requests and no public ACL. Downloads are proxied through
the authenticated backend, so no presigner dependency/public object URLs are needed.
No real S3 credentials/bucket were supplied or exercised in verification.

External object I/O is outside DB transactions. After I/O the backend rechecks live
scope and current booking/contract state under the booking lock. Concurrent object
changes are detected by SHA-256/metadata checks at read; external bucket administration
is outside the DB transaction and must preserve retained versions.

If upload metadata fails, cleanup first checks whether the new key is referenced in
DB. A referenced object is retained, including when commit succeeded but acknowledgement
was lost. On an unexpected DB/transport error, retain the object even if a second connection
cannot yet see the row: commit may still be in flight. If DB state/cleanup cannot
be verified, retain the possible orphan and log cleanup deferral. No deletion API or background object purge is introduced.

## Schema/migration and compatibility

Generated with `bun run db:generate`: `0040_solid_umar.sql` creates booking_contracts,
booking_contract_audit and nullable handover_inspections.contract_id FK. Diagram and
Drizzle schema are updated together; generated SQL/meta were not edited manually.
No user/identity/booking-contact columns are added. No existing data is backfilled.
Already completed handovers remain idempotent without retroactive PDF requirements;
new handovers require the valid current issued PDF. Existing inspection DTOs remain
compatible; exact contract binding is visible via contract metadata/audit.

Migration 0040 was reviewed and applied transactionally to the existing local
localhost:5433/metastorage container, recording its generated hash/time in the local
Drizzle journal. The pre-existing divergent migration history/missing pricing schema
was not reset/reconciled. Full historical db:migrate is not claimed to pass.
An environment with aligned history can use the normal `bun run db:migrate` command.

## Verification and affected files

- `apps/api/src/modules/contracts/*`: routes/service/repository, PDF policy and private S3 adapter/types.
- `packages/contracts/src/rental-documents*`: strict input schemas, output interfaces, messages.
- `packages/database/src/schema/booking-contracts.ts`, `handover-inspections.ts`, indexes/exports and generated 0040 migration.
- `apps/api/src/modules/inspections/*`, `app.ts`: dependency wiring, validated contract gate and binding in the handover transaction.
- `apps/api/tests/integration/rental-contracts.test.ts`: real local PostgreSQL/auth, storage mocked only at adapter boundary.
- `apps/api/tests/integration/handover.integration.test.ts`, fixture: creates/ issues a contract through API; explicit existing-local opt-in, UUID-scoped cleanup, no global cron/queue/worker registration.
- `apps/api/.env.example`, dependency manifests/Bun lock, diagram/plan/API docs.

Run each DB suite in its own process (the suite closes its own pool). Existing-local
opt-in is explicit; no new database/container, reset, truncate, broad seed or Redis
flush is used. Other legacy inspection suites retain their original database guard.

```bash
export NODE_ENV=test LOG_LEVEL=silent PAYMENT_PROVIDER=mock
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/metastorage
export MY_STORAGE_LOCAL_DATABASE_URL="$DATABASE_URL"

bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rental-contracts.test.ts
RUN_INSPECTION_DB_TESTS=1 bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/handover.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/returns.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rentals-read.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/units/inspections.policy.test.ts apps/api/tests/units/bookings/bookings.service.test.ts apps/api/tests/units/returns.policy.test.ts
bun run --filter @metastorage/contracts test
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
git diff --check
```

Observed: contract integration **11 pass / 80 assertions**, updated handover **1 pass /
50 assertions**, return integration **13 pass**, rental reads **5 pass**, existing
inspection/booking and return-policy units **22 pass**, shared contracts **12 pass**.
That is 64 relevant tests run successfully; no full monorepo/production-storage/UI
verification claim. Final API/contracts/database typechecks and lint all passed;
Biome passed on 45 affected TypeScript/manifest files and git diff --check passed.
API build (`bun run --filter api build`) passed. Read-only cleanup verification found
zero fixture facilities/contracts remaining after the DB suites.

Initial contract-test red state: missing routes. One early oversized-PDF assertion
expected 400, corrected to 422 because the base64 length still fits but decoded bytes
exceed the business limit. No requirements were weakened to pass tests.

GitNexus handover impact was LOW with unresolved caller boundaries, checked against
text callers. After indexing, ContractsService/Repository are HIGH because contract
routes and handover share them; warning preceded the final cleanup change. Index
reports truncated process walks/callees; tracked detect-changes (limit 1000) reports
CRITICAL, 35 symbols/23 flows, and its CLI presentation omits some names and untracked
new files. These are limited graph checks, not a complete safety verdict. Changes
were additionally reviewed directly and exercised through DB integration/regression tests.

Existing financial reports now include return refunds/settlement revisions (see
flow-4-reports-api.md). Durable outbox/overdue reminder
behavior is documented in `returns-api.md`. Contract storage needs real deployment
configuration/integration verification. Renewal, upgrade, signing, automated contract
content generation and lawful property disposal remain unimplemented.
