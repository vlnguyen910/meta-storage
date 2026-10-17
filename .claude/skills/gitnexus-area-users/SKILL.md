---
name: gitnexus-area-users
description: "Skill for the Users area of metastorage. 13 symbols across 6 files."
---

# Users

13 symbols | 6 files | Cohesion: 70%

## When to Use

- Working with code in `apps/`
- Understanding how toApiUser, usersRoutes, onSuccess work
- Modifying users-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/modules/users/users.repository.ts` | UsersRepository, findById, list, updateRole |
| `apps/api/src/modules/users/users.service.ts` | UsersService, getUserById, listUsers, updateUserRole |
| `apps/web/src/modules/system-administrator/users/system-administrator-users-screen.tsx` | onSuccess, setSession |
| `apps/api/src/common/errors/app-error.ts` | NotFoundError |
| `apps/api/src/modules/users/users.mapper.ts` | toApiUser |
| `apps/api/src/modules/users/users.routes.ts` | usersRoutes |

## Entry Points

Start here when exploring this area:

- **`toApiUser`** (Function) — `apps/api/src/modules/users/users.mapper.ts:11`
- **`usersRoutes`** (Function) — `apps/api/src/modules/users/users.routes.ts:8`
- **`onSuccess`** (Function) — `apps/web/src/modules/system-administrator/users/system-administrator-users-screen.tsx:29`
- **`setSession`** (Function) — `apps/web/src/modules/system-administrator/users/system-administrator-users-screen.tsx:23`
- **`NotFoundError`** (Class) — `apps/api/src/common/errors/app-error.ts:22`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `NotFoundError` | Class | `apps/api/src/common/errors/app-error.ts` | 22 |
| `UsersRepository` | Class | `apps/api/src/modules/users/users.repository.ts` | 2 |
| `UsersService` | Class | `apps/api/src/modules/users/users.service.ts` | 6 |
| `toApiUser` | Function | `apps/api/src/modules/users/users.mapper.ts` | 11 |
| `usersRoutes` | Function | `apps/api/src/modules/users/users.routes.ts` | 8 |
| `onSuccess` | Function | `apps/web/src/modules/system-administrator/users/system-administrator-users-screen.tsx` | 29 |
| `setSession` | Function | `apps/web/src/modules/system-administrator/users/system-administrator-users-screen.tsx` | 23 |
| `findById` | Method | `apps/api/src/modules/users/users.repository.ts` | 5 |
| `list` | Method | `apps/api/src/modules/users/users.repository.ts` | 10 |
| `updateRole` | Method | `apps/api/src/modules/users/users.repository.ts` | 14 |
| `getUserById` | Method | `apps/api/src/modules/users/users.service.ts` | 9 |
| `listUsers` | Method | `apps/api/src/modules/users/users.service.ts` | 17 |
| `updateUserRole` | Method | `apps/api/src/modules/users/users.service.ts` | 21 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CatalogRoutes → NotFoundError` | cross_community | 3 |
| `UsersRoutes → ToApiUser` | intra_community | 3 |
| `UsersRoutes → FindById` | intra_community | 3 |
| `UsersRoutes → List` | intra_community | 3 |
| `UsersRoutes → UpdateRole` | intra_community | 3 |
| `FacilitiesRoutes → NotFoundError` | cross_community | 3 |
| `UsersRoutes → NotFoundError` | intra_community | 3 |

## How to Explore

1. `context({name: "toApiUser"})` — see callers and callees
2. `query({search_query: "users"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
