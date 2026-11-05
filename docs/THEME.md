# Mobile UI foundation

Mobile uses the existing web palette as its reference. Web files are unchanged.
`src/theme/tokens.css` owns the mobile theme; it is imported after Nativewind's theme in
`global.css`. It does not import browser resets or assets from the web app at runtime.

## Tokens

- Brand: `primary`, `primary-dark`, `primary-soft`, `primary-foreground`, `secondary`, `accent`.
- Content: `canvas`, `surface`, `ink`, `muted`, `line`, `outline-variant`, `ring`.
- Feedback: `success`, `warning-strong`, `danger-strong`, `info`, with soft surfaces and borders.
  `danger` and `warning` preserve the web values; the strong variants provide readable text and
  filled destructive actions.
- Shape: `rounded-card` (15px), `rounded-control` (12px, matching the current web Button).
- Sizing: `min-h-control` (48px), `min-h-touch` / `min-w-touch` (44px), `p-card` (20px).
- Typography: `text-body` (16px), `text-label` (14px), `text-title` (24px).

Be Vietnam Pro font files were copied from the existing web assets and are loaded locally by
`expo-font` in `App.tsx`. Use `font-body`, `font-body-medium`, `font-body-semibold`, or
`font-body-bold`; native font weights use separate files. The theme stays light, matching the
current app configuration and web reference.

## Shared components

```tsx
import { Button, Card, Field, Notice } from "./src/components/ui/mobile-ui";

<Card title="Thông tin đặt kho">
  <Field label="Họ và tên" value={name} onChangeText={setName} error={error} />
  <Button label="Đặt kho" loading={pending} onPress={submit} />
  <Button variant="outline" label="Xem chi tiết" onPress={openDetail} />
  <Button variant="danger" label="Hủy đặt kho" onPress={cancel} />
</Card>
<Notice error>{message}</Notice>
```

`Button` supports `primary` (default), `secondary`, `outline`, `ghost`, and `danger` variants.
Loading disables activation and exposes a busy state while preserving the label. Existing
`secondary` and `danger` booleans remain supported; `secondary` keeps the previous outline
appearance. An explicit `variant` takes precedence.

`ChoiceTabs`, `CalendarField`, `WorkspaceHeader`, `WorkspaceTabs`, `StatusPill`, `Heading`, and
`Row` also consume these tokens. Shared navigation uses Lucide icons with the same visual family
as web. `native-styles.tsx` maps CSS colors to native input/spinner props.

This change establishes shared components first. Screen-specific styles and custom auth controls
can migrate to them incrementally. Reuse the components rather than copying their classes.

## Verification

Run from the repository root:

```bash
bun run --filter mobile check-types
bun run --filter mobile test
bun run --filter mobile test:e2e
```

Playwright uses a standalone Metro fixture, without adding a product route or requiring API data.
It checks 375×667, 390×844, 430×932, and 768×1024 in both orientations, component interactions,
font/color application, touch sizes, overflow, and axe WCAG A/AA checks. Chromium must be installed
for Playwright. These browser checks do not replace Android/iOS device testing for font rendering,
safe areas, screen readers, and the on-screen keyboard.
