import type { FacilitySupportTicket, FacilityTaskDetail } from "@metastorage/contracts";
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

export function supportWork(
  t: FacilityTaskDetail,
  ticket?: FacilitySupportTicket | null,
): StaffWorkItem {
  const isClosed =
    ticket?.status === "CLOSED" || ticket?.closedAt !== null || t.status === "COMPLETED";
  const title = ticket
    ? `${ticket.customer.name} · ${ticket.subject}`
    : t.description || M.supportTasksTitle;
  const reference = ticket?.unitCode
    ? `${ticket.unitCode} · ${formatReference(ticket.id, "YC")}`
    : formatReference(t.referenceId, "YC");
  return {
    id: `task:${t.id}`,
    kind: "SUPPORT",
    group: isClosed ? "done" : t.status === "CANCELLED" ? "closed" : "pending",
    title,
    phone: ticket?.customer.phone ?? null,
    typeLabel: M.supportTasksTitle,
    statusLabel:
      {
        ASSIGNED: M.assigned,
        IN_PROGRESS: M.inProgress,
        COMPLETED: M.complete,
        CANCELLED: M.cancelled,
      }[t.status] ?? t.status,
    reference,
    startsAt: ticket?.createdAt ?? t.createdAt,
    href: `/staff/tasks/${encodeURIComponent(t.id)}`,
    action: isClosed || t.status === "CANCELLED" ? M.view : M.openTask,
  };
}

export function facilityWork(t: FacilityTaskDetail): StaffWorkItem {
  if (t.type === "HANDLE_SUPPORT" || t.referenceType === "SUPPORT_TICKET") {
    return supportWork(t);
  }
  const typeLabel =
    t.type === "UNIT_INSPECTION" && t.referenceType === "APPOINTMENT"
      ? M.inspectReturn
      : {
          CHECK_IN_HANDOVER: M.checkIn,
          RETURN_INSPECTION: M.inspectReturn,
          UNIT_INSPECTION: M.inspect,
          HANDLE_SUPPORT: M.supportTasksTitle,
        }[t.type];
  return {
    id: `task:${t.id}`,
    kind: "TASK",
    group: t.status === "COMPLETED" ? "done" : t.status === "CANCELLED" ? "closed" : "pending",
    title: t.description || M.inspect,
    typeLabel,
    statusLabel:
      {
        ASSIGNED: M.assigned,
        IN_PROGRESS: M.inProgress,
        COMPLETED: M.complete,
        CANCELLED: M.cancelled,
      }[t.status] ?? t.status,
    reference: formatReference(t.id, "CV"),
    startsAt: null,
    href: `/staff/tasks/${encodeURIComponent(t.id)}`,
    action: t.status === "COMPLETED" || t.status === "CANCELLED" ? M.view : M.openTask,
  };
}
