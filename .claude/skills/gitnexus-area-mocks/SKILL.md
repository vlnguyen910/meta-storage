---
name: gitnexus-area-mocks
description: "Skill for the Mocks area of metastorage. 7 symbols across 5 files."
---

# Mocks

7 symbols | 5 files | Cohesion: 56%

## When to Use

- Working with code in `apps/`
- Understanding how resetDemo, addMonths, getMockDatabase work
- Modifying mocks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/mocks/database.ts` | getMockDatabase, resetMockDatabase, saveMockDatabase |
| `apps/web/src/components/layout/app-shell.tsx` | resetDemo |
| `apps/web/src/mocks/core/http.ts` | addMonths |
| `apps/web/src/mocks/handlers/reservations.handlers.ts` | registerReservationHandlers |
| `apps/web/src/mocks/seeds/index.ts` | createSeedDatabase |

## Entry Points

Start here when exploring this area:

- **`resetDemo`** (Function) — `apps/web/src/components/layout/app-shell.tsx:42`
- **`addMonths`** (Function) — `apps/web/src/mocks/core/http.ts:54`
- **`getMockDatabase`** (Function) — `apps/web/src/mocks/database.ts:7`
- **`resetMockDatabase`** (Function) — `apps/web/src/mocks/database.ts:31`
- **`saveMockDatabase`** (Function) — `apps/web/src/mocks/database.ts:27`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `resetDemo` | Function | `apps/web/src/components/layout/app-shell.tsx` | 42 |
| `addMonths` | Function | `apps/web/src/mocks/core/http.ts` | 54 |
| `getMockDatabase` | Function | `apps/web/src/mocks/database.ts` | 7 |
| `resetMockDatabase` | Function | `apps/web/src/mocks/database.ts` | 31 |
| `saveMockDatabase` | Function | `apps/web/src/mocks/database.ts` | 27 |
| `registerReservationHandlers` | Function | `apps/web/src/mocks/handlers/reservations.handlers.ts` | 17 |
| `createSeedDatabase` | Function | `apps/web/src/mocks/seeds/index.ts` | 7 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RootLayout → SaveMockDatabase` | cross_community | 6 |
| `RootLayout → CreateSeedDatabase` | cross_community | 6 |
| `RegisterDashboardHandlers → SaveMockDatabase` | cross_community | 3 |
| `ResetDemo → CreateSeedDatabase` | intra_community | 3 |
| `RegisterUsersHandlers → SaveMockDatabase` | cross_community | 3 |
| `RegisterDashboardHandlers → CreateSeedDatabase` | cross_community | 3 |
| `RegisterUsersHandlers → CreateSeedDatabase` | cross_community | 3 |

## How to Explore

1. `context({name: "resetDemo"})` — see callers and callees
2. `query({search_query: "mocks"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
