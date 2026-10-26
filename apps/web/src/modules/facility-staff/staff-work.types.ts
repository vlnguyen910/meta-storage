export type StaffWorkKind = "CHECK_IN" | "RETURN" | "TASK";
export type StaffWorkGroup = "pending" | "review" | "done" | "closed";
export interface StaffWorkItem {
  id: string;
  kind: StaffWorkKind;
  group: StaffWorkGroup;
  title: string;
  typeLabel: string;
  statusLabel: string;
  reference: string;
  startsAt: string | null;
  href: string;
  action: string;
}
export interface StaffWorkFilters {
  kind: "" | "CHECK_IN" | "TASK";
  date: string;
  group: StaffWorkGroup;
  search: string;
  page: number;
}
export interface StaffWorkRowProps {
  item: StaffWorkItem;
}
export interface StaffWorkContentProps {
  facilityId: string;
}
