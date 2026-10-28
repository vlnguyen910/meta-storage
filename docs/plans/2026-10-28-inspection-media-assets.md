# Inspection and Media Assets Refactor

## Scope

Use the current `inspections` and `media_assets` tables. Keep role checks on routes, task/facility authorization in the inspection service, and persistence in repositories. No database schema or migration changes are needed.

## Completed

- [x] Add Zod contracts for task-based creation, filters, updates, evidence, and inspection list/detail DTOs.
- [x] Add minimal media-assets repository/service operations for Cloudinary-backed inspection evidence.
- [x] Rebuild inspection persistence using `inspections`, `facility_tasks`, bookings, rentals, and unit assignments.
- [x] Add `GET /api/inspections/staff` guarded by `FACILITY_STAFF`.
- [x] Add `GET /api/inspections/facility` guarded by `FACILITY_MANAGER`; facility scope comes from the manager's active assignment.
- [x] Keep create/detail/update routes, put evidence changes and completion in PATCH, and retain the separate check-in handover transaction.
- [x] Run Biome and `git diff --check` successfully.

## Validation

`bun run --filter api check-types` exits with code 2 because other workspace modules still reference removed return/inspection tables and contain unrelated payment type errors. The command reports no errors in the updated inspections or media-assets files. Tests were not run.

## Follow-up

Web/mobile callers still use legacy booking-scoped inspection and photo routes and need migration to these contracts before using the refactored endpoints.
