---
name: gitnexus-area-dashboard
description: "Skill for the Dashboard area of metastorage. 52 symbols across 36 files."
---

# Dashboard

52 symbols | 36 files | Cohesion: 93%

## When to Use

- Working with code in `apps/`
- Understanding how CustomerDashboardPage, CustomerFacilitiesPage, ReservationDetailPage work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/facilities/hooks.ts` | detail, list, unitTypes, useAvailability, useFacilities (+1) |
| `apps/web/src/components/ui/display.tsx` | Card, Currency, PageHeader, StatusBadge |
| `apps/web/src/features/reservations/hooks.ts` | detail, useMyReservations, useReservation, useReservationDraft |
| `apps/web/src/components/ui/states.tsx` | EmptyState, ErrorState, LoadingState |
| `apps/web/src/lib/format.ts` | dateInputMin, formatCurrency, formatDate |
| `apps/web/src/components/ui/button.tsx` | Button, buttonClassName |
| `apps/web/src/app/customer/dashboard/page.tsx` | CustomerDashboardPage |
| `apps/web/src/app/customer/facilities/page.tsx` | CustomerFacilitiesPage |
| `apps/web/src/app/customer/reservations/[reservationId]/page.tsx` | ReservationDetailPage |
| `apps/web/src/app/customer/reservations/new/page.tsx` | NewReservationPage |

## Entry Points

Start here when exploring this area:

- **`CustomerDashboardPage`** (Function) — `apps/web/src/app/customer/dashboard/page.tsx:1`
- **`CustomerFacilitiesPage`** (Function) — `apps/web/src/app/customer/facilities/page.tsx:1`
- **`ReservationDetailPage`** (Function) — `apps/web/src/app/customer/reservations/[reservationId]/page.tsx:1`
- **`NewReservationPage`** (Function) — `apps/web/src/app/customer/reservations/new/page.tsx:1`
- **`ReservationsPage`** (Function) — `apps/web/src/app/customer/reservations/page.tsx:1`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `CustomerDashboardPage` | Function | `apps/web/src/app/customer/dashboard/page.tsx` | 1 |
| `CustomerFacilitiesPage` | Function | `apps/web/src/app/customer/facilities/page.tsx` | 1 |
| `ReservationDetailPage` | Function | `apps/web/src/app/customer/reservations/[reservationId]/page.tsx` | 1 |
| `NewReservationPage` | Function | `apps/web/src/app/customer/reservations/new/page.tsx` | 1 |
| `ReservationsPage` | Function | `apps/web/src/app/customer/reservations/page.tsx` | 1 |
| `ManagerDashboardPage` | Function | `apps/web/src/app/facility-manager/dashboard/page.tsx` | 1 |
| `ForbiddenPage` | Function | `apps/web/src/app/forbidden/page.tsx` | 8 |
| `NotFound` | Function | `apps/web/src/app/not-found.tsx` | 4 |
| `OperationsDashboardPage` | Function | `apps/web/src/app/operations/dashboard/page.tsx` | 1 |
| `PublicReservationPage` | Function | `apps/web/src/app/reservations/new/page.tsx` | 4 |
| `StaffDashboardPage` | Function | `apps/web/src/app/staff/dashboard/page.tsx` | 1 |
| `SystemAdminDashboardPage` | Function | `apps/web/src/app/system-admin/dashboard/page.tsx` | 1 |
| `Button` | Function | `apps/web/src/components/ui/button.tsx` | 26 |
| `buttonClassName` | Function | `apps/web/src/components/ui/button.tsx` | 16 |
| `Card` | Function | `apps/web/src/components/ui/display.tsx` | 4 |
| `Currency` | Function | `apps/web/src/components/ui/display.tsx` | 17 |
| `PageHeader` | Function | `apps/web/src/components/ui/display.tsx` | 46 |
| `StatusBadge` | Function | `apps/web/src/components/ui/display.tsx` | 21 |
| `Select` | Function | `apps/web/src/components/ui/form-controls.tsx` | 37 |
| `EmptyState` | Function | `apps/web/src/components/ui/states.tsx` | 17 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReservationDetailPage → Cn` | intra_community | 7 |
| `ReservationsPage → Cn` | intra_community | 7 |
| `ManagerDashboardPage → Cn` | intra_community | 7 |
| `OperationsDashboardPage → Cn` | intra_community | 7 |
| `StaffDashboardPage → Cn` | intra_community | 7 |
| `SystemAdminDashboardPage → Cn` | intra_community | 7 |
| `CustomerDashboardPage → Cn` | intra_community | 6 |
| `FacilityDetailPage → Cn` | cross_community | 6 |
| `CustomerFacilitiesPage → List` | intra_community | 5 |
| `ReservationDetailPage → Detail` | intra_community | 5 |

## How to Explore

1. `context({name: "CustomerDashboardPage"})` — see callers and callees
2. `query({search_query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
