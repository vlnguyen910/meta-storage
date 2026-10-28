import type { BookingListItem, FacilityTaskDetail } from "@metastorage/contracts";
export interface StaffWorkspaceProps {
  owner: string;
  name: string;
  onHome?: () => void;
}
export type StaffSelection =
  | { kind: "booking"; booking: BookingListItem }
  | { kind: "task"; task: FacilityTaskDetail };
export type StaffWorkGroup = "pending" | "done" | "closed";
export interface StaffWorkFilters {
  group: StaffWorkGroup;
  kind: "all" | "return" | StaffSelection["kind"];
  search: string;
  date: string;
}
