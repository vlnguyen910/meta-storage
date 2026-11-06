import type { AppointmentRecordDto, FacilityTaskDetail } from "@metastorage/contracts";
/** @lintignore Retained for archived screens in screens/old/ until their cleanup. */
export interface StaffWorkspaceProps {
  owner: string;
  name: string;
  onHome?: () => void;
}
export type StaffSelection =
  | { kind: "appointment"; appointment: AppointmentRecordDto }
  | { kind: "task"; task: FacilityTaskDetail };
export type StaffWorkGroup = "pending" | "done" | "closed";
export interface StaffWorkFilters {
  group: StaffWorkGroup;
  kind: "all" | "return" | StaffSelection["kind"];
  search: string;
  date: string;
}
