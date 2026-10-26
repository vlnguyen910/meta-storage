"use client";
import type { FacilityTaskDetail } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { bookingKeys } from "@/features/check-in/hooks";
import { useManagementKey } from "@/features/facility-management/hooks";
import { api } from "@/lib/api";
import { bookingWork, facilityWork } from "./staff-work.data";
import { STAFF_WORK as M } from "./staff-work.messages";
import type { StaffWorkFilters } from "./staff-work.types";

export function useStaffWork(facilityId: string, date: string, kind: StaffWorkFilters["kind"]) {
  const actorId = useAuthStore((s) => s.session?.user.id);
  const key = useManagementKey();
  const bookings = useQuery({
    queryKey: [...bookingKeys.staffTasks(facilityId), actorId, date],
    queryFn: () =>
      api.bookings.listAssignedToMe(
        facilityId,
        date === "all"
          ? { fromDate: "0001-01-01", toDate: "9999-12-31" }
          : { fromDate: date, toDate: date },
      ),
    enabled: kind !== "TASK" && Boolean(facilityId && actorId),
    refetchInterval: 30_000,
  });
  const tasks = useQuery({
    queryKey: [...key, "staff-work", facilityId],
    queryFn: async ({ signal }) => {
      const items: FacilityTaskDetail[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.tasks.list(
          { facilityId, assignedStaffId: actorId, limit: 100, offset },
          signal,
        );
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
            .filter((b) => b.assignedStaff?.id === actorId && b.facilityId === facilityId)
            .map(bookingWork)
        : []),
      ...(kind !== "CHECK_IN" && !isMockMode
        ? (tasks.data ?? [])
            .filter((t) => t.assignedStaffId === actorId && t.facilityId === facilityId)
            .map(facilityWork)
        : []),
    ],
    pending: queries.some((q) => q.isPending),
    error: queries.some((q) => q.isError),
    refreshing: queries.some((q) => q.isFetching),
    refresh: () => Promise.all(queries.map((q) => q.refetch())),
  };
}
