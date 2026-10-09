# Frontend mock

Web runs without API, PostgreSQL, Redis or worker. Run `bun run dev` from the repository root.
`NEXT_PUBLIC_API_MODE=mock` is the default, including when the variable is absent. Explicit
`api` mode is retained for integration testing. Mock requests are intercepted by Axios;
unknown routes fail locally and never fall through to the network.

Data is seeded in the browser and stored under `metastorage.mock-db.v4` in localStorage.
Reload preserves bookings, assignment, verification, inspection photos and handover.
Use the **Khôi phục dữ liệu demo** action in the authenticated app shell to restore the samples.
This affects only browser data, not PostgreSQL.

Demo accounts (password `Demo@123`):

- `customer@metastorage.test`
- `manager@metastorage.test`
- `staff@metastorage.test`
- `operations@metastorage.test`
- `admin@metastorage.test`

Payment succeeds locally without SePay. Rental charge is monthly price × months; deposit is
one month's price. Photos are stored in browser storage without Cloudinary. No confirmation
email is sent. FM assigns a unit and Staff; assigned Staff verifies, inspects, locks the report
and confirms handover. Handover creates an active mock rental and occupies the unit.
`BK-2026-0003` is ready for Staff to check in; `BK-2026-0001` is ready for FM assignment.

Tests: `bun run --filter web test`; browser checks:
`cd apps/web && bunx playwright test -c offline.playwright.config.ts`.

The API source and schema are retained. The local PostgreSQL application tables were cleared
for this switch; do not run database seed commands unless intentionally restoring backend data.
The mobile Expo application retains its separate API integration.
