# Native booking flow review

Scope: new mobile booking screens, shared booking UI, hooks/services and customer navigation.
Reference: five original Stitch HTML/JPEG pairs in `.stitch/designs/booking-*`.

## Evidence

- Two bounded visual passes. Final captures: `booking-{1..5}-{390,375,430,768,844}.png`.
- Viewports: 390×844, 375×667, 430×932, 768×1024 and 844×390.
- No horizontal document overflow or React page errors in the fixture-backed preview.
- Five critical screens checked with axe WCAG 2 A/AA and 2.1 AA: zero violations after
  correcting selected-slot text contrast. Browser evidence is not a native-device audit.
- Pending-payment reload restored the same reservation/payment; exactly one make-payment
  request was recorded, and verified success cleared the recovery command.
- 45 mobile unit tests pass, including payment identity, paid receipt gates, exact QR payload,
  signed POST encoding, recovery schema, appointment reuse and unpaid replacement safeguards.
- Android Metro bundle compiled successfully (14,184,743 bytes); this is compile evidence, not a device runtime test.
- Mobile TypeScript and Biome pass. No E2E suite, real purchase or live gateway completion run.
- Android device was not attached during the final pass; device UAT remains with the user.

## API decisions

See `.stitch/API-MAPPING.md`. No backend, contract or web application source was changed.
Source fees, dates, slots, type dimensions and payment states come from current shared APIs.
Replacing an unpaid priced selection closes its former appointment via the existing customer
endpoint before creating a replacement; it does not call reservation cancellation/refund APIs.
Pending/success/refund payments cannot enter this replacement path. Completed paid bookings
show the actual receipt and appointment rather than claiming automatic assignment or access.

## Design detection triage

Active native screens had no primary static detector findings. Scoped `hooks ignore-value`
exceptions cover only the five untouched downloaded reference HTML files: Material Symbols
instead of native Lucide, unsupported Tailwind CDN type analysis, source heading skips and
source nested cards. No rule or file is globally ignored. The original HTML is also excluded
from Biome through mobile-local configuration, preserving the downloaded source exactly.

Native service completion, banking-app transitions, real provider redirects and keyboard/safe-area
behavior on the user's Android phone remain UAT. No claim is made that fixture responses prove
production payments. Added native dependencies: Expo Clipboard and React Native WebView.
