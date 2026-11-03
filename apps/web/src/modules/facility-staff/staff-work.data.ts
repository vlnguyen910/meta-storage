import type { FacilityTaskDetail } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { STAFF_WORK as M } from "./staff-work.messages";
import type { StaffWorkItem } from "./staff-work.types";

export function staffWorkDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function facilityWork(t: FacilityTaskDetail): StaffWorkItem {
  return {
    id: `task:${t.id}`,
    kind: "TASK",
    group: t.status === "COMPLETED" ? "done" : t.status === "CANCELLED" ? "closed" : "pending",
    title: t.description || M.inspect,
    typeLabel: {
      CHECK_IN_HANDOVER: M.checkIn,
      UNIT_INSPECTION: M.inspect,
      HANDLE_SUPPORT: M.report,
    }[t.type],
    statusLabel: {
      ASSIGNED: M.assigned,
      IN_PROGRESS: M.inProgress,
      COMPLETED: M.complete,
      CANCELLED: M.cancelled,
    }[t.status],
    reference: formatReference(t.id, "CV"),
    startsAt: null,
    href: `/staff/tasks/${encodeURIComponent(t.id)}`,
    action: t.status === "COMPLETED" || t.status === "CANCELLED" ? M.view : M.openTask,
  };
}
