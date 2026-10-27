# Staff Daily Lists Implementation Plan

**Goal:** Filter assigned check-in bookings and scheduled return requests by local appointment date.

**Architecture:** Extend the existing shared input contracts and Route → Service → Repository flow. Keep response arrays and authorization unchanged; no database migration, frontend or API-client changes.

**Tech Stack:** Fastify, Zod, Drizzle, PostgreSQL, Bun, curl.

---

### Task 1: Extend date query contracts

- Modify `packages/contracts/src/bookings.ts` and `returns.ts`, with validation messages in their adjacent `*.messages.ts` files.
- Accept optional ISO `fromDate`/`toDate`, inclusive. One supplied bound means that single date. Reject inverted ranges with HTTP 400.
- No supplied dates means today in the facility timezone for bookings, and the saved appointment timezone for returns.

### Task 2: Apply database filters

- Modify `apps/api/src/modules/bookings/bookings.routes.ts`, `bookings.service.ts`, and `bookings.repository.ts` to pass the query and filter `checkInDate`.
- Modify `apps/api/src/modules/returns/returns.repository.ts` to filter `returnRequests.date` before existing pagination.
- Sort by appointment time and ID. Preserve existing status and Staff assignment rules. No overdue backlog or rentals without return requests.
- Adjust existing test callers to pass their fixture dates explicitly and the booking service's updated query object; do not add or run automated suites, per the user's instruction.

### Task 3: Verify actual HTTP responses

- Start the relevant real Fastify routes against disposable local PostgreSQL fixtures, without background jobs.
- Use curl and response assertions for: today, one date, inclusive range, empty results, invalid dates, reversed range, pagination/order, unauthenticated and cross-facility/other-Staff access.
- Exercise a timezone whose local date differs from UTC.
- Run affected type checks, Biome, and `git diff --check`; inspect graph changes. Do not commit.
- Stop the temporary server and remove disposable fixtures/database. Record the curl results in the handoff.

### Verification completed

- 26 curl response checks passed against real auth, Fastify routes and an isolated PostgreSQL database.
- Covered default local today, either single bound, inclusive range, empty dates, reversed ranges, invalid dates/formats, assignment/role/facility isolation, return status filters, chronological ordering and filtering before pagination.
- Timezone check: UTC date `2026-10-24`, facility timezone `Pacific/Kiritimati`, local date `2026-10-25`.
- API/contracts type checks and focused Biome checks passed. Automated suites and browser verification were not run, as requested.
- Temporary HTTP server, curl files and database were removed.

### Request examples

```bash
# No dates: today in the facility timezone.
curl -b cookies.txt 'http://localhost:4000/api/bookings/assigned-to-me'

# One date: only that local calendar date.
curl -b cookies.txt 'http://localhost:4000/api/bookings/assigned-to-me?fromDate=2026-10-24'

# Inclusive range; return queue keeps its existing status/limit/offset parameters.
curl -b cookies.txt 'http://localhost:4000/api/facilities/FACILITY_ID/return-requests?fromDate=2026-10-24&toDate=2026-10-26&limit=20&offset=0'
```

Booking "today" and projected slot timestamps use the facility's configured operating-hours timezone. Return "today" uses each appointment's saved timezone. This default also applies to Manager callers of the same return queue. A facility must have its operating-hours timezone configured; no implicit UTC fallback is introduced.
