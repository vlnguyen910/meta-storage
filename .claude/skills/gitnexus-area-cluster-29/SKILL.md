---
name: gitnexus-area-cluster-29
description: "Skill for the Cluster_29 area of metastorage. 4 symbols across 1 files."
---

# Cluster_29

4 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `packages/`
- Understanding how findApiEnvPath, getDatabaseUrl, getDockerComposeUrl work
- Modifying cluster_29-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/database/src/env.ts` | findApiEnvPath, getDatabaseUrl, getDockerComposeUrl, loadApiEnv |

## Entry Points

Start here when exploring this area:

- **`findApiEnvPath`** (Function) — `packages/database/src/env.ts:10`
- **`getDatabaseUrl`** (Function) — `packages/database/src/env.ts:48`
- **`getDockerComposeUrl`** (Function) — `packages/database/src/env.ts:6`
- **`loadApiEnv`** (Function) — `packages/database/src/env.ts:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `findApiEnvPath` | Function | `packages/database/src/env.ts` | 10 |
| `getDatabaseUrl` | Function | `packages/database/src/env.ts` | 48 |
| `getDockerComposeUrl` | Function | `packages/database/src/env.ts` | 6 |
| `loadApiEnv` | Function | `packages/database/src/env.ts` | 31 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GetDatabaseUrl → FindApiEnvPath` | intra_community | 3 |

## How to Explore

1. `context({name: "findApiEnvPath"})` — see callers and callees
2. `query({search_query: "cluster_29"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
