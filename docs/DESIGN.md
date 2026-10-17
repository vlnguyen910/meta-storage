---
version: alpha
name: MetaStorage Design System
colors:
  primary: "#165F4D"
  primary-dark: "#0F493B"
  primary-soft: "#E8F3EF"
  secondary: "#64748B"
  accent: "#107012"
  accent-soft: "#E9F6E9"
  canvas: "#FAFAFA"
  surface: "#FFFFFF"
  ink: "#0F172A"
  muted: "#64748B"
  line: "#EEEEEE"
  ring: "#94A3B8"
  danger: "#EF4444"
  warning: "#D97706"
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.035em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.025em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.05em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  card: 15px
  xl: 16px
  full: 9999px
spacing:
  2xs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  card-standard:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 24px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 44px
  badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.ink}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  badge-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ink}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  table-cell-muted:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  focus-ring:
    backgroundColor: "{colors.ring}"
---

# StoreX Visual Identity & Design System Specification

## Overview

StoreX is a modern self-storage management and rental platform built for individuals, families, and businesses in Vietnam. The visual identity reflects **security, reliability, architectural precision, and hospitality**.

- **Brand Personality**: Trustworthy, secure, crisp, and effortless. It avoids cold industrial warehouse aesthetics in favor of a warm, orderly, tech-enabled storage experience.
- **Visual Rhythm**: High legibility, clear containment with rounded cards (`15px`), ample white space, and an emerald-and-slate color palette inspired by institutional security and modern urban spaces.
- **Target Audience**: Self-storage renters (personal & business users needing seamless booking) and facility staff/managers conducting on-ground operations.

## Colors

The color palette centers on deep emerald green (`#165F4D`) and dark slate tones, supported by soft mint tints and neutral canvas surfaces.

- **Primary (`#165F4D`)**: The primary brand anchor. Used for primary call-to-action buttons, key brand headers, active navigation pills, and important focus states.
- **Primary Dark (`#0F493B`)**: Used for hover and active states of primary elements.
- **Primary Soft (`#E8F3EF`)**: Used for subtle container fills, selected row highlights, and active tab backgrounds.
- **Secondary (`#64748B`)**: Slate neutral for secondary actions, borders, table headers, and supporting metadata.
- **Accent (`#107012`) & Accent Soft (`#E9F6E9`)**: Energetic green for success states, confirmed booking tags, and positive metric indicators.
- **Canvas (`#FAFAFA`) & Surface (`#FFFFFF`)**: The background foundation. Canvas provides a low-contrast neutral backdrop, while surface white houses cards and interactive modals.
- **Ink (`#0F172A`) & Muted (`#64748B`)**: Ink provides high-contrast typography (`#0F172A`), meeting WCAG AA requirements on white and canvas surfaces. Muted text is reserved for secondary copy and captions.
- **Danger (`#EF4444`) & Warning (`#D97706`)**: Status alerts, payment expiry warnings, and cancellation notices.

## Typography

StoreX pairs two complementary typefaces to distinguish structured data from readable narrative:

- **Space Grotesk** (Headings, Metrics, Labels): A geometric sans-serif that evokes technical precision, warehouse unit numbering, and architectural layouts. Used for `h1` through `h3`, unit codes (e.g. `HCM-01`), and uppercase metric badges.
- **Be Vietnam Pro** / **Inter** (Body, Controls, Forms): An optimized grotesque sans-serif ensuring long-form readability, high legibility for Vietnamese diacritics, and clean data density in admin tables and booking summaries.

### Scale & Hierarchy
- **Display & Large Headlines (`display-lg`, `headline-lg`)**: Hero banners, facility titles, and public landing headers.
- **Section Headlines (`headline-md`, `headline-sm`)**: Card titles, modal headers, step progress titles.
- **Body (`body-lg`, `body-md`, `body-sm`)**: Descriptive text, form instructions, terms, and table data.
- **Labels (`label-lg`, `label-sm`)**: Button labels, badge indicators, uppercase tracking for status pills.

## Layout

StoreX uses a responsive **Fluid-to-Max-Width** grid system:

- **Container Width**: Max-width of `1280px` for desktop views with centered margins, ensuring optimal scan lines on wide displays.
- **Spacing Rhythm**: An 8px base rhythm (`4px` micro-step, `8px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Containment Principle**: Content is contained within clean card modules separated by `16px` to `24px` gaps, preventing visual clutter in complex operations (such as unit matrices and booking timelines).
- **Responsive Breakpoints**: Mobile (`< 640px`), Tablet (`640px - 1024px`), and Desktop (`> 1024px`). Mobile views transition multi-column layouts into unified vertical stacks with bottom-docked primary actions.

## Elevation & Depth

StoreX emphasizes **Tonal Layers & Soft Shadows** over heavy skeuomorphic drop shadows.

- **Layering**: Depth is created primarily through color contrast: `Canvas (#FAFAFA)` -> `Surface Card (#FFFFFF)` -> `Modal / Popover (#FFFFFF)`.
- **Card Shadow**: `-2px 4px 12px 4px rgba(51, 51, 51, 0.08)` provides subtle elevation without looking heavy.
- **Soft Ambient Shadow**: `0 8px 30px rgba(15, 23, 42, 0.07)` for floating action bars and dropdown menus.
- **Borders**: Subtle `1px` borders using `#EEEEEE` or `#E2E8F0` to clearly define card edges on high-DPI screens.

## Shapes

StoreX blends approachable modern curves with functional order:

- **Card Radius (`15px`)**: Standardized across all main dashboard cards, unit category previews, and reservation containers.
- **Button & Input Radius (`8px`)**: Interactive controls use `8px` (`rounded-md`) to feel tactile, clickable, and responsive.
- **Badges & Pills (`9999px`)**: Status badges (e.g., `ACTIVE`, `READY_FOR_CHECK_IN`, `TOO_EARLY`) use fully rounded pills for instant recognition.
- **Strict Consistency**: Do not mix sharp `0px` corners with rounded `15px` cards in the same viewport.

## Components

Core component patterns and behaviors across the application:

- **Primary Button**: Emerald background (`#165F4D`), white text, `44px` height, `8px` border radius, semi-bold font. Hover state transitions smoothly to `#0F493B`.
- **Secondary / Ghost Button**: White or transparent background with `#EEEEEE` border, `#0F172A` text, and `#F1F5F9` hover background.
- **Cards (`card-standard`)**: Surface white background, `15px` radius, `24px` padding, and soft card shadow.
- **Status Pills / Chips**: Contain an icon, uppercase `label-sm` Space Grotesk text, and contextual background (e.g. emerald tint for `Active`, amber tint for `Pending`, red tint for `Overdue`).
- **Form Inputs**: Height `44px`, `8px` radius, `1px` border (`#CBD5E1`), focusing with an emerald ring (`#165F4D`).

## Do's and Don'ts

### Do's
- **Do** maintain a strict 4.5:1 contrast ratio (WCAG AA) for all text against its background.
- **Do** reserve the primary emerald green (`#165F4D`) for primary calls to action (one primary action per visible section).
- **Do** format technical numbers, unit codes, prices, and metrics in **Space Grotesk**.
- **Do** use `15px` corner radius for all container cards and `8px` for inputs and buttons.
- **Do** provide clear empty states and error boundaries for facility and reservation listings.

### Don'ts
- **Don't** use pure black (`#000000`) for text; always use ink (`#0F172A`) for reduced eye strain.
- **Don't** use arbitrary corner radii (e.g. mixing `6px`, `10px`, and `24px` in the same screen).
- **Don't** use saturated red or green for decorative elements; keep semantic colors strictly for status and alerts.
- **Don't** hardcode inline styles or custom hex colors in components; always reference theme tokens.
