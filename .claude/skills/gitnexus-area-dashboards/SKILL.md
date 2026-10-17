---
name: gitnexus-area-dashboards
description: "Skill for the Dashboards area of metastorage. 5 symbols across 5 files."
---

# Dashboards

5 symbols | 5 files | Cohesion: 89%

## When to Use

- Working with code in `apps/`
- Understanding how dashboardFor, businessOperationsDashboard, facilityManagerDashboard work
- Modifying dashboards-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/mocks/core/dashboard-data.ts` | dashboardFor |
| `apps/web/src/mocks/seeds/dashboards/business-operations.dashboard.ts` | businessOperationsDashboard |
| `apps/web/src/mocks/seeds/dashboards/facility-manager.dashboard.ts` | facilityManagerDashboard |
| `apps/web/src/mocks/seeds/dashboards/facility-staff.dashboard.ts` | facilityStaffDashboard |
| `apps/web/src/mocks/seeds/dashboards/system-administrator.dashboard.ts` | systemAdministratorDashboard |

## Entry Points

Start here when exploring this area:

- **`dashboardFor`** (Function) — `apps/web/src/mocks/core/dashboard-data.ts:7`
- **`businessOperationsDashboard`** (Function) — `apps/web/src/mocks/seeds/dashboards/business-operations.dashboard.ts:3`
- **`facilityManagerDashboard`** (Function) — `apps/web/src/mocks/seeds/dashboards/facility-manager.dashboard.ts:2`
- **`facilityStaffDashboard`** (Function) — `apps/web/src/mocks/seeds/dashboards/facility-staff.dashboard.ts:2`
- **`systemAdministratorDashboard`** (Function) — `apps/web/src/mocks/seeds/dashboards/system-administrator.dashboard.ts:2`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `dashboardFor` | Function | `apps/web/src/mocks/core/dashboard-data.ts` | 7 |
| `businessOperationsDashboard` | Function | `apps/web/src/mocks/seeds/dashboards/business-operations.dashboard.ts` | 3 |
| `facilityManagerDashboard` | Function | `apps/web/src/mocks/seeds/dashboards/facility-manager.dashboard.ts` | 2 |
| `facilityStaffDashboard` | Function | `apps/web/src/mocks/seeds/dashboards/facility-staff.dashboard.ts` | 2 |
| `systemAdministratorDashboard` | Function | `apps/web/src/mocks/seeds/dashboards/system-administrator.dashboard.ts` | 2 |

## How to Explore

1. `context({name: "dashboardFor"})` — see callers and callees
2. `query({search_query: "dashboards"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
