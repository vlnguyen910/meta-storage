---
name: gitnexus-area-layout
description: "Skill for the Layout area of metastorage. 9 symbols across 7 files."
---

# Layout

9 symbols | 7 files | Cohesion: 89%

## When to Use

- Working with code in `apps/`
- Understanding how CustomerLayout, FacilityManagerLayout, OperationsLayout work
- Modifying layout-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/layout/app-shell.tsx` | AppShell, clearSession, logout |
| `apps/web/src/app/customer/layout.tsx` | CustomerLayout |
| `apps/web/src/app/facility-manager/layout.tsx` | FacilityManagerLayout |
| `apps/web/src/app/operations/layout.tsx` | OperationsLayout |
| `apps/web/src/app/staff/layout.tsx` | StaffLayout |
| `apps/web/src/app/system-admin/layout.tsx` | SystemAdminLayout |
| `apps/web/src/components/layout/protected-area.tsx` | ProtectedArea |

## Entry Points

Start here when exploring this area:

- **`CustomerLayout`** (Function) — `apps/web/src/app/customer/layout.tsx:3`
- **`FacilityManagerLayout`** (Function) — `apps/web/src/app/facility-manager/layout.tsx:3`
- **`OperationsLayout`** (Function) — `apps/web/src/app/operations/layout.tsx:3`
- **`StaffLayout`** (Function) — `apps/web/src/app/staff/layout.tsx:3`
- **`SystemAdminLayout`** (Function) — `apps/web/src/app/system-admin/layout.tsx:3`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `CustomerLayout` | Function | `apps/web/src/app/customer/layout.tsx` | 3 |
| `FacilityManagerLayout` | Function | `apps/web/src/app/facility-manager/layout.tsx` | 3 |
| `OperationsLayout` | Function | `apps/web/src/app/operations/layout.tsx` | 3 |
| `StaffLayout` | Function | `apps/web/src/app/staff/layout.tsx` | 3 |
| `SystemAdminLayout` | Function | `apps/web/src/app/system-admin/layout.tsx` | 3 |
| `AppShell` | Function | `apps/web/src/components/layout/app-shell.tsx` | 22 |
| `ProtectedArea` | Function | `apps/web/src/components/layout/protected-area.tsx` | 10 |
| `clearSession` | Function | `apps/web/src/components/layout/app-shell.tsx` | 27 |
| `logout` | Function | `apps/web/src/components/layout/app-shell.tsx` | 32 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CustomerLayout → Cn` | cross_community | 4 |
| `FacilityManagerLayout → Cn` | cross_community | 4 |
| `OperationsLayout → Cn` | cross_community | 4 |
| `StaffLayout → Cn` | cross_community | 4 |
| `SystemAdminLayout → Cn` | cross_community | 4 |
| `CustomerLayout → LoadingState` | cross_community | 3 |
| `FacilityManagerLayout → LoadingState` | cross_community | 3 |
| `OperationsLayout → LoadingState` | cross_community | 3 |
| `StaffLayout → LoadingState` | cross_community | 3 |
| `SystemAdminLayout → LoadingState` | cross_community | 3 |

## How to Explore

1. `context({name: "CustomerLayout"})` — see callers and callees
2. `query({search_query: "layout"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
