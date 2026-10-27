# Development Early Check-in Implementation Plan

**Goal:** Permit immediate check-in of paid, assigned bookings before their appointment only in development.

**Architecture:** Keep the eligibility policy pure and pass the server environment's permission through the existing check-in service. Keep production/test strict by default. Expose the same server-owned permission in booking list DTOs so the existing web readiness display agrees with the API; do not alter booking dates, pricing, payments, deadlines or handover requirements.

**Tech Stack:** Fastify, TypeScript, shared Zod contracts, PostgreSQL/Drizzle, Bun test, Next.js/Playwright.

---

1. Review policy callers, handover guards and list readiness. Run GitNexus impact; shared eligibility is HIGH risk, while route registrations require literal-reference confirmation.
2. Add failing policy cases for early check-in, unchanged non-time blockers and unchanged deadline/configuration checks. Add isolated API regressions proving development/develop allow early lookup/confirm, production/test reject it, and request data cannot enable the exception.
3. Add a default-false early-check-in argument to the policy/service and set it from validated server `NODE_ENV` in route wiring. Include the same permission in facility/staff list responses and have readiness respect it.
4. Run focused policy/API tests and relevant existing booking/handover regressions, type checks, lint and builds. Inspect the future-booking check-in flow in a browser against an isolated development API.
5. Document `NODE_ENV=development`/`develop`, remaining preconditions, and unchanged production behavior. No schema migration, new seed command or changes to shared local booking data.

## Verification

- Check-in policy/API integration: 5 passed across production, test, development and develop; payment, assignment, authentication and staff ownership remain enforced.
- Web flow: logged into an isolated API, confirmed an assigned future-date booking, and reached the inspection screen; screenshot inspected.
- `bun run check` and `bun run build` passed. Existing booking/handover database regression suites were not run in this pass.
