# Facility Manager Operations Implementation Plan

**Goal:** Complete Facility Manager rental/payment visibility, charge review queues, and facility-owned unit/pricing management under BOM policy.

**Architecture:** Extend feature contracts and the existing Route → Service → Repository modules. Manager reads require an active, unexpired same-facility assignment; guest contacts remain booking-owned. Financial records and issued contracts remain immutable snapshots.

**Tech Stack:** Fastify, Zod, Drizzle, PostgreSQL, Bun, curl.

---

### Task 1: Manager rental monitoring

- Modify `packages/contracts/src/rentals.ts` and `rentals.types.ts` for facility params, pagination/status/type filters and explicit Manager DTOs.
- Extend `apps/api/src/modules/rentals/rentals.repository.ts` and `rentals.service.ts` with scoped list/detail and paginated payment/renewal history.
- Add GET routes under `/api/facilities/:facilityId/rentals`, `/:rentalId`, `/:rentalId/payments`, and `/:rentalId/renewals` in `apps/api/src/modules/facilities/facilities.routes.ts`.
- Include current rental expiry, booking contact, assigned physical unit, initial-payment facts and current issued-contract metadata. Preserve Customer routes. Reuse existing private contract/PDF routes.
- Payment history includes initial checkout and rental-charge attempts with source identity, confirmed return/charge refunds, and no tokens/provider secrets.

### Task 2: Manager charge review

- Extend `packages/contracts/src/rental-charges.ts` and `rental-charges.types.ts` with facility queue filters and review DTOs.
- Extend `apps/api/src/modules/rental-charges/rental-charges.repository.ts` and `rental-charges.service.ts` for a scoped, paginated queue and detail with audit/history.
- Add GET `/api/facilities/:facilityId/rental-charges` and `/api/rental-charges/:chargeId`; reuse current decision/dispute mutation routes.
- Separate applied collection from late/duplicate captures when presenting outstanding obligations. Preserve existing source/status/approval policies.

### Task 5: Facility-owned units and prices — approved

- Local unit types own name/dimensions/monthly price and belong to one facility; BOM manages a separate rental_price_ranges table, reused by multiple local types.
- This delivery includes rental ranges only; no new extra-fee/overdue/discount/waiver policy engine. Do not create unit_type_changes or store ranges in system_settings.
- Current global `unit_types.monthly_price` policy must not be silently reused after FM-owned pricing is approved.
- Update `docs/db-diagram.md` and Drizzle together after decisions; generate migrations with `bun run db:generate`.
- Update every quote/catalog/renewal reader affected by the approved model; preserve existing booking/renewal/PDF snapshots.
- Use generated expansion and contraction migrations with an atomic data-transfer hook. Preserve existing financial/PDF snapshots; reject unresolved orphan/unpriced legacy catalog records.

### Verification

- Follow the user's existing backend-only scope and verify affected HTTP responses with curl against disposable PostgreSQL fixtures and real session/auth routes.
- Cover list/detail, empty and paginated results, guest records, current expiry after renewal, payment/charge/refund sources, pending/disputed queues, unauthenticated/wrong-role/cross-facility/expired assignment access and invalid filters.
- For approved price writes, also cover boundary/range/version checks and unchanged historical snapshots.
- Run affected type checks, focused Biome, diff checks and graph change analysis. Do not commit or push without a request.

### Progress

- Tasks 1–2 implemented; API reference: `docs/facility-manager-rental-api.md`.
- 55 curl response checks passed against actual Fastify/session auth and disposable PostgreSQL fixtures; resources cleaned up.
- Task 5 implemented: facility-owned types/prices, BOM rental price ranges, existing audit ledger, generated expansion/contraction/price-check migrations and seed/fixture adaptations.
- Additional 74 curl checks passed with real login/session and PostgreSQL. Populated migration rollback, idempotency, reference remaps and monetary snapshot preservation passed.
- Backend/contracts/database type checks passed. Focused PostgreSQL regressions and final lint/graph checks are recorded in the delivery notes.
