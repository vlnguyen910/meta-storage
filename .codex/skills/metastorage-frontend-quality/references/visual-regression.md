# Visual regression testing

Use Playwright `toHaveScreenshot` for stable route states. Baselines should cover:

- customer dashboard;
- reservation wizard facility/unit/form states;
- My Storage list and detail;
- loading, empty, error, and selected-card states where practical.

Mask timestamps, user-specific values, and network-dependent content. Use a small `maxDiffPixelRatio` (default 1%) and update snapshots only after intentional visual review.
