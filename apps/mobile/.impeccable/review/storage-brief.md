# Kho của tôi — implementation/review packet

Mode: Operate. Extend the existing MetaStorage mobile UI, using its Be Vietnam Pro fonts,
green brand colors, lavender customer canvas, transparent shared header and fixed bottom tabs.
Preserve the incumbent visual system and shared controls. Each requested screen has its own file.

## Confirmed scope

- Native current-rental, closed-history and rental-linked transaction screens from the three
  supplied Stitch designs. Shared components must be implemented before the screens.
- Mobile-only code. Types/utils in common/, data/workflow in a feature hook, requests through
  the centralized API client. Existing screens/old remain untouched and unmounted.
- No E2E suite. Expo Web screenshots with controlled API responses are authorized. Device UAT
  is the user's responsibility; do not claim that browser viewport emulation is Android proof.
- Existing decision: unsupported native actions show an in-app notice and do not launch web.
  Renewal has no approved new flow design, so its button follows that policy.

## Reference and implementation

Source comps: apps/mobile/.stitch/designs/rentals-{current,history,transactions}.jpg and .html.
Screen IDs: 6877adb0c6b94e70b1513b59efcbd2b2, 7a9e3a0b3d9244b9a9bc5a0877282581,
fa98b2ac1465486d8adb559ad9cacb06 in project 259132084655583484.

Files: src/screens/rentals-screen.tsx, rental-history-screen.tsx, rental-transactions-screen.tsx;
src/features/my-storage/{use-my-storage.ts,my-storage.messages.ts,components/};
src/common/my-storage.{types,utils}.ts; src/navigation/my-storage-navigator.tsx;
shared ChoiceTabs and DetailSheet; customer-layout/customer-navigator integration.

Shared pieces were implemented first: segmented ChoiceTabs with counts, DetailSheet,
StorageHeader, RentalCard (full/compact) and TransactionRow, composing existing primitives.
Keep 44px touch targets even where the original illustration depicts smaller buttons.

## API decisions and constraints

- Query both rental views, follow all nextCursor pages and deduplicate before showing counts.
- Current/history follow ACTIVE/CLOSED; elapsed end dates do not close a rental.
- Transactions are per-rental GETs over all current/history rental IDs, deduplicated by payment ID.
  No global ledger endpoint exists. Counts stay unknown on incomplete reads; partial error is visible.
- Detail and transaction sheets stay native. Receipt is explicitly not a VAT invoice; render
  actual amount/currency/provider/refund data, not sample VNPay/card/auto-renewal fields.
- Rebook preselects facility/type in the existing booking flow, validates price/availability again
  and returns to the origin tab on back. It never promises the same physical unit.
- See .stitch/API-MAPPING.md for exact routes. No writes are made by the three new data screens.

## Quality bar

At 375×667, 390×844, 430×932, 768×1024 and 844×390: no horizontal overflow, visible primary
and navigation actions, scrollable records, no clipped labels and readable status contrast.
Current: full leading card and compact remaining rows with actual allocation/type/location/dates.
History: closed status, date bounds and actual close date, working native detail/rebook actions.
Transactions: aligned codes, statuses, amounts, date/provider labels, all/success filter, date sort,
partial/empty/error feedback, working receipt sheet and correct bottom-tab selection.

## Evidence

Final screenshots in .impeccable/review/: storage-{current,history,transactions}-{375,390,430,768,844}.png;
storage-{detail,receipt}-390.png; storage-{current,history,transactions}-390-{empty,partial}.png.
Machine evidence: storage-{normal,empty,partial}-evidence.json. Initial capture round exposed
inactive-tab/neutral-pill contrast; those were corrected using existing darker text tokens.
No native detector ran (HTML/CSS detection has no native verdict). Original reference HTML may
have separate scoped archival exceptions; those do not waive active native code findings.

Checks: mobile TypeScript/Biome and 50 mobile unit tests pass; financial deduplication, canonical
rental status, due labels, closure sorting and currency formatting covered. Browser fixtures
traverse multiple cursor pages, exercise three tabs and sheets, rebook/back and success filtering.
No real payment or E2E suite executed. No connected native device evidence is available.

Review must report disposition and evidence scope candidly; do not broaden work into native
renewal, invoices, account/support screens, backend changes or stale design documentation repairs.


## Final review

Direct review disposition: ship for the checked source and Expo Web scope; see
`storage-finish-review.md` and `storage-documentation.md`. Reviewer/documenter tools were not
available, so their documented fallback passes ran in thread. Native device UAT is still deferred.
The receipt close control was revalidated at 44×44 with a visible 20px SVG; no code correction
was required. Reference-only hook warnings were scoped to the original HTML files, with no
native-screen exceptions.
