import type {
  HandoverChecklistItemDefinition,
  HandoverChecklistItemResult,
} from "@metastorage/contracts";

export interface InspectionChecklistProps {
  items: readonly HandoverChecklistItemDefinition[];
  results: HandoverChecklistItemResult[];
  disabled?: boolean;
  onChange?: (code: string, result: "PASS" | "FAIL" | null) => void;
  onNoteChange?: (code: string, note: string) => void;
}
