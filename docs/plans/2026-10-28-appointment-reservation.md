# Appointment and Reservation Implementation Plan

**Goal:** Provide authenticated create, list, detail, and update APIs for reservations and appointments.

**Architecture:** Each module owns its validation, service rules, and persistence. The new APIs use the existing schema and facility assignment authorization. Existing workflows in other modules are deferred to the next phase.

**Tech Stack:** Fastify, Zod, Drizzle, PostgreSQL, Bun.

---

1. Add shared request schemas for both modules and validate dates, input fields, and filters.
2. Implement reservation persistence and service rules for customer ownership, facility access, price snapshots, and draft edits.
3. Implement appointment persistence and service rules for customer ownership, facility access, linked records, staff assignment, and status transitions.
4. Register the new routes and remove the booking module. Existing cross-module imports remain for the next phase.
5. Run targeted type and behavior checks; report existing failures in deferred modules.
