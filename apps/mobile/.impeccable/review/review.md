disposition: ship

Review substitution: the independent reviewer was unavailable due to a usage limit. This is a direct, in-thread visual/source review, not an independent approval. Scope: Expo Web captures with fixture data; Android/iOS acceptance remains user UAT. No E2E suite was run.

## persistence

Pass for the pinned extension. `docs/THEME.md`, `docs/mobile-patterns.md`, existing mobile tokens/fonts and shared controls remain authoritative. `src/components/ui/README.md` and `.stitch/API-MAPPING.md` describe the final props and unsupported-flow decision. No new visual world or root design documents were introduced.

## fidelity

| Element | Verdict | Evidence |
| --- | --- | --- |
| TYPE | Adaptation | Existing Be Vietnam Pro fonts are preserved as required by the repository UI foundation; compact labels and heading steps follow the pinned mobile layout. |
| MATERIAL | Match | Downloaded facility photographs are used without simulated imagery; photos are labeled illustrative. The detail QR is generated from the existing reservation lookup URL. |
| GROUND | Match | The customer canvas uses the source lavender `#faf8ff`, information strips `#f2f3ff`, selected navigation `#b4efda`, and secondary text `#404945`. |
| Header | Match | MetaStorage casing, transparent header and removal of the divider implement the user's explicit corrections. Web captures omit the native OS status bar. |
| Search | Adaptation | The shared inverse search field and inline mint submit action restore the source hierarchy. The existing solid dark-green brand token is retained. Copy describes catalog search without claiming geolocation. |
| Summary tiles | Adaptation | Shared compact tiles restore icon, count/caption and divided action rows. Values and the next appointment time come from API data. Action targets remain at least 44px. |
| Next appointment | Adaptation | QR icon, payment badge, corner status, facility details, lavender facts and compact detail action restore the source order. Actual API statuses replace unsupported readiness claims. |
| Facility rail | Adaptation | Edge-to-edge images, compact names/addresses and price rows follow the reference. Unsupported distance/stock claims are omitted, as documented in API-MAPPING. |
| Appointment list/detail | Adaptation | Compact list cards, true dates/statuses and detail information retain the existing API mapping and separate screen files. Header canvas now matches the body. |
| Navigation/actions | Match | Three native navigation destinations remain visible. Unsupported destinations show one shared, dismissible notice and do not launch a browser. |

## ceiling

Reached for the requested visual correction and reuse scope in the supplied Expo Web captures. Native font rendering, safe areas, keyboard and business acceptance remain user UAT.

## material_fixes

None identified within the supplied visual/source evidence. This is not a pixel-perfect or native-device certification.

## keep

Preserve shared controls and fonts, truthful API values, the three separate screens, archived-route isolation, illustrative-image labeling and the user-confirmed in-app unsupported-feature behavior.

## Follow-up: search and facility explorer

The inverse search uses a flexing View around the core NativeWind-compatible TextInput;
its entered text resolves to white and the fixed trailing submit label is white. Web
captures at 375, 390, 768 and 844px preserve button alignment with populated input.
The separate facility explorer follows the downloaded discovery reference, reuses
FacilityCard for full-width results, and uses actual catalog search/city/sort/pagination.
Only submitted terms enter the session history. Photos remain illustrative; unsupported
booking actions retain the confirmed in-app notice. Captures are visual/fixture evidence,
not a native UAT result. No functional E2E suite was run.
