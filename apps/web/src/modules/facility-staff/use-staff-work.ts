"use client";
import type { FacilityTaskDetail, ReturnQueueItemDto } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { bookingKeys } from "@/features/check-in/hooks";
import { useManagementKey } from "@/features/facility-management/hooks";
import { api } from "@/lib/api";
import { bookingWork, facilityWork, returnWork } from "./staff-work.data";
import { STAFF_WORK as M } from "./staff-work.messages";
import type { StaffWorkFilters } from "./staff-work.types";

export function useStaffWork(facilityId: string, date: string, kind: StaffWorkFilters["kind"]) {
  const actorId = useAuthStore((s) => s.session?.user.id);
  const key = useManagementKey();
  const loadBookings = kind === "" || kind === "CHECK_IN";
  const loadReturns = (kind === "" || kind === "RETURN") && !isMockMode;
  const loadTasks = (kind === "" || kind === "TASK") && !isMockMode;
  const bookings = useQuery({
    queryKey: [...bookingKeys.staffTasks(facilityId), actorId, date],
    queryFn: () =>
      api.bookings.listAssignedToMe(
        facilityId,
        date === "all"
          ? { fromDate: "0001-01-01", toDate: "9999-12-31" }
          : { fromDate: date, toDate: date },
      ),
    enabled: loadBookings && Boolean(facilityId && actorId),
    refetchInterval: 30_000,
  });
  const returns = useQuery({
    queryKey: [...key, "staff-returns", facilityId, actorId],
    queryFn: async () => {
      const items: ReturnQueueItemDto[] = [];
      for (let offset = 0; ; offset += 50) {
        const page = await api.returns.queue(facilityId, { limit: 50, offset });
        items.push(...page);
        if (page.length < 50) break;
      }
      return [...new Map(items.map((item) => [item.id, item])).values()];
    },
    enabled: loadReturns && Boolean(facilityId && actorId),
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
    enabled: loadTasks && Boolean(facilityId && actorId),
    refetchInterval: 30_000,
  });
  const queries = [
    ...(loadBookings ? [bookings] : []),
    ...(loadReturns ? [returns] : []),
    ...(loadTasks ? [tasks] : []),
  ];
  return {
    items: [
      ...(loadBookings
        ? (bookings.data ?? [])
            .filter((b) => b.assignedStaff?.id === actorId && b.facilityId === facilityId)
            .map(bookingWork)
        : []),
      ...(loadReturns
        ? (returns.data ?? [])
            .filter((r) => r.assignedStaffId === actorId && r.facilityId === facilityId)
            .map(returnWork)
        : []),
      ...(loadTasks
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
