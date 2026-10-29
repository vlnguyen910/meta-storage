import { type FacilityTaskDetail, FacilityTaskStatus } from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "../../lib/api";
import { pickImage } from "../../lib/pick-image";
import { STAFF_API_UI as M } from "./staff-api.messages";
import type { StaffSelection, StaffWorkFilters } from "./staff-api.types";
import { filterStaffWork, staffWorkDate } from "./staff-work.helpers";

export function staffError(error: unknown): string {
  if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500))
    return M.error;
  return axios.isAxiosError(error)
    ? (error.response?.data?.error?.message ?? M.error)
    : error instanceof Error
      ? error.message
      : M.error;
}

export const staffDate = staffWorkDate;
export function useStaffWorkspace(owner: string, filters: StaffWorkFilters) {
  const assignments = useQuery({
    queryKey: ["mobile-staff-assignments", owner],
    queryFn: () => api.facilities.myAssignments(),
  });
  const facility = assignments.data?.find((item) => item.isActive && !item.endedAt);
  const bookings = useQuery({
    queryKey: ["mobile-staff-bookings", owner, facility?.facilityId, filters.date],
    queryFn: () =>
      api.bookings.listAssignedToMe(
        facility?.facilityId,
        filters.date
          ? { fromDate: filters.date, toDate: filters.date }
          : { fromDate: "0001-01-01", toDate: "9999-12-31" },
      ),
    enabled: Boolean(facility),
    refetchInterval: 30000,
  });
  const tasks = useInfiniteQuery({
    queryKey: ["mobile-staff-tasks", owner],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.flow5.tasks.listMine({ limit: 20, offset: pageParam }, signal),
    getNextPageParam: (page) =>
      page.offset + page.items.length < page.total ? page.offset + page.items.length : undefined,
    enabled: Boolean(facility),
    refetchInterval: 30000,
  });
  const bookingItems = bookings.data ?? [];
  const items: StaffSelection[] = [
    ...bookingItems
      .filter((b) => b.assignedStaff?.id === owner && b.facilityId === facility?.facilityId)
      .map((booking): StaffSelection => ({ kind: "booking", booking })),
    ...(tasks.data?.pages.flatMap((p) => p.items) ?? [])
      .filter(
        (t) =>
          t.assignedStaffId === owner &&
          t.facilityId === facility?.facilityId &&
          !(t.type === "CHECK_IN_HANDOVER" && bookingItems.some((b) => b.id === t.referenceId)),
      )
      .map((task): StaffSelection => ({ kind: "task", task })),
  ];
  const filtered = filterStaffWork(items, filters);
  return {
    assignments,
    facility,
    bookings,
    tasks,
    returnsUnavailable: true,
    items: filtered.items,
    counts: filtered.counts,
    hasMore: tasks.hasNextPage,
    pending:
      assignments.isPending || (Boolean(facility) && (bookings.isPending || tasks.isPending)),
    error: assignments.error ?? bookings.error ?? tasks.error,
    refreshing: assignments.isRefetching || bookings.isRefetching || tasks.isRefetching,
    refresh: () =>
      Promise.all([
        assignments.refetch(),
        ...(facility ? [bookings.refetch(), tasks.refetch()] : []),
      ]),
    more: () => Promise.all([...(tasks.hasNextPage ? [tasks.fetchNextPage()] : [])]),
  };
}

export function useStaffTaskAction(owner: string, task: FacilityTaskDetail) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: "IN_PROGRESS" | "COMPLETED") =>
      api.flow5.tasks.update(task.id, { status: FacilityTaskStatus[status] }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["mobile-staff-tasks", owner] }),
  });
}
export function useStaffCheckIn(owner: string, bookingCode: string) {
  const client = useQueryClient();
  const lookup = useQuery({
    queryKey: ["mobile-check-in", owner, bookingCode],
    queryFn: () => api.bookings.checkInLookup({ type: "BOOKING_CODE", value: bookingCode }),
    retry: false,
  });
  const bookingId = lookup.data?.booking.id ?? "";
  const tasks = useQuery({
    queryKey: ["mobile-staff-tasks", owner],
    queryFn: () => api.flow5.tasks.listMine({ limit: 100, offset: 0 }),
    enabled: Boolean(bookingId),
  });
  const task = tasks.data?.items.find(
    (item) => item.referenceType === "BOOKING" && item.referenceId === bookingId,
  );
  const verified = task?.status === "IN_PROGRESS" || task?.status === "COMPLETED";
  const historyKey = ["mobile-inspection", owner, bookingId];
  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => api.inspections.history(bookingId),
    enabled: Boolean(bookingId && verified),
  });
  const record = history.data?.find(
    (item) =>
      item.storageUnitId === lookup.data?.assignedUnit?.physicalUnitId &&
      item.inspectionType === "CHECK_IN",
  );
  const begin = useMutation({
    mutationFn: () => {
      if (!task) throw new Error(M.taskNotFound);
      return api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
    },
    onSuccess: async () => {
      await Promise.all([tasks.refetch(), history.refetch()]);
      await client.invalidateQueries({ queryKey: ["mobile-staff-tasks", owner] });
    },
  });
  const start = useMutation({
    mutationFn: () => api.inspections.start(bookingId),
    onSuccess: () => history.refetch(),
  });
  const save = useMutation({
    mutationFn: (input: import("@metastorage/contracts").UpdateInspectionInput) =>
      api.inspections.save(record?.id ?? "", input),
    onSuccess: () => history.refetch(),
  });
  const photo = useMutation({
    mutationFn: async (camera: boolean) => {
      const input = await pickImage(camera);
      return input ? api.inspections.upload(record?.id ?? "", input) : null;
    },
    onSuccess: () => history.refetch(),
  });
  const removePhoto = useMutation({
    mutationFn: (id: string) => api.inspections.removePhoto(record?.id ?? "", id),
    onSuccess: () => history.refetch(),
  });
  const handover = useMutation({
    mutationFn: () => api.inspections.handover(record?.id ?? "", { customerReceivedUnit: true }),
    onSuccess: async () => {
      await Promise.all([
        lookup.refetch(),
        history.refetch(),
        client.invalidateQueries({ queryKey: ["mobile-staff-bookings", owner] }),
      ]);
    },
  });
  return {
    lookup,
    tasks,
    history,
    record,
    verified,
    begin,
    start,
    save,
    handover,
    photo,
    removePhoto,
    busy:
      begin.isPending ||
      start.isPending ||
      save.isPending ||
      handover.isPending ||
      photo.isPending ||
      removePhoto.isPending,
    error:
      lookup.error ??
      history.error ??
      tasks.error ??
      begin.error ??
      start.error ??
      save.error ??
      handover.error ??
      photo.error ??
      removePhoto.error,
  };
}
