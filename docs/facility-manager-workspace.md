# Facility Manager workspace

The FM workspace adds Rentals, Support and Reports beside the existing coordination,
unit inventory and staff directory. All screens use the current account's assigned
facility. A single assigned facility is displayed as context rather than a selector.

## Rentals and customers

- `GET /api/facility-workspace/rentals`: `facilityId`, optional `status`, `search`,
  `limit` (1–100), `offset`. Includes customer, unit and rental state.
- `GET /api/facility-workspace/rentals/:id`: includes initial booking payments and
  rental-charge payments. Transaction status is read from the database.
- Only an active FM membership at the rental's facility grants access. A foreign
  facility list returns 403; inaccessible details return 404.
- This workspace does not create rentals or settle payments. Handover remains the
  operation that activates a rental.

## Support operations

These operations extend the approved [support policy](customer-support-policy.md)
without changing customer ticket creation and image-upload rules.

- `GET /api/facility-workspace/support`: required `facilityId`; optional `status`,
  `category`, `priority`, `search`, `overdue`, `limit`, `offset`.
- `GET /api/facility-workspace/support/:id`: detail and paginated messages, newest
  first; `limit` and `offset` apply to conversation history.
- `GET /api/facility-workspace/support/:id/images/:imageId`: private authenticated
  image bytes. Storage content and current authorization are checked before return.
- `POST /api/facility-workspace/support/:id/actions`: strict discriminated payload
  with `action` and the latest ticket `version`.

| Action | Additional fields | Permission / effect |
| --- | --- | --- |
| ASSIGN | staffId, reason | FM assigns active FS from the same facility; starts IN_PROGRESS |
| REPLY | content | Public reply by authorized FM, assigned FS or PAYMENT BOM |
| NOTE | content | Internal note visible only to FM/BOM |
| START | none | Assigned FS starts on-site handling; BOM starts PAYMENT handling |
| REPORT | content | Assigned FS submits work; ticket remains IN_PROGRESS |
| ACCEPT | reportId, reason | FM accepts the current assignment's latest warehouse report; closes RESOLVED |
| CLOSE | reason | BOM closes a PAYMENT ticket |
| REOPEN | reason | FM reopens warehouse tickets; BOM reopens PAYMENT tickets |
| PRIORITY | priority, reason | FM manages warehouse priority; BOM manages PAYMENT priority |

FM/FS can read PAYMENT tickets in their facility, but FS must be the current
assignee. BOM can read PAYMENT tickets across facilities. Reassignment immediately
revokes the previous FS's ticket/image access. An FS cannot see unassigned tickets.
Customer-facing history excludes staff reports and internal notes; FS history
excludes internal notes. Closed tickets reject further staff work.

Customer withdrawal is `POST /api/support/tickets/:id/close` with `version` and
`reason`. Only the booking owner can withdraw. It closes CUSTOMER_WITHDREW and
does not accept a staff report. Support operations never update rental, payment
or unit business state.

Mutations lock the ticket and validate active roles/memberships in the transaction.
Stale versions return 409; the FM form keeps its draft while refreshing the ticket.
Reopening clears assignment and retains the original response deadline/timestamps.

## Notifications

Migration `0061_lush_bromley` adds the `SUPPORT_UPDATED` lifecycle event. Creation and updates
write role-specific IN_APP outbox entries for active FM, PAYMENT BOM and the
current FS where appropriate. Internal-note notifications exclude FS and customer.
Public operator replies/closure/reopening and customer withdrawal enqueue customer
email through the existing worker. No internal note/report content is emailed.
The worker and valid mail configuration are required for actual delivery.

## Reports and CSV

The Reports screen uses existing facility-scoped reports APIs for revenue,
monthly revenue, utilization and rental status. Preview is limited to 100 rows;
CSV export uses the backend export endpoint for all matching rows. Modified form
filters must be applied before export. Financial reports validate their date range.

## Validation boundary

Database integration tests cover scope, assignment, report acceptance, concurrency,
withdrawal, payment authority and note privacy against an isolated PostgreSQL DB.
Browser tests cover desktop/mobile navigation, forms, error recovery and CSV with
API fixtures. Browser fixtures do not prove live mail-provider delivery.

Unit-type CRUD and price editing remain pending a decision on facility-local versus
system-wide price ownership; existing BOM price permissions have not been widened.

## Compatibility with current dev

This workspace retains the existing customer support-context endpoints and the
notification popovers from dev. Rental and support customer names/emails are read
from the booking owner's users record because bookings no longer store guest
contact names or email addresses. Root contract exports distinguish the workspace
rental DTOs as FacilityWorkspaceRentalItem/FacilityWorkspaceRentalPage from the
existing rentals module DTOs. The existing migration history through 0060 is kept
intact; 0061 adds only the SUPPORT_UPDATED notification event.
