---
name: gitnexus-area-auth
description: "Skill for the Auth area of metastorage. 6 symbols across 4 files."
---

# Auth

6 symbols | 4 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how hasPermission, Can, usePermission work
- Modifying auth-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/auth/permissions.tsx` | Can, usePermission |
| `apps/web/src/features/auth/login-form.tsx` | onSubmit, setSession |
| `apps/web/src/config/access-control/index.ts` | hasPermission |
| `apps/web/src/config/routes/index.ts` | safeReturnTo |

## Entry Points

Start here when exploring this area:

- **`hasPermission`** (Function) — `apps/web/src/config/access-control/index.ts:15`
- **`Can`** (Function) — `apps/web/src/features/auth/permissions.tsx:12`
- **`usePermission`** (Function) — `apps/web/src/features/auth/permissions.tsx:7`
- **`safeReturnTo`** (Function) — `apps/web/src/config/routes/index.ts:34`
- **`onSubmit`** (Function) — `apps/web/src/features/auth/login-form.tsx:42`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `hasPermission` | Function | `apps/web/src/config/access-control/index.ts` | 15 |
| `Can` | Function | `apps/web/src/features/auth/permissions.tsx` | 12 |
| `usePermission` | Function | `apps/web/src/features/auth/permissions.tsx` | 7 |
| `safeReturnTo` | Function | `apps/web/src/config/routes/index.ts` | 34 |
| `onSubmit` | Function | `apps/web/src/features/auth/login-form.tsx` | 42 |
| `setSession` | Function | `apps/web/src/features/auth/login-form.tsx` | 28 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Can → HasPermission` | intra_community | 3 |

## How to Explore

1. `context({name: "hasPermission"})` — see callers and callees
2. `query({search_query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
