# Issue #190 — Customer Rental Flow Implementation Plan

**Goal:** Complete customer rental flows against the real backend on Web and Android.

**Architecture:** Deliver business slices across contracts, Fastify Route → Service → Repository, Web and Mobile. Reuse shared API client, TanStack Query and React Hook Form + Zod. Preserve existing pricing, capacity locks, payment lifecycle and return workflows.

**Tech Stack:** Next.js, React Native/Expo, Fastify, Drizzle/PostgreSQL, Better Auth, SePay, Playwright.

## Approved decisions

- Keep `/customer/reservations/*` URLs, consume Booking DTOs.
- Dashboard shows recent bookings/current rentals/appointments; no financial totals or fabricated counts.
- Public availability reads one unit type over a complete rental period using draft input, returning period/count/asOf. Reads create no holds.
- Customer booking detail adds nullable rental ID and confirmation; ownership is enforced server-side.
- Separate owner-only support context and payment-attempt discovery, including DRAFT/failed-payment contexts for PAYMENT.
- Native customer API workspace remains separate from demo. Forward Better Auth cookies; scope private cache to account and clear on logout.
- Payment returns through existing Web result routes. A user-initiated `metastorage://payment-result` link contains IDs only; Mobile verifies payment with the API.
- Add Expo image-picker/file-system/sharing for authenticated image/PDF workflows.
- Android and a controlled real SePay transaction are required acceptance evidence; record iOS gaps explicitly.

## Delivery slices

1. Real API Mobile shell/session and catalog/period availability.
2. Booking draft/pay/status, idempotent retry and payment-return recovery.
3. Non-financial dashboard, paginated bookings, QR/appointment/handover/rental link.
4. Multiple rentals/current/history, private documents, source-aware payment/refund history; preserve returns.
5. Renewal quote/accept/pay/APPLIED and charge list/pay/dispute sections in rental detail.
6. Support list/create/detail/public replies/private images and context discovery on both platforms.

## Acceptance

- Real PostgreSQL integration: period validation, holds, overlaps/boundaries, assignment dedupe, capacity concurrency and owner/privacy checks.
- Real API Web E2E: catalog through handover/rental, multiple pages, renewals/charges/support; no interception of the happy path.
- Android: persisted session, restart/network/background recovery, payment callback, image picker and PDF sharing.
- Retry/replay/concurrent payments never duplicate obligations or apply renewal twice. Paid is not equivalent to APPLIED.
- Type/lint/relevant regression checks, zero skipped required DB cases, browser/axe/viewport inspection after tests.
- GitNexus impact before edits, detect-changes before commit. Preserve CRITICAL capacity semantics.

## Boundaries and dependencies

No schema change planned. Follow #113/#120/#157/#158, #127/#139/#180, #161–#166 and approved financial/support documents. #166 operations handoff is a separate two-way support blocker if missing. Do not invent financial TBDs, renewal exceptions #174 or policies #181–#184. Record provider/device evidence separately from test adapters; never claim unperformed acceptance.
