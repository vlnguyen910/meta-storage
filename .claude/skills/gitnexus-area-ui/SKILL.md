---
name: gitnexus-area-ui
description: "Skill for the Ui area of metastorage. 14 symbols across 13 files."
---

# Ui

14 symbols | 13 files | Cohesion: 71%

## When to Use

- Working with code in `apps/`
- Understanding how FacilityDetailPage, FacilitiesPage, ForgotPasswordPage work
- Modifying ui-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/ui/form-controls.tsx` | FieldShell, Input |
| `apps/web/src/app/facilities/[facilityId]/page.tsx` | FacilityDetailPage |
| `apps/web/src/app/facilities/page.tsx` | FacilitiesPage |
| `apps/web/src/app/forgot-password/page.tsx` | ForgotPasswordPage |
| `apps/web/src/app/login/page.tsx` | LoginPage |
| `apps/web/src/app/page.tsx` | HomePage |
| `apps/web/src/app/system-admin/users/page.tsx` | SystemAdministratorUsersPage |
| `apps/web/src/components/layout/public-header.tsx` | PublicHeader |
| `apps/web/src/components/layout/public-layout.tsx` | PublicLayout |
| `apps/web/src/components/ui/toast.tsx` | useToast |

## Entry Points

Start here when exploring this area:

- **`FacilityDetailPage`** (Function) — `apps/web/src/app/facilities/[facilityId]/page.tsx:3`
- **`FacilitiesPage`** (Function) — `apps/web/src/app/facilities/page.tsx:5`
- **`ForgotPasswordPage`** (Function) — `apps/web/src/app/forgot-password/page.tsx:2`
- **`LoginPage`** (Function) — `apps/web/src/app/login/page.tsx:4`
- **`HomePage`** (Function) — `apps/web/src/app/page.tsx:20`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `FacilityDetailPage` | Function | `apps/web/src/app/facilities/[facilityId]/page.tsx` | 3 |
| `FacilitiesPage` | Function | `apps/web/src/app/facilities/page.tsx` | 5 |
| `ForgotPasswordPage` | Function | `apps/web/src/app/forgot-password/page.tsx` | 2 |
| `LoginPage` | Function | `apps/web/src/app/login/page.tsx` | 4 |
| `HomePage` | Function | `apps/web/src/app/page.tsx` | 20 |
| `SystemAdministratorUsersPage` | Function | `apps/web/src/app/system-admin/users/page.tsx` | 2 |
| `PublicHeader` | Function | `apps/web/src/components/layout/public-header.tsx` | 8 |
| `PublicLayout` | Function | `apps/web/src/components/layout/public-layout.tsx` | 3 |
| `FieldShell` | Function | `apps/web/src/components/ui/form-controls.tsx` | 10 |
| `Input` | Function | `apps/web/src/components/ui/form-controls.tsx` | 22 |
| `useToast` | Function | `apps/web/src/components/ui/toast.tsx` | 60 |
| `ForgotPasswordForm` | Function | `apps/web/src/features/auth/forgot-password-form.tsx` | 15 |
| `LoginForm` | Function | `apps/web/src/features/auth/login-form.tsx` | 24 |
| `SystemAdministratorUsersScreen` | Function | `apps/web/src/modules/system-administrator/users/system-administrator-users-screen.tsx` | 19 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `FacilityDetailPage → Cn` | cross_community | 6 |
| `CustomerFacilitiesPage → Cn` | cross_community | 5 |
| `ForgotPasswordPage → Cn` | cross_community | 5 |
| `LoginPage → Cn` | cross_community | 5 |
| `NewReservationPage → UseToast` | cross_community | 4 |
| `FacilityDetailPage → UnitTypes` | cross_community | 4 |
| `FacilityDetailPage → Detail` | cross_community | 4 |
| `FacilitiesPage → List` | cross_community | 4 |
| `FacilitiesPage → Cn` | cross_community | 4 |
| `FacilityDetailPage → PublicHeader` | intra_community | 3 |

## How to Explore

1. `context({name: "FacilityDetailPage"})` — see callers and callees
2. `query({search_query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
