# Customer financial policy — requestor-approved MVP policy

**Status:** The requestor approved the listed MVP policy proposals on 2026-10-24. Requestor name/role is not recorded; any explicit Finance/Legal validation is tracked separately below.
**Issue:** [#161](https://github.com/vlnguyen910/metastorage/issues/161)
**Prepared:** 2026-10-24
**Approver / approval date:** Requestor in this conversation (name/role TBD) / 2026-10-24

This document records the policy choices approved by the requestor for [#162](https://github.com/vlnguyen910/metastorage/issues/162) (charges and collection) and [#163](https://github.com/vlnguyen910/metastorage/issues/163) (renewal). The implementation of #162/#163 applies this register to runtime and schema; this document remains the decision record. Remaining TBDs and Finance/Legal validation items are listed separately; approval here does not imply those functions have signed off.

## Existing rules to preserve

These rules are already represented in current code/docs and are not reopened here:

- Initial checkout remains one payment for the snapshotted rental fee plus deposit. A booking's original price/deposit and the issued contract are immutable history.
- `DEPOSIT_MONTHS` is currently 1; `OVERDUE_FEE_RATE` is currently 25%. Both are BOM-managed system settings. Quotes/assessments snapshot their applicable values; later setting changes do not recalculate them.
- Current return policy assesses one overdue fee from the deposit snapshot when the confirmed local return date is after the rental expiry date. Approved overdue/damage fees deduct from deposit; return debt is recorded but is not collected automatically.
- Return settlement corrections append immutable revisions. Refund transfers remain separate, manual, confirmed transfers allocated to deposit/rent. A correction does not rewrite a prior payment or refund.
- Current report `cashReceived` is grouped by `paidAt`; `cashRefunded` by confirmed refund time. `netCash` is cash flow, not accounting profit. Deposits, forfeitures, return fees, and refunds remain distinguishable.
- The existing customer contract PDF is immutable and cannot be uploaded/issued after handover. There is no e-signing or renewal-addendum workflow.
- Guest booking ownership is not inferred from email. No automatic extra late fee, debt collection, charge, renewal, or waitlist behavior is implied by these existing rules.

Source references: [System settings](./system-settings.md), [Returns API and policy](./returns-api.md), [Reports](./flow-4-reports-api.md), [Booking payments](./booking-payment.md), and [Rental contracts](./rental-contracts-api.md).

## Decision register

The requestor approved the selected options below in this conversation on 2026-10-24. The account name/role is not available in this record. Do not describe the remaining validation/TBD items below as approved.

| ID | Decision | Approved policy | Selected / approved option | Approver / date |
| --- | --- | --- | --- | --- |
| R1 | MVP scope and renewal eligibility | Allow same-unit renewal only while rental is `ACTIVE`, before cutoff, and with no return request/inspection/settlement or conflicting confirmed capacity. `OVERDUE` and closed rentals cannot renew. | **APPROVED** — same-unit, `ACTIVE`, eligible before cutoff; reject `OVERDUE`, closed, return-in-progress, and capacity-conflicting rentals. | Requestor (name/role TBD) / 2026-10-24 |
| R2 | Notice and hard cutoff | Hard cutoff is the end of the 23:59 local minute (`23:59:59.999`) on the date six days before rental expiry. Use facility timezone when configured; if MVP has one Vietnam operating timezone, explicitly use `Asia/Ho_Chi_Minh`. Keep reminders separate. | **APPROVED** — six days before expiry, through 23:59:59.999 local time; timezone source as described. | Requestor (name/role TBD) / 2026-10-24 |
| R3 | Last available unit / competing booking | Under one rental/facility-capacity lock, first successfully committed renewal or overlapping new booking wins. A quote does not reserve capacity. No relocation or waitlist. Captured payment that cannot apply follows controlled refund handling. | **APPROVED** — first commit wins; no quote hold, relocation, or waitlist. | Requestor (name/role TBD) / 2026-10-24 |
| R4 | Approval and payment order | Routine policy-compliant same-unit renewal needs no FM review. FM approves documented exceptions; no self-approval. Renewal applies only after provider-confirmed payment. | **APPROVED** — no routine FM approval; exception requires independent FM approval, reason, and audit. #163 implements routine renewal only; exception types/workflow are deferred to a separate decision issue. | Requestor (name/role TBD) / 2026-10-24 |
| R5 | Renewal rate and deposit | Use current published rate at quote creation, freeze the amount for 15 minutes, then require a new quote. Collect rent only; do not collect more deposit. Keep the original deposit snapshot unchanged; excess return fees become return debt. | **APPROVED** — rent only, current published rate, 15-minute quote, existing deposit unchanged. | Requestor (name/role TBD) / 2026-10-24 |
| R6 | Rental term and expiry boundary | One rental month is exactly 30 × 24 hours. Treat term as `[start, expiry)`: start is included and expiry instant is excluded. Each renewed month adds 30 days to the current expiry. | **APPROVED** — fixed 30-day duration, half-open interval, OVERDUE at the exact expiry instant; overdue fees still start only on the following local date. | Requestor (name/role TBD) / 2026-10-24 |
| R7 | Return, overdue, and existing debt | `OVERDUE` rentals cannot renew. Return processing blocks renewal. Do not net return debt into rent; keep it as a separate obligation. Unpaid `RETURN_DEBT` on any rental belonging to the customer blocks renewal; unpaid EXTRA remains a separate obligation. Existing one-time overdue fee remains under current return policy. | **APPROVED** — overdue/return restrictions, separate debt source and the customer-wide unpaid RETURN_DEBT gate. | Requestor (name/role TBD) / 2026-10-24 |
| R8 | Early return and rent refunds | No refund of unused rental fees for early return, for either the initial term or an applied renewal. New settlements must use unusedRentRefundAmount=0. Preserve previously approved historical entitlements/transfers. A captured renewal that cannot apply still requires controlled refund. | **APPROVED** — no early-return rent refund; separate unapplied-payment refund. | Requestor (name/role TBD) / 2026-10-24 |
| C1 | Extra-charge categories and evidence | MVP categories: lock/key/access-device replacement and documented facility service/cleaning charges. Damage and overdue remain return-settlement items. Require category, reason, amount, evidence, notice, due date; allow 7 calendar days to dispute and pause collection while disputed. | **APPROVED** — finite categories and evidence/dispute flow as described. | Requestor (name/role TBD) / 2026-10-24 |
| C2 | Charge and waiver permissions | Assigned FS submits with evidence; assigned FM approves/rejects; no self-approval. BOM may waive/adjust with reason and audit; a BOM-created charge needs a different authorized approver. | **APPROVED** — role separation and audit as described, subject to role-name validation. | Requestor (name/role TBD) / 2026-10-24 |
| P1 | Collection method, currency, partial/manual payments | Reuse SePay, VND only, full payment per source obligation. No counter cash, partial payment, wallet, or generic invoice engine in MVP. Failed attempts leave the obligation unpaid; retry is idempotent. | **APPROVED** — SePay/VND/full-only collection for MVP. | Requestor (name/role TBD) / 2026-10-24 |
| P2 | Late success, expiry, and replay | Only verified idempotent success with provider `paidAt` before the quote expires applies. Quote expiry is the earlier of creation + 15 minutes and the R2 renewal cutoff. Replays return stored outcome. If captured after expiry or conflict prevents application, never extend; flag for controlled refund. No automatic refund unless provider safely supports it. | **APPROVED** — no late extension or duplicate application; controlled refund path. | Requestor (name/role TBD) / 2026-10-24 |
| L1 | Receivable model and source identity | One immutable obligation per typed source (`RENEWAL`, `EXTRA`, `RETURN_DEBT`); integer VND amount/components and audit. Payment attempts reference obligation; one obligation may have multiple attempts but is collected once. Initial checkout unchanged. | **APPROVED** — source obligation separate from payment attempts. | Requestor (name/role TBD) / 2026-10-24 |
| L2 | Settlement correction after collection | Keep settlement revisions and captured payments immutable. If corrected collected debt is lower, create a source-linked refund for the difference; MVP has refunds only, no reusable customer credit. | **APPROVED** — refund-only correction; no wallet/credit balance. | Requestor (name/role TBD) / 2026-10-24 |
| A1 | Reporting and refund caps | Report cash received/refunded by confirmed timestamps; separate rent, extras, debt, deposit, and refunds. Cap cumulative refund at source-captured amount. Do not label cash reports accounting revenue/profit without Finance recognition rules. | **APPROVED** — operational cashflow classification/refund cap; Finance recognition validation remains open. | Requestor (name/role TBD) / 2026-10-24 |
| K1 | Renewal agreement after handover | No signed addendum required in MVP. Save versioned renewal terms and customer acceptance; never modify original PDF. Before making legal documents mandatory, Legal/business defines trigger, acceptance/signature, signatories, retention, and owner. | **APPROVED** — no mandatory addendum in MVP; preserve auditable terms/acceptance. Legal sufficiency validation remains open. | Requestor (name/role TBD) / 2026-10-24 |

## Policy rationale, trade-offs, and validation

The decisions in the register are approved by the requestor. The following records their trade-offs and remaining validation work; it does not grant Finance or Legal sign-off where those functions are required.

| Decision | Advantages | Trade-offs / risks | Dependencies and remaining TBD |
| --- | --- | --- | --- |
| R1/R7: no renewal while `OVERDUE` | Clear lifecycle rule; avoids extending a rental while a return/overdue case is unresolved; easy for customer support to explain. | A customer who misses the cutoff or payment may lose the unit even if they are willing to pay; may increase move-out/rebooking work. This does not itself collect existing debt. | Quote/payment race checks revalidate the exact expiry instant and current status. Unpaid RETURN_DEBT across the customer blocks renewal; any return request blocks immediately, including before status changes. OVERDUE starts at the saved expiry instant; fee assessment remains local-date based. |
| R2: local 23:59, six days before expiry | Gives a predictable deadline for customers and operations; aligns to the date proposed in #96 for a 30 Sep expiry. | “Local” needs a canonical facility timezone; timestamp inclusivity and expiry-date meaning can create one-second/day-boundary disputes. A hard cutoff six days out may release scarce units earlier than needed. | Validate timezone source and expiry-date derivation against facility configuration. Reminders remain separate; capacity and renewal checks must use the same cutoff instant. |
| R4: no FM review for compliant renewals; approval for exceptions | Fewer operational steps for routine renewals; keeps staff out of a deterministic customer flow. | “Compliant” and “exception” must be machine-checkable. If exception authority is unclear, staff may grant inconsistent pricing/terms or bypass controls. | Validate role mapping; define exception types and audit reason before implementing override paths. Payment success remains required before extension. |
| R5: collect rent only, no renewal deposit | Simpler quote and payment; avoids repeatedly collecting funds while the original deposit is still held; keeps renewal payment distinct from deposit liability. | The deposit may become small compared with the longer rental/return exposure; damage/overdue deductions could exceed the held deposit and create debt. Current return assessment relies on a deposit snapshot, so the deposit base must stay explicit and must not be recomputed from current rates. | Preserve original deposit snapshot in renewal/return/report data. #162 must represent renewal rent without a deposit component; return/debt policy and A1 reporting must remain source-correct. |
| K1: no mandatory addendum in MVP | Avoids blocking renewal on a document workflow that does not exist; reduces operational overhead and scope. | A renewed term may not be evidenced in a form Legal/business considers sufficient; customer disputes may be harder to resolve. The original PDF does not document later terms. | Legal/business validates sufficiency of versioned terms plus recorded customer acceptance and defines any future document trigger, retention, and owner. Do not edit/reissue the original PDF. |

## Implementation decisions confirmed for #163

- **Resolved in #163:** customer-wide unpaid RETURN_DEBT blocks renewal; no debt/rent netting; unpaid EXTRA does not block.
- **Resolved R2/R5/R6 implementation mapping:** use the shared `Asia/Ho_Chi_Minh` timezone; operating hours are shared BOM settings and holiday calendars are out of scope. `unit_types.monthly_price` is the current published global rate. New booking/renewal months use 30 × 24 hours, `rentals.expected_end_at` is current expiry, and booking/PDF snapshots retain the initial term. OVERDUE begins at the exact expiry instant; fees remain based on the next local date. Reminder/review cadence remains separate.
- **R8:** no early-return rental-fee refunds for new initial/renewal settlements. Preserve historical approved entitlements/transfers; captured-but-unapplied renewal payments still require controlled refunds.

## Remaining TBDs and validation items

The main policy decisions are approved. The following details remain open and must not be inferred from the approved choices:

- **R4 exception follow-up [#174](https://github.com/vlnguyen910/metastorage/issues/174):** define finite exception types, authority and safeguards before implementing overrides. #163 rejects out-of-policy renewals. Existing FS/FM/BOM roles and facility scopes are reused; Finance/Legal sign-off is still separate.
- **P2 operations:** name refund owner/SLA and confirm provider capabilities. Until confirmed, use the controlled refund workflow; do not auto-refund.
- **C1 customer notice:** choose/confirm the notice channel and delivery evidence. Current charge code records submission time, but does not yet prove that a notice reached the customer; do not treat the 7-day dispute clock as production-ready until this is resolved.
- **C1/RETURN_DEBT due date:** extra charges require an entered due date. Return-debt due date and late collection timing remain TBD; no automatic overdue fee/collection is implied.
- **A1 Finance validation:** Finance to confirm accounting recognition/labels. Approved reports remain operational cash-flow reports, not accounting revenue/profit reports.
- **K1 Legal validation:** Legal/business to confirm whether versioned terms plus recorded customer acceptance is sufficient for MVP and define any case requiring a signed document, including acceptance method, retention, and owner.
- **Approval metadata:** the requestor approved the policy in this conversation on 2026-10-24, but their name and organizational role were not provided. Add those details to the formal decision record if the issue requires a named business approver.

## Approved MVP resolutions and rationale

The requestor approved the following implementation direction. Finance/Legal validation and the specific TBDs above remain open where noted.

| Approved area | Approved resolution | Rationale |
| --- | --- | --- |
| R1/R7 eligibility and return conflict | Allow renewal only for an `ACTIVE` rental before cutoff. Any return request, inspection, or settlement blocks renewal immediately; outstanding `RETURN_DEBT` does not get silently netted into rent. Keep it payable as a separate obligation, and require it to be paid before renewal on any other rental of the same customer. Show a clear ineligible reason to the customer. | One eligibility rule avoids renewal/return state overlap and preserves source-level money history. The approved customer-wide debt gate prevents a new renewal while return debt is unpaid. |
| R2 timezone and exact cutoff | Use facility timezone if the facility has one; if the MVP has a single Vietnam operating timezone, explicitly configure `Asia/Ho_Chi_Minh`. Treat 23:59 as inclusive through the end of that local minute; persist/compare an unambiguous UTC instant. Derive the expiry calendar date from the rental's saved end date/timezone. Keep reminders informational and separate from eligibility. | Removes server-timezone and boundary ambiguity while avoiding an unconfigured per-request timezone. The exact timezone must match actual STOREX operations. |
| R3 competing capacity | Under the same database transaction/lock used for capacity confirmation, first successful commit wins. A quote does not reserve capacity. If a competing booking commits before renewal payment applies, do not extend; send the captured payment to the established refund workflow. No automatic reassignment or waitlist in MVP. | Prevents double allocation without introducing holds, expiry jobs, or a waitlist. Depends on P2 defining the paid-but-inapplicable outcome. |
| R4 exception approval | Define compliant renewal as same facility/unit, same published pricing rules, within cutoff, no return/debt exception, and no manual price/term override. Routine renewals require no FM action. FM approves a documented exception with reason; the person who created the exception cannot approve it. | Makes the no-review path machine-checkable and keeps an auditable independent approval for overrides. Validate the approved authority against current STOREX role scopes before implementation. |
| R5 pricing and quote validity | Use the current published rate when creating the quote and freeze that amount/term for 15 minutes; after expiry require a new quote. Renewal collects rent only. Keep the original deposit amount unchanged and use its existing snapshot at return; do not derive a new deposit from current rates. If fees exceed it, record return debt through the existing settlement flow. | Makes the amount stable during checkout and avoids changing deposit liability mid-rental. |
| R6 rental duration | Treat each rental month as exactly 30 × 24 hours. Model the term as `[start, expiry)`: the start instant is usable, the expiry instant is not; each renewal adds 30 days to the existing expiry instant. Convert to local time only for display and persist/compare a precise instant. | Simple, predictable duration that avoids variable month lengths and inclusive-day ambiguity. Validate mapping to current `expectedEndAt`/return behavior before implementation. |
| C1 extra-charge scope | MVP allows only a short approved list: replacement of lock/key/access device and documented facility service/cleaning charges. Damage and overdue remain return-settlement items, not duplicate extras. Require category, reason, amount, supporting evidence, customer notice, and due date. Give the customer 7 calendar days to dispute; pause collection while disputed. | Avoids an open-ended invoice engine and duplicate return charges. |
| C2 roles / waiver | Assigned FS submits with evidence; assigned FM approves/rejects; no self-approval. BOM may waive or adjust only with a reason and audit record. If BOM created the charge, require a different authorized approver. | Separates request and approval while reusing existing facility roles. Confirm role names and authority against the actual operating model. |
| P1 payment modes | SePay, VND, full payment per obligation, no cash-at-counter, partial payment, wallet, or generic invoice. Failed attempts leave the same obligation unpaid; retries use provider idempotency. | Reuses the current provider path and avoids allocation of partial money across multiple sources. Cash and partial payment add reconciliation rules not otherwise needed for the MVP. |
| P2 late/failed/replayed payment | Only verified, idempotent provider success before the obligation/quote deadline may apply. Replayed events return the stored result. If money is captured after expiry or after a conflicting return/booking wins, never extend the rental; mark it for refund through the existing controlled refund process. Do not auto-refund unless the provider integration already supports safe idempotent refunds. | Avoids duplicate extensions and untracked money. Depends on provider callback verification, source-specific obligation status, and a defined refund owner/SLA. |
| L1 obligation model | One immutable obligation per business source, with typed source references (`RENEWAL`, `EXTRA`, `RETURN_DEBT` + source ID), integer VND amount and component snapshot. Payment attempts reference the obligation; one obligation can have multiple attempts but can be collected only once. Keep initial booking checkout semantics unchanged. | Separates what is owed from how payment is attempted and supports audit/retry without a general ledger. Exact schema/API design remains in #162. |
| L2 correction after collection | Never edit a captured payment or prior settlement revision. If a later approved revision lowers an already collected debt, create a source-linked refund due for the difference; MVP supports refund only, not reusable customer credit. | Refund-only is easier to reconcile and avoids creating a customer wallet/credit balance with expiry and transfer rules. Finance must approve refund timing and method. |
| A1 report and refund rules | Report cash received/refunded as cash-flow facts by confirmed timestamps. Keep renewal rent, extras, return-debt collection, held deposit and refunds in distinct categories. Cap cumulative refunds at the captured amount for that source. Do not label operational cash reports as accounting revenue/profit until Finance defines recognition rules. | Preserves the current report's cash-flow meaning and prevents deposit/debt from being mistaken for rent revenue. Finance still must approve chart/accounting labels. |
| K1 renewal evidence | No signed addendum in MVP. Persist a versioned renewal terms snapshot and customer acceptance timestamp/actor; do not modify the original contract PDF. Before requiring a legal document, Legal/business defines trigger, signature/acceptance method, signatories, retention period, and responsible operator. | Lets the basic renewal flow operate while retaining evidence of what the customer accepted. Legal must confirm that this evidence is sufficient for STOREX's contract and jurisdiction. |

The main cross-dependencies for implementation are: R2 + R3 + P2 must use the same deadline and race outcome; R5 + L1 + A1 must keep rent, deposit and debt separate; C1 + C2 + L1 define who can create and approve each charge; L2 + A1 define refund and reporting behavior after correction. Resolve the listed TBDs/validation items before implementing their dependent paths in #162/#163.

## Model and contract boundary for follow-up design

The following design direction is consistent with the approved policy. Exact schema names, constraints, and API shapes remain follow-up design work for #162/#163 and are not approved by this policy document.

- Keep the booking checkout flow unchanged for initial rental + deposit.
- Add a rental obligation/charge record representing **what is owed**, not a provider attempt. It is tied to a rental and exactly one typed source (`RENEWAL`, `EXTRA`, or a particular `RETURN_DEBT` settlement revision). Store integer VND amounts, source/component breakdown, status, due time, reason/evidence, creator/approver, idempotency key and audit.
- A renewal record snapshots prior/new term boundaries, 30-day duration units and rate/version, plus the rent amount. It has no deposit charge or deposit contribution. Applying it updates the current rental end exactly once under rental/booking/capacity locks; it never overwrites the original booking price or issued PDF.
- Payment rows represent attempts against one obligation. Several `FAILED`/`PENDING` attempts still leave one amount due; one provider-confirmed success marks that source paid once. Initial checkout attempts remain tied to bookings and continue to use their current workflow.
- A return settlement revision remains immutable and authoritative for its assessed refund/debt. A later correction creates an adjustment linked to the new revision; it does not mutate historical charges, payment attempts or transfer allocations.
- Reports aggregate each payment/refund once before joining source records. Source attribution comes from immutable obligation components, never from contact text, current catalog prices or an inferred “rent first/deposit first” ordering.

Contract direction for #162: customer reads their own obligations and starts payment against an obligation ID; the server supplies amount/currency/source and rejects client-supplied amount changes. FM/FS charge actions follow the approved permission matrix. Provider callbacks/reconciliation resolve the obligation and never create/confirm a booking, QR code or handover as a side effect of charge collection.

Contract direction for #163: customer receives a server quote and requests renewal; the response states eligibility, exact old/new term, rate snapshot, rent-only amount due, unchanged deposit treatment and cutoff. Record customer acceptance of the versioned terms; no signed addendum is required in MVP, subject to the Legal validation above. Payment success applies the renewal atomically once; return, expiry, new-booking and renewal races resolve under the same locked state. Reminder events are keyed to the rental term/version, and stale reminders for an old term are suppressed.

## Approved policy examples

Amounts below are illustrative; they are not current catalog prices.

### 1. Last available Large unit

There are ten Large units. Customer A occupies A5 through 30 Sep. Customer B wants a Large unit from 1 Oct, and A5 is the only capacity left for that period.

- For an expiry date of 30 Sep, the approved cutoff is 24 Sep at 23:59 in the applicable configured local timezone; reminder timing remains separate.
- If B's overlapping booking commits first, A's later renewal is rejected; if A's paid renewal applies first, B cannot reserve overlapping capacity. No silent reassignment or waitlist is allowed in MVP.
- A reminder alone does not imply an extension, and a quote does not hold capacity.

### 2. Rate/deposit and rental term

Assume the current monthly rate is 1,200,000 VND and the existing rental has 1,000,000 VND deposit held. One renewed month costs 1,200,000 VND rent and is not refunded for early return; no additional deposit is collected and the held deposit remains unchanged. At return, the applicable deposit base and overdue calculation use explicit rental/settlement snapshots, not current catalog pricing. A deposit adjustment is outside this MVP renewal policy and would require a separate decision.

For renewal, one rental month is exactly 30 × 24 hours. The interval includes the start instant and excludes the expiry instant; each renewed month adds 30 days to the current expiry. Facility timezone is used for display and the approved cutoff; implementation must map this boundary to existing expiry/return checks.

### 3. Failed, late, and replayed payment

One 1,200,000 VND renewal obligation may have attempt A=`FAILED`, then attempt B=`SUCCEEDED`. Both attempts refer to the same obligation; only B collects it and the renewal applies once. Replaying B's provider event cannot add another month. A successful payment received after the approved deadline or after return/competing booking wins cannot extend the rental; it is flagged for controlled refund. Refund owner/SLA remains open.

### 4. Renewal versus return

If renewal and return start concurrently, only one workflow may commit against the rental version. Approved outcome: return processing committed first rejects renewal and any captured payment follows P2; renewal applied first moves the expiry and return settlement must use the new current term. Lock order and all readers/cron jobs must follow that same policy.

### 5. Correcting debt after collection

Suppose settlement revision 1 assessed 200,000 VND debt and that source-specific obligation was paid. Revision 2 corrects debt to 50,000 VND. The earlier 200,000 VND payment stays recorded. A separate 150,000 VND source-linked refund is created for the difference; it does not erase or reclassify the original collection. MVP does not create reusable customer credit.

## State and permission rules

| Event | Actor/guard | Result | Policy / open item |
| --- | --- | --- | --- |
| Request renewal | Active rental owner; before cutoff; no return flow or capacity conflict; `OVERDUE` ineligible | Create quote with frozen term/rate facts; no deposit charge | R1–R8; customer-wide RETURN_DEBT gate approved |
| Approve exception | Assigned-facility FM; not the creator; reason and audit | Mark exception payable; no term extension yet | R4/C2; role mapping validation |
| Pay obligation | Customer owner; full VND amount; valid obligation/deadline | Provider attempt; amount comes from server obligation | P1–P2/L1; refund owner/SLA TBD |
| Apply successful renewal | System after verified success under lock; no conflicting return/booking | Append renewal history and add 30 days once; deposit unchanged | R1–R7/K1; map expiry semantics |
| Submit extra charge | Assigned FS with approved category and evidence | Await FM approval; does not collect money | C1–C2 |
| Approve/waive extra | Assigned FM / BOM per approved matrix; no self-approval; reason and audit | Create or reduce source obligation; never edit a paid transfer | C1–C2/L1–L2 |
| Assess return debt | Existing FM settlement approval and immutable revision | Record `RETURN_DEBT` source; no automatic collection | R7/L1–L2 |
| Correct after collection | FM-approved new settlement revision | Preserve collection and create source-linked refund for overcollection | L2/A1; Finance recognition validation |

Implement only after mapping the approved rules to current states/fields and resolving the listed blocking TBDs. Payment `SUCCEEDED` is provider-confirmed state, not a customer-submitted flag, and an obligation's status must not be derived from the number of payment attempts.

## Decision record

The requestor-approved policy choices are recorded above. Before treating issue #161 as fully administratively complete, add the requestor's name/role if required by the issue's approval record and resolve the remaining TBD/Finance/Legal validations. Update `docs/db-diagram.md` only when implementing the approved model in #162/#163. Closed state on older issues #34, #43, #58–60 or example #96 is not approval evidence for this decision record.
