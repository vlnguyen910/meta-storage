# Local demo data

Database: `metastorage` on `localhost:5433` when using Docker Compose. Apply migrations
before seeding. Test databases are separate.

## Accounts

All accounts below use the local-only password **`12345678`**. Accounts are active,
email-verified, and have actual Better Auth credential records, so they work on Web
and Swagger rather than only in mocks.

| Role | Email | Facility |
| --- | --- | --- |
| Customer | `customer@metastorage.vn` | Own bookings |
| Facility Manager | `manager@metastorage.vn` | HCM-01 |
| Facility Staff | `staff@metastorage.vn` | HCM-01 |
| Business Operations | `bom@metastorage.vn` | Role-defined access |
| System Admin | `admin@metastorage.vn` | Role-defined access |

Additional accounts, with the same password:

- `customer1@metastorage.test` through `customer6@metastorage.test`.
- `manager.hcm02@metastorage.test` through `manager.hcm10@metastorage.test`, each assigned
  to the matching facility.
- `staff.hcm02@metastorage.test` through `staff.hcm10@metastorage.test`, each assigned
  to the matching facility.

One active facility assignment per employee is preserved. A manager for HCM-01 cannot
read HCM-02 operational bookings. All contact names, addresses and inventory are
fictional demonstration data; do not use these credentials in production.

## Dataset

- 10 facilities in Ho Chi Minh City with addresses and descriptions.
- 8 shared Unit Types and 80 active facility offerings, with dimensions and prices.
- 328 physical units with codes, floor and location descriptions. Every facility/type
  has multiple units for checkout and manual assignment; maintenance/inspection units
  demonstrate unavailable inventory.
- 70 operating-hour records: all seven weekdays, 08:00–20:00 Vietnam time, and four
  check-in slots spanning 09:00–17:00.
- 29 working accounts, including seven customers and a manager/staff pair for each facility.
- 38 bookings: 23 confirmed, 13 drafts, one cancelled, and one no-show immediately after seed.
- 28 payments and 25 allocations, including paid bookings, pending checkout, failed payment,
  manual-refund pending, and active/expired hold scenarios.

Each facility has a future paid booking waiting for unit assignment and another prepared
booking with a unit/staff assigned. Drafts remain outside operational lists. Paid records
have matching pricing snapshots, payment totals, allocations and QR hashes. Cancelled
and no-show refund snapshots preserve the existing rent/deposit policy.

Sample identifiers:

- `BK-2026-0001`: today's prepared booking in HCM-01; normal no-show timing applies.
- `BK-2026-0002`: a prepared booking for tomorrow.
- `BK-2026-0003`: no-show with rent-only refund pending and deposit forfeited.
- `DEMO-HCM-01-UNASSIGNED` through `DEMO-HCM-10-UNASSIGNED`: future paid bookings for FM assignment.
- `DEMO-FLOW2-READY`: paid booking in HCM-01, unassigned, scheduled for today at 09:00
  Vietnam time for manual Swagger testing of assignment through handover.
- `DEMO-HCM-01-ASSIGNED` through `DEMO-HCM-10-ASSIGNED`: future prepared bookings.
- Payment codes `DEMO-PAY-1`/`2`: pending active/expired holds, `DEMO-PAY-3`: failed,
  `DEMO-PAY-4`: cancelled booking awaiting refund.

Dates are generated relative to the seeding time. The active sample hold lasts ten
minutes; the normal API cron may expire holds or mark overdue bookings as no-show.
Scenario counts can therefore change after the API runs. Seed payments are simulated
fixtures; they do not represent a SePay transaction and do not enqueue/send email.

## Commands

From the repository root, with `DATABASE_URL` pointing to the intended local database:

```sh
bun run db:seed
```

This runs the domain seed and prepares login credentials. The existing primary fixture
IDs used by Swagger are retained. Rerunning on a freshly seeded database was verified
not to duplicate records; this is not a general reset for fixtures already handed over
or otherwise modified through business workflows. Seeding is rejected in production.

For Web testing, run Web in API mode and sign in as the manager above. Its dispatch
dashboard contains real seeded paid bookings waiting for unit assignment. Public browsing
shows all ten facilities, Unit Types, dimensions and prices from the existing APIs.
Capacity is checked by draft creation and start-payment; no separate period-availability
endpoint is introduced by the frontend integration.

The API still needs PostgreSQL and Redis to run. External SePay callbacks and email delivery
require their own environment configuration; database seeding does not configure them.
