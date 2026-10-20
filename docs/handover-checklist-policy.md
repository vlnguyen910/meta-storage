# Handover checklist — H6 / issue #23

Status: H6 decision confirmed by the task owner on 2026-10-02; shared validation contract implemented.

Sources: issue #23, issue #24, UC-FS-01 reference in those issues. The consolidated
requirements containing H6 are not available in the repository. The issue descriptions
do not specify the individual inspection items, photo requirements or signatures.

## Confirmed item list (H6_V1)

| Code | Item | Result | Required | Must pass | Failure note | Photo |
| --- | --- | --- | --- | --- | --- | --- |
| ASSIGNED_UNIT | Verify the inspected unit matches the assigned unit | PASS_FAIL | Yes | Yes | Optional | Optional |
| DOOR_LOCK | Door and lock operate correctly | PASS_FAIL | Yes | Yes | Optional | Optional |
| UNIT_CONDITION | Unit is not damaged | PASS_FAIL | Yes | Yes | Optional | Optional |
| EXISTING_INVENTORY | Existing belongings are complete, not missing or damaged | PASS_FAIL | Yes | Yes | Optional | Optional |

The task owner explicitly removed cleanliness/dryness from the mandatory checklist and
confirmed no damage, correct unit, functioning door/lock and complete undamaged existing
belongings. All four items must pass. Damage or missing belongings blocks completion even
with a note or photo; there is no bypass. Notes, photos and signatures are optional.
If the assigned unit has no existing belongings, staff can record PASS after checking this
and optionally note that there are none. No predefined inventory is invented by this policy;
issue #24 must present the assigned unit's actual inventory/baseline where available.
H6 is resolved by this documented decision; updating/closing the GitHub issue is separate.

## Implemented contract

`@metastorage/contracts` exports the item definition and result schemas, together with
`createHandoverChecklistCompletionSchema(definitions)`. The confirmed list is exported as
`HANDOVER_CHECKLIST_ITEMS`, its version as `HANDOVER_CHECKLIST_VERSION` and its completion
validator as `HandoverChecklistCompletionSchema`. UI and API must use those same definitions.
Item codes must be unique and definitions must be nonempty.

- PASS_FAIL accepts PASS or FAIL; TEXT accepts nonblank text; NUMBER accepts finite
  numbers without string coercion. Numbers have no domain-specific range until specified.
- Required items must have exactly one result. Unknown or duplicate item results are rejected.
- A must-pass item must be required and use PASS_FAIL. FAIL blocks completion even with a note.
- Failure notes must be nonblank when the definition requests them.
- When photos are required, at least one nonblank reference is necessary. This is shape
  validation; issue #24 must verify attachment existence and access on the server.
- Optional items may be omitted; supplied optional results must still be valid.
- Draft inspections may be incomplete. Use completion validation only when submitting
  a checklist as complete; do not use it to block draft saves.

## Integration boundary for issue #24

Issue #24 must enforce booking verification, assigned physical unit and staff facility
authorization before starting inspection. Passing this contract alone does not authorize
handover. Persist the actual results and the definition version/snapshot so later return
inspection uses the same baseline even if the checklist evolves. Define database storage,
transaction boundaries and API endpoints as part of issue #24.

No inspection tables, endpoint, camera upload or signature workflow are introduced here.

## Backend integration update (2026-10-17)

Inspection draft requests accept optional `results` using the existing item result shape.
Incomplete/FAIL results can be saved; duplicate/unknown codes and incorrect result types
are rejected. Completion requires all four PASS results, without mandatory photos/notes.
New inspections store `checklistVersion = H6_4PASS_V1`, the definition snapshot and actual
results. This separate version distinguishes the former implementation's H6_V1 baseline.
Legacy metadata remains NULL; no historical results are invented. Explicitly saving results
on a legacy draft adopts the new metadata, while completed historical records remain immutable.
The old `correctUnit` response is retained and derived from ASSIGNED_UNIT when results exist.
Photo references in results must belong to the same inspection. Snapshot/results are frozen
at completion. Existing authorization, version locks and separate handover remain in force.
At the time of this backend change, frontend integration was pending.

## Frontend integration update (2026-10-20)

The frontend now submits and reloads all four explicit checklist results, preserves FAIL
or incomplete drafts, and enables completion only when the shared completion contract
accepts four PASS results. Notes and photos remain optional. Review, handover and FM
read-only screens display the saved results; legacy records never infer missing PASS
values. Inspection completion and final customer handover remain separate actions.
