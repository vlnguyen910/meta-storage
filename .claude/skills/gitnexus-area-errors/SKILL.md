---
name: gitnexus-area-errors
description: "Skill for the Errors area of metastorage. 4 symbols across 4 files."
---

# Errors

4 symbols | 4 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how buildApp, setupErrorHandler, errorResponse work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/app.ts` | buildApp |
| `apps/api/src/common/errors/error-handler.ts` | setupErrorHandler |
| `apps/api/src/common/response/api-response.ts` | errorResponse |
| `apps/api/src/index.ts` | start |

## Entry Points

Start here when exploring this area:

- **`buildApp`** (Function) — `apps/api/src/app.ts:15`
- **`setupErrorHandler`** (Function) — `apps/api/src/common/errors/error-handler.ts:5`
- **`errorResponse`** (Function) — `apps/api/src/common/response/api-response.ts:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildApp` | Function | `apps/api/src/app.ts` | 15 |
| `setupErrorHandler` | Function | `apps/api/src/common/errors/error-handler.ts` | 5 |
| `errorResponse` | Function | `apps/api/src/common/response/api-response.ts` | 11 |
| `start` | Function | `apps/api/src/index.ts` | 3 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Start → ErrorResponse` | intra_community | 4 |

## How to Explore

1. `context({name: "buildApp"})` — see callers and callees
2. `query({search_query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
