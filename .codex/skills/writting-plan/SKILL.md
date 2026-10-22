---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `apps/web/src/features/example/double.ts`
- Test: `apps/web/src/features/example/double.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, it } from "vitest";
import { double } from "./double";

it("doubles a number", () => {
  expect(double(2)).toBe(4);
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter web test -- src/features/example/double.test.ts`
Expected: FAIL because `./double` does not exist yet

**Step 3: Write minimal implementation**

```typescript
export function double(value: number): number {
  return value * 2;
}
```

**Step 4: Run test to verify it passes**

Run: `bun run --filter web test -- src/features/example/double.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/features/example/double.test.ts apps/web/src/features/example/double.ts
git commit -m "feat: add specific feature"
```
````

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Notify to user**
