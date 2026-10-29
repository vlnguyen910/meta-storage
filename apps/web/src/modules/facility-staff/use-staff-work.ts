"use client";
import type { FacilityTaskDetail } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { isMockMode } from "@/config/api-mode";
import { APPOINTMENTS_UI } from "@/features/appointments/appointments.messages";
import { useAuthStore } from "@/features/auth/auth-store";
import { bookingKeys } from "@/features/check-in/hooks";
import { useManagementKey } from "@/features/facility-management/hooks";
import { api } from "@/lib/api";
import { facilityWork } from "./staff-work.data";
import { STAFF_WORK as M } from "./staff-work.messages";
import type { StaffWorkFilters } from "./staff-work.types";

export function useStaffWork(facilityId: string, date: string, kind: StaffWorkFilters["kind"]) {
  const actorId = useAuthStore((s) => s.session?.user.id);
  const key = useManagementKey();
  const bookings = useQuery({
    queryKey: [...bookingKeys.staffTasks(facilityId), actorId, date],
    queryFn: () => api.appointments.assignedToMe({ facilityId }),
    enabled: kind !== "TASK" && Boolean(facilityId && actorId),
    refetchInterval: 30_000,
  });
  const tasks = useQuery({
    queryKey: [...key, "staff-work", facilityId],
    queryFn: async ({ signal }) => {
      const items: FacilityTaskDetail[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.tasks.listMine({ limit: 100, offset }, signal);
        items.push(...page.items);
        if (offset + page.items.length >= page.total) break;
        if (!page.items.length) throw new Error(M.loadError);
      }
      return [...new Map(items.map((item) => [item.id, item])).values()];
    },
    enabled: kind !== "CHECK_IN" && Boolean(facilityId && actorId) && !isMockMode,
    refetchInterval: 30_000,
  });
  const queries = [
    ...(kind !== "TASK" ? [bookings] : []),
    ...(kind !== "CHECK_IN" && !isMockMode ? [tasks] : []),
  ];
  return {
    items: [
      ...(kind !== "TASK"
        ? (bookings.data ?? [])
            .filter(
              (item) =>
                item.assignedStaffId === actorId &&
                item.facilityId === facilityId &&
                (date === "all" || item.scheduledDate === date),
            )
            .map((item): import("./staff-work.types").StaffWorkItem => ({
              id: `appointment:${item.id}`,
              kind: item.appointmentType === "CHECK_IN" ? "CHECK_IN" : "TASK",
              group:
                item.status === "COMPLETED"
                  ? "done"
                  : ["CANCELLED", "NO_SHOW"].includes(item.status)
                    ? "closed"
                    : "pending",
              title: item.customerName ?? item.customerId,
              typeLabel: APPOINTMENTS_UI.types[item.appointmentType] ?? item.appointmentType,
              statusLabel: APPOINTMENTS_UI.statuses[item.status] ?? item.status,
              reference: item.reservationId ?? item.id,
              startsAt: `${item.scheduledDate}T${item.slotStart ?? "00:00:00"}+07:00`,
              href: `/staff/check-in?appointmentId=${item.id}`,
              action: M.openTask,
            }))
        : []),
      ...(kind !== "CHECK_IN" && !isMockMode
        ? (tasks.data ?? [])
            .filter(
              (t) =>
                t.assignedStaffId === actorId &&
                t.facilityId === facilityId &&
                t.referenceType !== "APPOINTMENT",
            )
            .map(facilityWork)
        : []),
    ],
    pending: queries.some((q) => q.isPending),
    error: queries.some((q) => q.isError),
    refreshing: queries.some((q) => q.isFetching),
    refresh: () => Promise.all(queries.map((q) => q.refetch())),
  };
}
