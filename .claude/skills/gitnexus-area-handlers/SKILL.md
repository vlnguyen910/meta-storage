---
name: gitnexus-area-handlers
description: "Skill for the Handlers area of metastorage. 13 symbols across 5 files."
---

# Handlers

13 symbols | 5 files | Cohesion: 63%

## When to Use

- Working with code in `apps/`
- Understanding how createSession, currentUser, envelope work
- Modifying handlers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/mocks/core/http.ts` | createSession, currentUser, envelope, getBearer, parseBody (+3) |
| `apps/web/src/mocks/handlers/facilities.handlers.ts` | registerFacilityHandlers, toCatalogFacility |
| `apps/web/src/mocks/handlers/auth.handlers.ts` | registerAuthHandlers |
| `apps/web/src/mocks/handlers/users.handlers.ts` | registerUsersHandlers |
| `apps/web/src/mocks/database.ts` | hydrateFacility |

## Entry Points

Start here when exploring this area:

- **`createSession`** (Function) — `apps/web/src/mocks/core/http.ts:44`
- **`currentUser`** (Function) — `apps/web/src/mocks/core/http.ts:39`
- **`envelope`** (Function) — `apps/web/src/mocks/core/http.ts:12`
- **`parseBody`** (Function) — `apps/web/src/mocks/core/http.ts:20`
- **`publicUser`** (Function) — `apps/web/src/mocks/core/http.ts:24`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createSession` | Function | `apps/web/src/mocks/core/http.ts` | 44 |
| `currentUser` | Function | `apps/web/src/mocks/core/http.ts` | 39 |
| `envelope` | Function | `apps/web/src/mocks/core/http.ts` | 12 |
| `parseBody` | Function | `apps/web/src/mocks/core/http.ts` | 20 |
| `publicUser` | Function | `apps/web/src/mocks/core/http.ts` | 24 |
| `tokenUserId` | Function | `apps/web/src/mocks/core/http.ts` | 29 |
| `registerAuthHandlers` | Function | `apps/web/src/mocks/handlers/auth.handlers.ts` | 13 |
| `registerUsersHandlers` | Function | `apps/web/src/mocks/handlers/users.handlers.ts` | 6 |
| `optionsForUnits` | Function | `apps/web/src/mocks/core/http.ts` | 60 |
| `hydrateFacility` | Function | `apps/web/src/mocks/database.ts` | 35 |
| `registerFacilityHandlers` | Function | `apps/web/src/mocks/handlers/facilities.handlers.ts` | 10 |
| `getBearer` | Function | `apps/web/src/mocks/core/http.ts` | 34 |
| `toCatalogFacility` | Function | `apps/web/src/mocks/handlers/facilities.handlers.ts` | 134 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RootLayout → PublicUser` | cross_community | 6 |
| `RootLayout → SaveMockDatabase` | cross_community | 6 |
| `RootLayout → CreateSeedDatabase` | cross_community | 6 |
| `RootLayout → Envelope` | cross_community | 5 |
| `RootLayout → ParseBody` | cross_community | 5 |
| `RootLayout → OptionsForUnits` | cross_community | 5 |
| `RootLayout → HydrateFacility` | cross_community | 5 |
| `RegisterDashboardHandlers → GetBearer` | cross_community | 3 |
| `RegisterDashboardHandlers → TokenUserId` | cross_community | 3 |
| `RegisterUsersHandlers → GetBearer` | intra_community | 3 |

## How to Explore

1. `context({name: "createSession"})` — see callers and callees
2. `query({search_query: "handlers"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
