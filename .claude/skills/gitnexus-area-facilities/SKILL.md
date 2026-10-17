---
name: gitnexus-area-facilities
description: "Skill for the Facilities area of metastorage. 45 symbols across 9 files."
---

# Facilities

45 symbols | 9 files | Cohesion: 68%

## When to Use

- Working with code in `apps/`
- Understanding how assertActiveUser, assertUserHasRole, requireAuth work
- Modifying facilities-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/modules/facilities/facilities.repository.ts` | FacilitiesRepository, deactivateAssignment, findAssignment, findById, listUserAssignmentsWithFacilities (+9) |
| `apps/api/src/modules/facilities/facilities.service.ts` | FacilitiesService, assignUserToFacility, listUserAssignments, revokeAssignment, assertManagerScope (+5) |
| `apps/api/src/common/errors/app-error.ts` | BadRequestError, UnauthorizedError, AppError, ConflictError, ForbiddenError (+1) |
| `apps/api/src/modules/facilities/facilities.access.ts` | requireAssignedFacility, getFacilityAccessScope, getFacilityListScope, isFacilityRole, isGlobalFacilityRole |
| `apps/api/src/modules/auth/auth.authorization.ts` | assertActiveUser, assertUserHasRole, isRole |
| `apps/api/src/modules/auth/auth.guard.ts` | requireAuth, requireRole |
| `apps/api/src/modules/facilities/facilities.guard.ts` | getFacilityContext, requireFacilityAccess |
| `apps/api/src/modules/facilities/facilities.mapper.ts` | toApiFacilityAssignment, toApiFacility |
| `apps/api/src/modules/facilities/facilities.routes.ts` | facilitiesRoutes |

## Entry Points

Start here when exploring this area:

- **`assertActiveUser`** (Function) — `apps/api/src/modules/auth/auth.authorization.ts:12`
- **`assertUserHasRole`** (Function) — `apps/api/src/modules/auth/auth.authorization.ts:20`
- **`requireAuth`** (Function) — `apps/api/src/modules/auth/auth.guard.ts:24`
- **`requireRole`** (Function) — `apps/api/src/modules/auth/auth.guard.ts:38`
- **`getFacilityContext`** (Function) — `apps/api/src/modules/facilities/facilities.guard.ts:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BadRequestError` | Class | `apps/api/src/common/errors/app-error.ts` | 28 |
| `UnauthorizedError` | Class | `apps/api/src/common/errors/app-error.ts` | 34 |
| `FacilitiesRepository` | Class | `apps/api/src/modules/facilities/facilities.repository.ts` | 20 |
| `FacilitiesService` | Class | `apps/api/src/modules/facilities/facilities.service.ts` | 18 |
| `AppError` | Class | `apps/api/src/common/errors/app-error.ts` | 2 |
| `ConflictError` | Class | `apps/api/src/common/errors/app-error.ts` | 46 |
| `ForbiddenError` | Class | `apps/api/src/common/errors/app-error.ts` | 40 |
| `ValidationError` | Class | `apps/api/src/common/errors/app-error.ts` | 52 |
| `assertActiveUser` | Function | `apps/api/src/modules/auth/auth.authorization.ts` | 12 |
| `assertUserHasRole` | Function | `apps/api/src/modules/auth/auth.authorization.ts` | 20 |
| `requireAuth` | Function | `apps/api/src/modules/auth/auth.guard.ts` | 24 |
| `requireRole` | Function | `apps/api/src/modules/auth/auth.guard.ts` | 38 |
| `getFacilityContext` | Function | `apps/api/src/modules/facilities/facilities.guard.ts` | 31 |
| `requireFacilityAccess` | Function | `apps/api/src/modules/facilities/facilities.guard.ts` | 43 |
| `toApiFacilityAssignment` | Function | `apps/api/src/modules/facilities/facilities.mapper.ts` | 16 |
| `facilitiesRoutes` | Function | `apps/api/src/modules/facilities/facilities.routes.ts` | 19 |
| `requireAssignedFacility` | Function | `apps/api/src/modules/facilities/facilities.access.ts` | 53 |
| `toApiFacility` | Function | `apps/api/src/modules/facilities/facilities.mapper.ts` | 3 |
| `getFacilityAccessScope` | Function | `apps/api/src/modules/facilities/facilities.access.ts` | 43 |
| `getFacilityListScope` | Function | `apps/api/src/modules/facilities/facilities.access.ts` | 30 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RequireRole → ForbiddenError` | cross_community | 4 |
| `FacilitiesRoutes → ActiveAssignmentExists` | cross_community | 4 |
| `RequireFacilityAccess → ForbiddenError` | cross_community | 4 |
| `RequireRole → IsRole` | intra_community | 3 |
| `RequireRole → UnauthorizedError` | intra_community | 3 |
| `FacilitiesRoutes → ConflictError` | cross_community | 3 |
| `FacilitiesRoutes → ToApiFacility` | cross_community | 3 |
| `FacilitiesRoutes → CreateFacility` | cross_community | 3 |
| `FacilitiesRoutes → FindByCode` | cross_community | 3 |
| `FacilitiesRoutes → ToApiFacilityAssignment` | intra_community | 3 |

## How to Explore

1. `context({name: "assertActiveUser"})` — see callers and callees
2. `query({search_query: "facilities"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
