# Booking API retirement

Customer workflows now use reservations, payments and appointments. The API no longer
registers the old `/api/bookings/*` or `/api/booking/*` routes.

Before starting an upgraded API or worker, apply the current migrations:

```bash
bun run db:migrate
```

The migration command converts historical bookings to reservations and appointments,
including their payment and workflow references. It rejects conflicting history rather
than overwriting it. Resolve reported conflicts before retrying. Keep the historical
schema, migration utilities and financial records; this cleanup does not delete them.
Do not use `db:clear` or demo seeding to upgrade an existing database.

Old `/booking/tracking` links now open the authenticated customer reservation workspace.
The browser removes the retired guest token and booking-code query before navigating.
Customers must sign in to the account that owns their reservations. Guest tracking is
still available in the explicitly enabled offline web demo.

Remaining legacy client operations support the offline demos. New application code
must use `reservations`, `appointments`, and `inspections` from the shared API client.

The seed regression runs through `bun run --filter @metastorage/database test` when
`SEED_TEST_DATABASE_URL` names a migrated, loopback `metastorage_*_seed_test` database.
It clears that dedicated database, seeds it and checks that a second seed preserves history.
