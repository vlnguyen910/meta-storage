import { formatReference } from "@metastorage/shared";
import { STAFF_API_UI as M } from "./staff-api.messages";
import type { StaffSelection, StaffWorkFilters, StaffWorkGroup } from "./staff-api.types";

export function staffWorkDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function staffWorkGroup(item: StaffSelection): StaffWorkGroup {
  const status = item.kind === "appointment" ? item.appointment.status : item.task.status;
  return ["CHECKED_IN", "COMPLETED"].includes(status)
    ? "done"
    : ["CANCELLED", "NO_SHOW"].includes(status)
      ? "closed"
      : "pending";
}
export function staffWorkScheduledAt(item: StaffSelection): string | null {
  return item.kind === "appointment"
    ? `${item.appointment.scheduledDate}T${item.appointment.slotStart ?? "00:00:00"}+07:00`
    : null;
}
function inProgress(item: StaffSelection) {
  return item.kind === "appointment"
    ? item.appointment.status === "CONFIRMED"
    : item.task.status === "IN_PROGRESS";
}
export function filterStaffWork(items: StaffSelection[], filters: StaffWorkFilters) {
  const matching = items.filter((item) => {
    if (filters.kind !== "all" && item.kind !== filters.kind) return false;
    const date = staffWorkScheduledAt(item);
    if (filters.date && date && staffWorkDate(date) !== filters.date) return false;
    const text =
      item.kind === "appointment"
        ? `${item.appointment.customerName ?? ""} ${item.appointment.id} ${item.appointment.contactPhone ?? ""} ${item.appointment.assignedUnit?.physicalUnitCode ?? ""} ${formatReference(item.appointment.reservationId ?? item.appointment.id, item.appointment.reservationId ? "BK" : "LH")}`
        : `${item.task.description ?? ""} ${M.type[item.task.type] ?? ""}`;
    return text.toLocaleLowerCase("vi").includes(filters.search.trim().toLocaleLowerCase("vi"));
  });
  const counts: Record<StaffWorkGroup, number> = { pending: 0, done: 0, closed: 0 };
  for (const item of matching) counts[staffWorkGroup(item)]++;
  const visible = matching.filter((item) => staffWorkGroup(item) === filters.group);
  visible.sort((left, right) => {
    if (filters.group === "pending") {
      const priority = Number(inProgress(right)) - Number(inProgress(left));
      if (priority) return priority;
    }
    const leftDate = staffWorkScheduledAt(left),
      rightDate = staffWorkScheduledAt(right);
    return (
      (leftDate ? Date.parse(leftDate) : Number.POSITIVE_INFINITY) -
      (rightDate ? Date.parse(rightDate) : Number.POSITIVE_INFINITY)
    );
  });
  return { items: visible, counts };
}
