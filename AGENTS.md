# Repository Guidelines & Architecture Summary

## Project Context

Read [`README.md`](README.md) first for the project overview, workspace layout, stack, and local setup. Use the domain-specific documents listed below when a task needs deeper business or architecture details.

## User's Coding Preferences

Apply these preferences when refactoring or adding backend features:

- Prefer the smallest implementation that fully supports the confirmed workflow. Keep APIs and layers only when they serve a concrete use case.
- Keep endpoints focused on business actions. Avoid CRUD or separate lifecycle endpoints when one validated update endpoint expresses the required operation clearly.
- Let the backend derive identity and facility scope from the authenticated session and active assignments when available; do not require redundant frontend parameters.
- Put workflow coordination and cross-module calls in services. Keep repositories focused on database reads/writes and transaction-specific persistence.
- Reuse the facility-assignment authorization service, shared pagination DTOs, and Zod schemas instead of adding parallel checks or mapping helpers.
- Model task references with one reference ID and an explicit reference type when the supported contexts share the same workflow. Do not add fields such as task version or completion actor without a confirmed need.
- Reduce tables only when their data and lifecycle are truly redundant. Preserve records needed for distinct workflows, financial facts, audit, or history; update the schema and database diagram together for approved changes.
- Prefer readable code over extra abstraction. Do not split a module solely because a file is long; split along distinct business responsibilities when that makes workflows easier to follow.
- For behavior-preserving refactors, keep API contracts and transaction boundaries stable, especially when one workflow creates or updates records across modules.

See [`docs/module-refactor-priorities.md`](docs/module-refactor-priorities.md) for the current module review order and proposed refactor scope.

## 1. Project Structure & Architecture

```text
metastorage/
├── apps/
│   ├── web/          # Next.js (Web Frontend)
│   ├── mobile/       # React Native + Expo
│   ├── api/          # Fastify + Node.js (Modular Monolith Backend)
│   └── worker/       # BullMQ worker (Background jobs)
├── packages/
│   ├── database/     # PostgreSQL + Drizzle ORM
│   ├── contracts/    # Shared API schemas/types (Zod/TS)
│   ├── api-client/   # Shared API client for Web & Mobile
│   ├── config/       # Shared configurations (TSConfig, Biome)
│   └── shared/       # Shared constants and utilities
└── docs/             # Specific architecture & pattern documentation
```

Architecture overview:

```text
Web ───────┐
           │
Mobile ────┼── REST API ── Fastify Modular Monolith
           │                    │
           │                    ├── PostgreSQL (Drizzle)
           │                    └── Redis / BullMQ
           │
           └──────────────────────── Worker
```

Project architecture: **Monorepo (Turborepo + Bun) + Modular Monolith**. Scope constraints: 4 developers, 10 weeks. No Microservices, no Event Sourcing.

## 2. On-Demand Documentation (`docs/`)

> [!IMPORTANT]
> To preserve context, AI agents should **ONLY** read the following documents when the task specifically requires detailed context on that domain:
>
> - [`docs/db-diagram.md`](file:///home/owen/Projects/storeX/docs/db-diagram.md): Canonical source of truth for database schema design, entities, relationships, and constraints. Read it for any database schema or migration task.
> - [`docs/backend-patterns.md`](file:///home/owen/Projects/storeX/docs/backend-patterns.md): Route → Service → Repository, State Machines, Strategy/Adapter patterns, Transactions & Idempotency.
> - [`docs/web-patterns.md`](file:///home/owen/Projects/storeX/docs/web-patterns.md): Next.js App Router, Feature-based structure, Server/Client/Form state separation, TanStack Query, Zustand.
> - [`docs/mobile-patterns.md`](file:///home/owen/Projects/storeX/docs/mobile-patterns.md): React Native + Expo structure, Screen → Hook → API Client flow.

## 3. Core Engineering Rules for Agents

These rules consolidate the project's engineering principles and agent-specific implementation requirements.

1. **Simple & Maintainable**: Keep the architecture and implementation simple, readable, testable, and easy to hand over.
2. **No Overengineering**: Do not design for needs that do not exist or add unnecessary layers, abstractions, or infrastructure.
3. **Follow the Architecture**: Keep the Monorepo + Modular Monolith architecture. Do not introduce unapproved patterns, layers, Microservices, or Event Sourcing.
4. **Feature-based Slices**: Organize code by feature/domain. Never put business logic in routes, screens, or UI components.
5. **Strict State Separation**: Manage server state with TanStack Query, client state with Zustand when necessary, and form state with React Hook Form + Zod.
6. **Database as Single Source of Truth**: Treat the database as the source of truth for business data. Never expose database models directly to the frontend; use API contracts/DTOs.
7. **Transactional Consistency**: Use database transactions for consistency-critical workflows and row-level locking when required to prevent race conditions.
8. **Database Diagram & Schema-first Migrations**: Treat [`docs/db-diagram.md`](file:///home/owen/Projects/storeX/docs/db-diagram.md) as the source of truth for the intended database model. Before designing or changing database schema, read and follow the diagram. For every database change, update the diagram and the Drizzle schema in `packages/database` together so they stay in sync; generate migrations with `bun run db:generate`. Never edit generated migration files directly (`packages/database/drizzle/*`). If the diagram is missing details needed for a change, clarify and update the diagram before implementing the schema.
9. **External Service Adapters**: Isolate external services behind adapters/interfaces so the core business logic does not depend directly on providers.
10. **Explicit State Transitions**: Model complex lifecycles with explicit State Machines. Do not update business status arbitrarily outside defined transitions.
11. **Centralized API Client**: Web and Mobile must call the backend through the centralized API client rather than making scattered direct requests.
12. **Practical Shared Abstractions**: Create shared packages or abstractions only when they are genuinely reused in at least two places.
13. **No Generic Repository Overuse**: Avoid generic repository or multi-layer abstractions that make the code harder to understand and debug.
14. **Prefer Composition**: Prefer component/function composition over complex inheritance hierarchies.
15. **Limit New Dependencies**: Do not add a framework, library, or infrastructure when the existing stack already solves the problem.
16. **Business Clarity & Confidence Threshold (< 95%)**: Always verify domain requirements with the user before implementing features. If confidence in implementing exact business rules is below 95%, ask clarifying questions instead of making assumptions. Never speculate; mark unknowns as `TBD`.
17. **Related-Issue Consistency**: Before implementation, review related, dependent, and potentially conflicting issues and existing domain decisions. Keep shared schemas, APIs, workflows, and data models compatible across those issues; do not optimize a single issue in isolation.
18. **Propose Decisions Before Implementation**: Present design choices, trade-offs, alternatives, and further decisions for the user to review and align on before beginning implementation.
19. **Focused, Business-driven Testing**: Add and run tests only when they provide meaningful confidence in the behavior affected by the change. For backend work, prioritize integration tests covering the relevant route/service/database flow, including authorization, persistence, constraints, and transactions when applicable; use an isolated test database when correctness depends on database behavior. For frontend work, prioritize end-to-end tests covering the affected user flow. Add unit tests only for complex business logic that benefits from isolated verification, such as state transitions, pricing calculations, or policy decisions with many branches. Do not add unit tests for simple CRUD, pass-through methods, straightforward mapping, or tests that merely mirror the implementation. Before creating tests, clarify unresolved business requirements and planned cases; reuse decisions already confirmed in the session and do not invent behavior. For structural refactors that preserve behavior, prefer existing relevant tests, type checks, lint, and contract compatibility checks rather than creating redundant tests or running unrelated suites.
20. **Team and Time Constraints**: Keep technical choices feasible for a team of four developers working within ten weeks.
21. **Centralized User-facing Messages**: Do not hard-code user-facing success, response, validation, or error messages inline in routes, services, repositories, UI components, hooks, or schemas. Put them in a feature/module-scoped `*.messages.ts` constants file and reference those constants. Use small message-builder functions for dynamic values. Keep messages close to their owning feature; do not create a catch-all global message registry. This rule does not apply to logs, comments, test fixtures, or protocol/framework-required strings that are not presented to users or API clients.
22. **Dedicated TypeScript Interfaces**: Do not declare project `interface`s in business, route, screen, component, hook, or other implementation files. Move each interface to an adjacent dedicated `*.types.ts`, `types.ts`, or `*.interface.ts` file that matches its feature or adapter boundary. Keep unrelated interfaces out of shared type files; use declaration files such as `*.d.ts` only when TypeScript module augmentation or declaration merging requires them.
23. **Drizzle Query Builder First**: Use Drizzle query builder as the default for database queries, including selects, joins, filters, CTEs, unions, and grouping. Use Drizzle's parameterized `sql` template only for expressions without a suitable Drizzle helper, or when SQL provides a concrete query/data-processing optimization that the query builder cannot reasonably express, such as reducing database round trips or avoiding unnecessary data transfer to the application. Keep SQL fragments as small as practical; use a full SQL statement only when necessary and explain the specific benefit in a nearby comment. Do not assume raw SQL is faster without justification. Reference Drizzle schema tables/columns and parameterize values; never concatenate user input into SQL.

## 4. Build, Lint, and Development Commands

Run all commands from repository root with Bun:

```bash
bun install                         # Install workspace dependencies
bun run dev                         # Run all workspaces in dev mode
bun run --filter web dev             # Run only Web (port 3000)
bun run --filter api dev             # Run only API (port 4000)
bun run --filter mobile dev         # Run only Mobile (Expo dev server)
bun run db:generate                 # Generate Drizzle SQL migrations
bun run db:migrate                  # Run Drizzle SQL migrations
bun run test                        # Run unit and integration tests across workspaces
bun run build                        # Build all workspaces with Turborepo
bun run check-types                  # Type-check all packages
bun run check                        # Run Biome lint & format checks
bun run check:fix                    # Apply Biome auto-fixes
```

## 5. Coding Style & Conventions

- **TypeScript**: Strict mode across all packages.
- **Formatting & Linting**: Biome is the source of truth (2 spaces, double quotes, semicolons, 100 max line length). Run `bun run check:fix` before committing.
- **Naming**: PascalCase for components/types, camelCase for functions/variables, kebab-case for route and config filenames.
- **Contracts**: Always use shared types/schemas (`packages/contracts` or `@metastorage/shared`).

## 6. Commit & Git Hook Guidelines

- **Husky Pre-commit**: Automatically runs `biome check --staged` on staged files.
- **Conventional Commits**: Format `<type>: <imperative summary>` (e.g., `feat: add booking state machine`, `fix: resolve payment webhook race condition`).
