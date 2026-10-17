# StoreX BOM source designs

Project: `15161264923633714884` — Remix of StoreX Storage Finder.

Downloaded on 2026-10-07 with `curl -L`; HTML content and PNG signatures were checked.

| Screen | Source ID | Local export |
| --- | --- | --- |
| BOM02 — Facilities | `3638a7244aed43d58c15ca55714377a6` | Blocked: hosted HTML and image redirect to Google sign-in. React layout also references the user's supplied screenshot. |
| BOM03 — Pricing | `64bff3e3bd3f4c0e80907c502f7d7a26` | Blocked: hosted HTML and image redirect to Google sign-in. React layout also references the user's supplied screenshot. |
| BOM04 — Deposit and fees | `4e9d81e7a479439aa567be3d45469edb` | `bom04.html`, `bom04.png` |
| BOM05 — Business rules | `b78672bf5d144d98b81d8e7fc6e7e39a` | `bom05.html`, `bom05.png` |
| BOM06 — Reports | `de2642282b4f4544b731a265c245fa0e` | `bom06.html`, `bom06.png` |
| BOM07 — Revenue | `f5edcc37209a481db1a90e9d20952b48` | `bom07.html`, `bom07.png` |
| BOM08 — Utilization | `7acfd3608a754114838e98328a475406` | `bom08.html`, `bom08.png` |

These are unmodified source exports, not runtime application pages. Their original role labels and unconfirmed policies are intentionally not copied into the React implementation.

The application uses actor screens in `apps/web/src/modules/business-operations` and the domain UI, messages, types, hooks, and local fixtures in `apps/web/src/features/operations`. It makes no BOM backend calls and does not publish real pricing or fee policies.
