# Reservation → appointment → check-in

## Rental renewal

Run `bun apps/api/tests/run-rental-renewal-postman.ts` from the repository root.
The runner creates and migrates a unique loopback PostgreSQL database on port
5433, starts the existing real API fixture and runs the two renewal collections
with Postman CLI and `--no-report-events`. It deletes its database and temporary
credentials afterward. SePay lookup is substituted; signed checkout and the real
webhook verifier use local test credentials, without bank transfers.

The main collection currently passes 54 requests / 79 assertions. The own-unit
capacity collection deliberately expects a valid occupied rental to be renewable
without spare AVAILABLE inventory; it currently fails (expected 201, actual 409).
The runner preserves that nonzero exit code. Logs are written to
`/tmp/rental-renewal-postman.log` and `/tmp/rental-renewal-capacity-postman.log`.
See `docs/rental-renewal-test-report.md` for per-request results and the workflow.

`reservation-check-in.postman_collection.json` runs against real API routes and
PostgreSQL with actual customer, manager and staff logins. The fixture uses local
SePay credentials to sign checkout fields and sends a simulated paid IPN through
the real webhook verifier. It makes no bank transfer or outbound SePay request.

The `Reserve` folder covers facility/type discovery, availability, draft/appointment creation before payment,
manager visibility/unit and staff assignment and early-start rejection.
Checkout assertions also verify all three provider return URLs point to the Web
page `/customer/payments/result` and preserve payment/reservation IDs. Set `webUrl`
to the API configuration `WEB_URL` when running the collection manually.
`CheckIn` covers inspection/checklist, handover, replay protection, completed
appointment/task and customer/manager rental and payment reads. It also checks reservation support, inspection recovery and lifecycle notifications.
There are 44 requests and 70 assertions. Results are local (`--no-report-events`).

Run from the repository root with Bun, Docker PostgreSQL and Postman CLI installed.
Create an empty database dedicated to this test (never use the application DB):

```sh
docker exec metastorage-db createdb -U postgres metastorage_inspection_test_checkin_flow

NODE_ENV=test \
DATABASE_URL=postgres://postgres:postgres@localhost:5433/metastorage_inspection_test_checkin_flow \
bun packages/database/src/migrate.ts

NODE_ENV=test \
DATABASE_URL=postgres://postgres:postgres@localhost:5433/metastorage_inspection_test_checkin_flow \
BOOKING_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/metastorage_inspection_test_checkin_flow \
RUN_POSTMAN_FLOW=1 \
SEPAY_MERCHANT_ID=workflow-test \
SEPAY_SECRET_KEY=workflow-test-local-only \
SEPAY_ENV=sandbox \
bun test apps/api/tests/integration/reservation-appointments-postgres.test.ts
```

The test starts a server on a free loopback port, creates fixture accounts and
an environment file, runs `postman collection run` for each folder and advances
the test server clock to the scheduled date between folders. It removes its
fixture records and temporary credentials afterward. No time-control endpoint
is added to the application. The collection can also be imported into Postman;
provide the environment variables referenced by its requests and run CheckIn on
the appointment day. Test credentials shown above are intentionally fake.

After testing, remove only the database created for this run:

```sh
docker exec metastorage-db dropdb -U postgres metastorage_inspection_test_checkin_flow
```
