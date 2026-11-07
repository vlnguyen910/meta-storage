---
name: metastorage-frontend-quality
description: Audit and improve metastorage web UI for accessibility, responsive visual quality, and regression safety using the local frontend checklist, axe, and Playwright screenshots.
metadata:
  category: frontend
  source: Front-End-Checklist-2.0
---

# metastorage frontend quality

Use this skill for UI changes, customer flows, reservation screens, and visual/accessibility regressions.

## Workflow

1. Inspect the affected route and shared UI primitives before editing.
2. Apply the local frontend checklist conservatively: labels, keyboard focus, semantic structure, error states, responsive layout, reduced motion, image dimensions/alt text, and visible loading states.
3. Add or update Playwright tests for the affected flow.
4. Run axe against the route at desktop and mobile sizes.
5. Use Playwright screenshot baselines for high-risk pages and interactive states. Mask timestamps and other dynamic content.
6. Run `bun run --filter web check-types`, `bun run --filter web test`, `bun run --filter web test:e2e`, and `bun run build` as appropriate.

## Boundaries

- Do not hide real accessibility violations with broad axe exclusions.
- Do not change domain/API behavior while doing a visual polish unless the UI cannot function without it.
- Keep visual snapshots deterministic; mask dynamic data instead of increasing pixel thresholds unnecessarily.
- Check keyboard navigation and focus-visible behavior manually for critical flows; automated axe is not a substitute for manual testing.

## References

- [accessibility-testing.md](references/accessibility-testing.md)
- [visual-regression.md](references/visual-regression.md)
- [frontend-checklist-global.md](references/frontend-checklist-global.md)
