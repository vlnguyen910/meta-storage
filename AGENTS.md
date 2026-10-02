# Repository Guidelines & Architecture Summary

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
23. **Post-test UI Verification**: After running tests, inspect the affected UI in a browser for visual bugs, broken interactions, and flows that get stuck. Check navigation, form validation, error messages, and loading states throughout the affected flow. Fix discovered issues and repeat the relevant tests and UI checks before reporting completion; passing automated tests alone does not confirm that the UI works correctly. Playwright is available and may be used for this verification when appropriate.

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **storeX** (1580 symbols, 3331 relationships, 122 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/storeX/context` | Codebase overview, check index freshness |
| `gitnexus://repo/storeX/clusters` | All functional areas |
| `gitnexus://repo/storeX/processes` | All execution flows |
| `gitnexus://repo/storeX/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |
| Work in the Dashboard area (52 symbols) | `.claude/skills/gitnexus-area-dashboard/SKILL.md` |
| Work in the Facilities area (45 symbols) | `.claude/skills/gitnexus-area-facilities/SKILL.md` |
| Work in the Reservations area (18 symbols) | `.claude/skills/gitnexus-area-reservations/SKILL.md` |
| Work in the Ui area (14 symbols) | `.claude/skills/gitnexus-area-ui/SKILL.md` |
| Work in the Users area (13 symbols) | `.claude/skills/gitnexus-area-users/SKILL.md` |
| Work in the Catalog area (13 symbols) | `.claude/skills/gitnexus-area-catalog/SKILL.md` |
| Work in the Handlers area (13 symbols) | `.claude/skills/gitnexus-area-handlers/SKILL.md` |
| Work in the Layout area (9 symbols) | `.claude/skills/gitnexus-area-layout/SKILL.md` |
| Work in the Mocks area (7 symbols) | `.claude/skills/gitnexus-area-mocks/SKILL.md` |
| Work in the App area (6 symbols) | `.claude/skills/gitnexus-area-app/SKILL.md` |
| Work in the Auth area (6 symbols) | `.claude/skills/gitnexus-area-auth/SKILL.md` |
| Work in the Dashboards area (5 symbols) | `.claude/skills/gitnexus-area-dashboards/SKILL.md` |
| Work in the Errors area (4 symbols) | `.claude/skills/gitnexus-area-errors/SKILL.md` |
| Work in the Cluster_29 area (4 symbols) | `.claude/skills/gitnexus-area-cluster-29/SKILL.md` |
| Work in the Cluster_28 area (3 symbols) | `.claude/skills/gitnexus-area-cluster-28/SKILL.md` |

<!-- gitnexus:end -->
