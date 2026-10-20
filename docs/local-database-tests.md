# Integration tests on the existing local containers

Use the current PostgreSQL database on localhost:5433/metastorage and Redis database
14. Do not create a database, reset/reseed fixtures, truncate tables or flush Redis.
Run suites in separate processes: some close their shared Postgres client on teardown.

Booking payment regression runs its scheduler with `facilityId: ids.facility`.
No-show processing, hold expiration, pending-payment reconciliation and rental
lifecycle processing all receive this same boundary. Direct sweep calls also use it.
The API's normal scheduler omits this option and still processes the whole system.
Bun queues and Redis keys used by the suite have fixture-specific names.

A first run on 2026-10-20 exposed the previous suite's unscoped global NO_SHOW calls:
81 tests passed and two failed because demo bookings were included in their counts.
The sweeps changed nine seeded booking scenarios and their related payment/occupancy
state: BK-2026-0002 and DEMO-HCM-01/02/06/07 ASSIGNED/UNASSIGNED. The user explicitly
chose to retain the resulting local data; no recovery/reset/reseed was run.

After the facility scope fix, the payment suite passed 83/83. A before/after snapshot
comparison of bookings, payments, allocations, assignments, verifications, units,
rentals and notification outbox confirmed unchanged non-fixture data after cleanup.
The scope applies to real database queries; it is not a mocked scheduler result.
