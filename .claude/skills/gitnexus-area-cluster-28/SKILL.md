---
name: gitnexus-area-cluster-28
description: "Skill for the Cluster_28 area of metastorage. 3 symbols across 1 files."
---

# Cluster_28

3 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `packages/`
- Understanding how login, me, toSession work
- Modifying cluster_28-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/api-client/src/index.ts` | login, me, toSession |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `login` | Function | `packages/api-client/src/index.ts` | 123 |
| `me` | Function | `packages/api-client/src/index.ts` | 137 |
| `toSession` | Function | `packages/api-client/src/index.ts` | 105 |

## How to Explore

1. `context({name: "login"})` — see callers and callees
2. `query({search_query: "cluster_28"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
