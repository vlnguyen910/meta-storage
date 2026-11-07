# Unit type catalog and facility offerings

BOM owns `unit_types`: standard metadata, dimensions and required min/max monthly prices.
FM owns `facility_unit_types`: association with an assigned facility, monthly price and local enablement.
All routes below use the `/api` prefix and session authentication unless marked public.

| Method and path | Role | Request |
| --- | --- | --- |
| `GET /unit-types` | BOM, FM, admin | `limit`, `offset`, optional `isActive`; FM sees active catalog only |
| `POST /unit-types` | BOM | `code`, `name`, `coverUrl`, `sizeLabel`, `lengthM`, `widthM`, `heightM`, `minMonthlyPrice`, `maxMonthlyPrice` |
| `PATCH /unit-types/:id` | BOM | `expectedVersion` and any catalog metadata, bounds or `isActive` |
| `POST /facilities/:facilityId/unit-types` | FM assigned to facility | `unitTypeId` (catalog ID), `monthlyPrice` |
| `PATCH /facilities/:facilityId/unit-types/:unitTypeId` | FM assigned to facility | Path ID is offering ID; `expectedVersion` with `monthlyPrice` and/or `isActive` |
| `GET /facilities/:facilityId/unit-types/management` | BOM, admin, assigned FM | Paginated facility offerings, including inactive entries |
| `GET /facilities/:facilityId/unit-types` | Public | Active facility and active catalog/offering entries |
| `PATCH /business-rules/pricing/:unitTypeId` | Assigned FM | Compatibility route for local price; offering ID with `expectedVersion`, `monthlyPrice` |

Catalog IDs and offering IDs are distinct. Public and management facility responses
remain flat: `id` is the offering ID, `catalogUnitTypeId` is the standard type ID,
standard dimensions/name/cover come from the catalog, monthly price from the offering.
Existing booking/reservation/storage-unit inputs retain `unitTypeId` as the offering ID.

FM cannot edit standard dimensions, metadata or price limits. `minMonthlyPrice > 0`
and `maxMonthlyPrice >= minMonthlyPrice`; local prices must fit both limits.
Catalog bounds cannot be changed to exclude an existing configured price, including
inactive offerings. Dimensions cannot change after a type has a facility offering.
Duplicate assignments, stale versions and price conflicts return 409; unauthorized
facility scope returns 403. Unknown body fields are rejected.

The former range-catalog and range-assignment pricing endpoints are removed. Bounds
are edited directly with the BOM catalog PATCH endpoint. Historical pricing records
retain their original payloads; new bound-change records contain min/max values.

Migration 0022 adds the offering table and nullable bounds, 0023 backfills records,
0024 rewires operational FKs, 0025 finalizes catalog constraints, and 0026 removes the
old range table. Existing offering IDs are preserved. Legacy unbounded ranges become
min=max=current price; finite ranges are preserved. No legacy types are automatically
merged. Duplicate catalog codes receive an ID suffix. BOM should review migrated codes
and limits. Migration scripts are generated with Drizzle Kit; 0023 is an authored custom
data migration. No application database is migrated automatically by this change.

The web management UI uses the new contracts through the shared API client.
BOM manages standard types and min/max on Operations → Facility Management → Unit Types.
FM selects catalog types and sets prices on Storage Units → Unit Types & Facility Prices;
physical unit creation lists only active offerings and sends the offering ID.
The UI reuses existing dialogs, fields, tables, buttons and selection controls.
