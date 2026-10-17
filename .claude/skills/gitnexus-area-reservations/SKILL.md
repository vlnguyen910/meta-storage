---
name: gitnexus-area-reservations
description: "Skill for the Reservations area of metastorage. 18 symbols across 6 files."
---

# Reservations

18 symbols | 6 files | Cohesion: 81%

## When to Use

- Working with code in `apps/`
- Understanding how healthPlugin, successResponse, reservationsRoutes work
- Modifying reservations-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/modules/reservations/reservations.service.ts` | addMonths, isWithinHours, parseParts, get, toContact (+2) |
| `apps/api/src/modules/reservations/reservations.repository.ts` | countCapacity, createDraft, findActiveContext, findOperatingHours, ReservationsRepository |
| `apps/web/src/features/reservations/reservation-wizard.tsx` | next, apiErrorMessage, toApiDateTime |
| `apps/api/src/common/plugins/health.ts` | healthPlugin |
| `apps/api/src/common/response/api-response.ts` | successResponse |
| `apps/api/src/modules/reservations/reservations.routes.ts` | reservationsRoutes |

## Entry Points

Start here when exploring this area:

- **`healthPlugin`** (Function) — `apps/api/src/common/plugins/health.ts:4`
- **`successResponse`** (Function) — `apps/api/src/common/response/api-response.ts:2`
- **`reservationsRoutes`** (Function) — `apps/api/src/modules/reservations/reservations.routes.ts:10`
- **`next`** (Function) — `apps/web/src/features/reservations/reservation-wizard.tsx:73`
- **`ReservationsRepository`** (Class) — `apps/api/src/modules/reservations/reservations.repository.ts:17`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ReservationsRepository` | Class | `apps/api/src/modules/reservations/reservations.repository.ts` | 17 |
| `ReservationsService` | Class | `apps/api/src/modules/reservations/reservations.service.ts` | 40 |
| `healthPlugin` | Function | `apps/api/src/common/plugins/health.ts` | 4 |
| `successResponse` | Function | `apps/api/src/common/response/api-response.ts` | 2 |
| `reservationsRoutes` | Function | `apps/api/src/modules/reservations/reservations.routes.ts` | 10 |
| `next` | Function | `apps/web/src/features/reservations/reservation-wizard.tsx` | 73 |
| `countCapacity` | Method | `apps/api/src/modules/reservations/reservations.repository.ts` | 51 |
| `createDraft` | Method | `apps/api/src/modules/reservations/reservations.repository.ts` | 75 |
| `findActiveContext` | Method | `apps/api/src/modules/reservations/reservations.repository.ts` | 20 |
| `findOperatingHours` | Method | `apps/api/src/modules/reservations/reservations.repository.ts` | 38 |
| `createDraft` | Method | `apps/api/src/modules/reservations/reservations.service.ts` | 43 |
| `addMonths` | Function | `apps/api/src/modules/reservations/reservations.service.ts` | 26 |
| `isWithinHours` | Function | `apps/api/src/modules/reservations/reservations.service.ts` | 32 |
| `parseParts` | Function | `apps/api/src/modules/reservations/reservations.service.ts` | 10 |
| `get` | Function | `apps/api/src/modules/reservations/reservations.service.ts` | 18 |
| `toContact` | Function | `apps/api/src/modules/reservations/reservations.service.ts` | 36 |
| `apiErrorMessage` | Function | `apps/web/src/features/reservations/reservation-wizard.tsx` | 31 |
| `toApiDateTime` | Function | `apps/web/src/features/reservations/reservation-wizard.tsx` | 39 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReservationsRoutes → CountCapacity` | cross_community | 3 |
| `ReservationsRoutes → CreateDraft` | cross_community | 3 |
| `ReservationsRoutes → FindActiveContext` | cross_community | 3 |
| `ReservationsRoutes → FindOperatingHours` | cross_community | 3 |

## How to Explore

1. `context({name: "healthPlugin"})` — see callers and callees
2. `query({search_query: "reservations"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
