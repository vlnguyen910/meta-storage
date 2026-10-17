---
name: gitnexus-area-app
description: "Skill for the App area of metastorage. 6 symbols across 6 files."
---

# App

6 symbols | 6 files | Cohesion: 48%

## When to Use

- Working with code in `apps/`
- Understanding how RootLayout, AppProviders, ToastProvider work
- Modifying app-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/app/layout.tsx` | RootLayout |
| `apps/web/src/components/providers/app-providers.tsx` | AppProviders |
| `apps/web/src/components/ui/toast.tsx` | ToastProvider |
| `apps/web/src/mocks/core/http.ts` | errorBody |
| `apps/web/src/mocks/handlers/dashboards.handlers.ts` | registerDashboardHandlers |
| `apps/web/src/mocks/install-mock-api.ts` | installMockApi |

## Entry Points

Start here when exploring this area:

- **`RootLayout`** (Function) — `apps/web/src/app/layout.tsx:13`
- **`AppProviders`** (Function) — `apps/web/src/components/providers/app-providers.tsx:9`
- **`ToastProvider`** (Function) — `apps/web/src/components/ui/toast.tsx:18`
- **`errorBody`** (Function) — `apps/web/src/mocks/core/http.ts:16`
- **`registerDashboardHandlers`** (Function) — `apps/web/src/mocks/handlers/dashboards.handlers.ts:6`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `RootLayout` | Function | `apps/web/src/app/layout.tsx` | 13 |
| `AppProviders` | Function | `apps/web/src/components/providers/app-providers.tsx` | 9 |
| `ToastProvider` | Function | `apps/web/src/components/ui/toast.tsx` | 18 |
| `errorBody` | Function | `apps/web/src/mocks/core/http.ts` | 16 |
| `registerDashboardHandlers` | Function | `apps/web/src/mocks/handlers/dashboards.handlers.ts` | 6 |
| `installMockApi` | Function | `apps/web/src/mocks/install-mock-api.ts` | 12 |

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
| `RegisterDashboardHandlers → SaveMockDatabase` | cross_community | 3 |

## How to Explore

1. `context({name: "RootLayout"})` — see callers and callees
2. `query({search_query: "app"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
