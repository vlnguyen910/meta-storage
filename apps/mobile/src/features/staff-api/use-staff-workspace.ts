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
    queryFn: () => api.appointments.assignedToMe({ facilityId: facility?.facilityId }),
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
      .filter((b) => b.assignedStaffId === owner && b.facilityId === facility?.facilityId)
      .map((booking): StaffSelection => ({ kind: "appointment", appointment: booking })),
    ...(tasks.data?.pages.flatMap((p) => p.items) ?? [])
      .filter(
        (t) =>
          t.assignedStaffId === owner &&
          t.facilityId === facility?.facilityId &&
          t.referenceType !== "APPOINTMENT",
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
export function useStaffCheckIn(owner: string, appointmentId: string) {
  const client = useQueryClient();
  const appointment = useQuery({
    queryKey: ["mobile-appointments", owner, appointmentId],
    queryFn: () => api.appointments.get(appointmentId),
    refetchInterval: 15000,
  });
  const tasks = useQuery({
    queryKey: ["mobile-appointment-tasks", owner, appointmentId],
    queryFn: async () => {
      const items: FacilityTaskDetail[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.tasks.listMine({
          referenceId: appointmentId,
          limit: 100,
          offset,
        });
        items.push(...page.items);
        if (offset + page.items.length >= page.total || !page.items.length) return items;
      }
    },
  });
  const task = tasks.data?.find(
    (item) =>
      item.referenceType === "APPOINTMENT" &&
      item.referenceId === appointmentId &&
      item.status !== "CANCELLED",
  );
  const history = useQuery({
    queryKey: ["mobile-inspection", owner, appointmentId],
    queryFn: () => api.inspections.forAppointment(appointmentId),
  });
  const record = history.data?.find((item) => item.taskId === task?.id);
  const refresh = async () => {
    await Promise.all([
      appointment.refetch(),
      tasks.refetch(),
      history.refetch(),
      client.invalidateQueries({ queryKey: ["mobile-staff-bookings", owner] }),
      client.invalidateQueries({ queryKey: ["mobile-staff-tasks", owner] }),
    ]);
  };
  const begin = useMutation({
    mutationFn: () => {
      if (!task) throw new Error(M.taskNotFound);
      return api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
    },
    onSuccess: refresh,
  });
  const start = useMutation({
    mutationFn: (storageUnitId: string) => {
      if (!task) throw new Error(M.taskNotFound);
      return api.inspections.create({ taskId: task.id, storageUnitId });
    },
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: (input: import("@metastorage/contracts").UpdateInspectionInput) =>
      api.inspections.save(record?.id ?? "", input),
    onSuccess: refresh,
  });
  const photo = useMutation({
    mutationFn: async (camera: boolean) => {
      const input = await pickImage(camera);
      return input ? api.inspections.upload(record?.id ?? "", input) : null;
    },
    onSuccess: refresh,
  });
  const removePhoto = useMutation({
    mutationFn: (id: string) => api.inspections.removePhoto(record?.id ?? "", id),
    onSuccess: refresh,
  });
  const handover = useMutation({
    mutationFn: () => api.inspections.handover(record?.id ?? "", { customerReceivedUnit: true }),
    onSuccess: refresh,
  });
  return {
    appointment,
    tasks,
    task,
    history,
    record,
    begin,
    start,
    save,
    photo,
    removePhoto,
    handover,
    refresh,
    busy:
      begin.isPending ||
      start.isPending ||
      save.isPending ||
      photo.isPending ||
      removePhoto.isPending ||
      handover.isPending,
    error:
      appointment.error ??
      tasks.error ??
      history.error ??
      begin.error ??
      start.error ??
      save.error ??
      photo.error ??
      removePhoto.error ??
      handover.error,
  };
}
