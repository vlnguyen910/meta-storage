---
name: metastorage-mobile-quality
description: Audit and improve metastorage mobile web and React Native UI for viewport behavior, touch targets, accessibility, and repeatable device/viewport tests.
metadata:
  category: mobile
  source: Front-End-Checklist-2.0
---

# metastorage mobile quality

Use this skill for `apps/mobile` screens and mobile web breakpoints in `apps/web`.

## Workflow

1. Inspect the affected screen, navigation, form state, API hook, and test configuration.
2. Test at 375×667, 390×844, 430×932, 768×1024, portrait and landscape.
3. Verify no horizontal overflow, safe-area issues, keyboard-covered inputs, hover-only behavior, or clipped primary actions.
4. Keep interactive targets at least 44×44 CSS pixels where practical; never shrink icon actions below the WCAG minimum without spacing justification.
5. Run axe on critical web routes and screenshot baselines through Playwright mobile projects.
6. For React Native, verify keyboard avoidance, platform-specific navigation, loading/error/empty states, and API-client contracts on both iOS and Android targets when available.

## Boundaries

- Do not disable zoom or lock orientation unless the activity is genuinely orientation-essential.
- Do not treat desktop emulation as proof of real-device behavior; record real-device gaps separately.
- Do not use visual snapshot thresholds to hide layout regressions.
- Keep mobile fixes within the affected screen/components; avoid broad design-system changes without evidence.

## References

- [mobile-testing.md](references/mobile-testing.md)
- [touch-targets.md](references/touch-targets.md)
- [viewport-and-orientation.md](references/viewport-and-orientation.md)
