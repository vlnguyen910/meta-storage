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

## 3. Engineering Rules for Agents

Apply the rules relevant to the workspace and task. Keep implementation aligned with the existing architecture and confirmed requirements.

### 3.1 General

1. **Keep It Simple**: Prefer readable, maintainable solutions. Avoid speculative abstractions, layers, and dependencies.
2. **Follow Project Architecture**: Preserve the monorepo and modular monolith. Organize by feature; keep business logic out of routes, screens, and UI components.
3. **Centralize User-facing Messages**: Store feature messages in nearby `*.messages.ts` files; do not hard-code them in application code or create a global message registry. This excludes logs, comments, and test fixtures.
4. **Prefer Composition**: Prefer function/component composition over complex inheritance.

### 3.2 Backend and Database

5. **Database Schema and Migrations**: Follow `docs/db-diagram.md`; update it with `packages/database` schema changes. Generate migrations with `bun run db:generate`; never edit generated migrations directly. Clarify missing domain decisions before implementation.
6. **Drizzle Conventions**: Prefer the query builder; use parameterized `sql` only when needed. The client and Drizzle Kit use `casing: "snake_case"`, so declare properties in camelCase and omit redundant physical column names. Preserve existing database names and verify migrations do not rename columns. Declare PostgreSQL enum values as TypeScript `enum`s in the database schema and pass them through `enumToPgEnum` when calling `pgEnum`, following `packages/database/src/schema/inspections.ts`; do not declare them in contracts or define PostgreSQL enums from value arrays.
7. **Backend Boundaries**: Keep workflow coordination in services, persistence in repositories, and isolate external providers behind adapters. Avoid generic repository abstractions without a concrete use case.

### 3.3 Web Frontend

8. **State Separation**: Use TanStack Query for server state, Zustand when client state needs sharing, and React Hook Form + Zod for forms.
9. **API Requests**: Use the centralized API client; do not make scattered requests from UI components.

### 3.4 Mobile

10. **Screen/Hook/API Flow**: Keep screens focused on UI, workflow logic in feature hooks/services, and backend calls in the centralized API client.

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
- **Meaningful names**: Choose specific, searchable names that express intent in context. Avoid unclear abbreviations, type prefixes, misleading collection names, and vague names such as `data` or `temp` when they obscure meaning. Use the same term for the same domain concept. Name functions with verbs and classes with nouns; name constants for their meaning instead of using unexplained literals. Names need only be as long as clarity requires; short loop variables are acceptable when their purpose is obvious.
- **Contracts**: Always use shared types/schemas (`packages/contracts` or `@metastorage/shared`).

## 6. Commit & Git Hook Guidelines

- **Husky Pre-commit**: Automatically runs `biome check --staged` on staged files.
- **Conventional Commits**: Format `<type>: <imperative summary>` (e.g., `feat: add booking state machine`, `fix: resolve payment webhook race condition`).
