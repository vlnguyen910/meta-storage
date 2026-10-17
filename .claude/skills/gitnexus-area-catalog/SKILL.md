---
name: gitnexus-area-catalog
description: "Skill for the Catalog area of metastorage. 13 symbols across 4 files."
---

# Catalog

13 symbols | 4 files | Cohesion: 90%

## When to Use

- Working with code in `apps/`
- Understanding how catalogRoutes, CatalogRepository, CatalogService work
- Modifying catalog-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/modules/catalog/catalog.service.ts` | CatalogService, groupUnitTypes, isAvailable, toFacility, getFacility (+2) |
| `apps/api/src/modules/catalog/catalog.repository.ts` | CatalogRepository, findRows, listFacilities |
| `apps/api/tests/units/catalog/catalog.service.test.ts` | findRows, row |
| `apps/api/src/modules/catalog/catalog.routes.ts` | catalogRoutes |

## Entry Points

Start here when exploring this area:

- **`catalogRoutes`** (Function) — `apps/api/src/modules/catalog/catalog.routes.ts:7`
- **`CatalogRepository`** (Class) — `apps/api/src/modules/catalog/catalog.repository.ts:29`
- **`CatalogService`** (Class) — `apps/api/src/modules/catalog/catalog.service.ts:51`
- **`findRows`** (Method) — `apps/api/src/modules/catalog/catalog.repository.ts:79`
- **`listFacilities`** (Method) — `apps/api/src/modules/catalog/catalog.repository.ts:32`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `CatalogRepository` | Class | `apps/api/src/modules/catalog/catalog.repository.ts` | 29 |
| `CatalogService` | Class | `apps/api/src/modules/catalog/catalog.service.ts` | 51 |
| `catalogRoutes` | Function | `apps/api/src/modules/catalog/catalog.routes.ts` | 7 |
| `findRows` | Method | `apps/api/src/modules/catalog/catalog.repository.ts` | 79 |
| `listFacilities` | Method | `apps/api/src/modules/catalog/catalog.repository.ts` | 32 |
| `getFacility` | Method | `apps/api/src/modules/catalog/catalog.service.ts` | 77 |
| `getUnitTypes` | Method | `apps/api/src/modules/catalog/catalog.service.ts` | 87 |
| `listFacilities` | Method | `apps/api/src/modules/catalog/catalog.service.ts` | 54 |
| `groupUnitTypes` | Function | `apps/api/src/modules/catalog/catalog.service.ts` | 26 |
| `isAvailable` | Function | `apps/api/src/modules/catalog/catalog.service.ts` | 5 |
| `toFacility` | Function | `apps/api/src/modules/catalog/catalog.service.ts` | 9 |
| `findRows` | Function | `apps/api/tests/units/catalog/catalog.service.test.ts` | 101 |
| `row` | Function | `apps/api/tests/units/catalog/catalog.service.test.ts` | 8 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CatalogRoutes → IsAvailable` | intra_community | 4 |
| `CatalogRoutes → NotFoundError` | cross_community | 3 |
| `CatalogRoutes → ToFacility` | intra_community | 3 |
| `CatalogRoutes → FindRows` | intra_community | 3 |
| `CatalogRoutes → ListFacilities` | intra_community | 3 |

## How to Explore

1. `context({name: "catalogRoutes"})` — see callers and callees
2. `query({search_query: "catalog"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
