import type {
  BookingListItem,
  FacilityTaskDetail,
  ReturnQueueItemDto,
} from "@metastorage/contracts";
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
export function bookingWork(b: BookingListItem): StaffWorkItem {
  const done = b.status === "CHECKED_IN";
  const closed = ["CANCELLED", "NO_SHOW"].includes(b.status);
  const inspecting = b.handoverStage === "INSPECTING";
  const handingOver = b.handoverStage === "READY_HANDOVER" || done;
  return {
    id: `booking:${b.id}`,
    kind: "CHECK_IN",
    group: done ? "done" : closed ? "closed" : "pending",
    title: M.receiving(b.contactName),
    typeLabel: M.checkIn,
    statusLabel: done
      ? M.received
      : b.status === "CANCELLED"
        ? M.cancelled
        : b.status === "NO_SHOW"
          ? M.noShow
          : !b.paidAt
            ? M.waitingPayment
            : !b.assignedUnit
              ? M.waitingManager
              : inspecting || handingOver
                ? M.inProgress
                : M.waitingCustomer,
    reference: [b.bookingCode, b.assignedUnit?.physicalUnitCode].filter(Boolean).join(" · "),
    startsAt: b.checkInSlotStart || null,
    href: `/staff/check-in?bookingCode=${encodeURIComponent(b.bookingCode)}${handingOver ? "&view=handover" : inspecting ? "&view=inspect" : ""}`,
    action:
      done || closed
        ? M.view
        : handingOver
          ? M.handover
          : inspecting
            ? M.continueInspect
            : M.startCheckIn,
  };
}
export function facilityWork(t: FacilityTaskDetail): StaffWorkItem {
  return {
    id: `task:${t.id}`,
    kind: "TASK",
    group: t.status === "COMPLETED" ? "done" : t.status === "CANCELLED" ? "closed" : "pending",
    title: t.description ?? t.referenceId,
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
    reference: "",
    startsAt: null,
    href: `/staff/tasks/${encodeURIComponent(t.id)}`,
    action: t.status === "COMPLETED" || t.status === "CANCELLED" ? M.view : M.openTask,
  };
}
export function returnWork(r: ReturnQueueItemDto): StaffWorkItem {
  const done = r.status === "COMPLETED",
    closed = r.status === "CANCELLED";
  return {
    id: `return:${r.id}`,
    kind: "RETURN",
    group: done ? "done" : closed ? "closed" : "pending",
    title: M.returning(r.context.customer.name ?? r.context.unit.code),
    typeLabel: M.return,
    statusLabel: done
      ? M.complete
      : closed
        ? M.cancelled
        : r.status === "INSPECTING"
          ? M.inProgress
          : r.status === "FAILED"
            ? M.returnFailed
            : r.status === "PENDING"
              ? M.returnAwaitingManager
              : M.assigned,
    reference: [r.context.booking.bookingCode, r.context.unit.code].filter(Boolean).join(" · "),
    startsAt: r.startsAt,
    href: `/staff/returns/${encodeURIComponent(r.id)}`,
    action: done || closed ? M.view : M.inspectReturn,
  };
}
