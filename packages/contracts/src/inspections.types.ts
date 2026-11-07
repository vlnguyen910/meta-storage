import type {
  HandoverChecklistItemDefinition,
  HandoverChecklistItemResult,
} from "./handover-checklist";

export interface InspectionChecklistData {
  results?: HandoverChecklistItemResult[] | null;
  checklistVersion?: string | null;
  checklistDefinition?: HandoverChecklistItemDefinition[] | null;
}
