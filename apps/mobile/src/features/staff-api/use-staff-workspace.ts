import {
  type FacilityTaskDetail,
  FacilityTaskStatus,
  FacilityTaskType,
  INSPECTION_PHOTO_MAX_COUNT,
  type UpdateInspectionInput,
} from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef } from "react";
import { apiErrorDetailMessage } from "../../common/api-error.utils";
import type { StaffSelection, StaffWorkFilters } from "../../common/staff-api.types";
import { filterStaffWork } from "../../common/staff-work.utils";
import { api } from "../../lib/api";
import { pickImages } from "../../lib/pick-image";
import { onStaffTaskAssigned } from "../realtime/staff-assignment-events";
import { STAFF_API_UI as M } from "./staff-api.messages";

export function staffError(error: unknown): string {
  if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500))
    return M.error;
  return axios.isAxiosError(error)
    ? (apiErrorDetailMessage(error) ?? error.response?.data?.error?.message ?? M.error)
    : error instanceof Error
      ? error.message
      : M.error;
}
export function useStaffWorkspace(owner: string, filters: StaffWorkFilters) {
  const assignments = useQuery({
    queryKey: ["mobile-staff-assignments", owner],
    queryFn: () => api.facilities.myAssignments(),
  });
  const facility = assignments.data?.find((item) => item.isActive && !item.endedAt);
  const bookings = useQuery({
    queryKey: ["mobile-staff-bookings", owner, facility?.facilityId],
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

/** Calls `onAssigned` for each task-assignment event pushed over the notification socket. */
export function useStaffAssignmentAlert(onAssigned: () => void) {
  const callback = useRef(onAssigned);
  callback.current = onAssigned;
  useEffect(() => onStaffTaskAssigned(() => callback.current()), []);
}

export function useStaffTaskAction(owner: string, task: FacilityTaskDetail) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: "IN_PROGRESS" | "COMPLETED") =>
      api.flow5.tasks.update(task.id, { status: FacilityTaskStatus[status] }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["mobile-staff-tasks", owner] }),
        client.invalidateQueries({ queryKey: ["mobile-staff-task", owner, task.id] }),
      ]);
    },
  });
}
export function useStaffTaskDetail(owner: string, taskId: string) {
  return useQuery({
    queryKey: ["mobile-staff-task", owner, taskId],
    queryFn: ({ signal }) => api.flow5.tasks.getMine(taskId, signal),
    refetchInterval: 30_000,
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
  const record = history.data?.find(
    (item) =>
      item.taskId === task?.id &&
      (!appointment.data?.assignedUnit?.physicalUnitId ||
        item.storageUnitId === appointment.data.assignedUnit.physicalUnitId),
  );
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
      const maxPhotos = record?.maxEvidenceCount ?? INSPECTION_PHOTO_MAX_COUNT;
      const remaining = Math.max(0, maxPhotos - (record?.evidence.length ?? 0));
      if (remaining <= 0) return null;
      const inputs = await pickImages({ camera, limit: remaining });
      return inputs.length && record ? api.inspections.upload(record.id, inputs) : null;
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

export function useStaffReturn(owner: string, appointmentId: string) {
  const client = useQueryClient();
  const appointment = useQuery({
    queryKey: ["mobile-return-appointment", owner, appointmentId],
    queryFn: () => api.appointments.get(appointmentId),
    refetchInterval: 15000,
  });
  const tasks = useQuery({
    queryKey: ["mobile-return-tasks", owner, appointmentId],
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
      (item.type === FacilityTaskType.RETURN_INSPECTION ||
        item.type === FacilityTaskType.UNIT_INSPECTION) &&
      item.status !== FacilityTaskStatus.CANCELLED,
  );
  const history = useQuery({
    queryKey: ["mobile-return-inspections", owner, appointmentId],
    queryFn: () => api.inspections.forAppointment(appointmentId),
    enabled: appointment.data?.appointmentType === "CHECK_OUT",
  });
  const record = history.data?.find(
    (item) =>
      item.taskId === task?.id &&
      (!appointment.data?.assignedUnit?.physicalUnitId ||
        item.storageUnitId === appointment.data.assignedUnit.physicalUnitId),
  );
  const refresh = async () => {
    await Promise.all([
      appointment.refetch(),
      tasks.refetch(),
      history.refetch(),
      client.invalidateQueries({ queryKey: ["mobile-staff-bookings", owner] }),
      client.invalidateQueries({ queryKey: ["mobile-staff-tasks", owner] }),
    ]);
  };
  const start = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error(M.inspectionTaskUnavailable);
      if (task.status === FacilityTaskStatus.ASSIGNED)
        await api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
      return api.inspections.create({ taskId: task.id });
    },
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: (input: UpdateInspectionInput) => {
      if (!record) throw new Error(M.returnLoadError);
      return api.inspections.save(record.id, input);
    },
    onSuccess: refresh,
  });
  const photo = useMutation({
    mutationFn: async (camera: boolean) => {
      const maxPhotos = record?.maxEvidenceCount ?? INSPECTION_PHOTO_MAX_COUNT;
      const remaining = Math.max(0, maxPhotos - (record?.evidence.length ?? 0));
      if (remaining <= 0) return null;
      const inputs = await pickImages({ camera, limit: remaining });
      return inputs.length && record ? api.inspections.upload(record.id, inputs) : null;
    },
    onSuccess: refresh,
  });
  const removePhoto = useMutation({
    mutationFn: (id: string) => api.inspections.removePhoto(record?.id ?? "", id),
    onSuccess: refresh,
  });
  return {
    appointment,
    tasks,
    task,
    history,
    record,
    start,
    save,
    photo,
    removePhoto,
    refresh,
    busy: start.isPending || save.isPending || photo.isPending || removePhoto.isPending,
    error:
      appointment.error ??
      tasks.error ??
      history.error ??
      start.error ??
      save.error ??
      photo.error ??
      removePhoto.error,
  };
}

export function useStaffUnitInspection(owner: string, task: FacilityTaskDetail) {
  const client = useQueryClient();
  const inspectionKey = ["mobile-unit-inspection", owner, task.id];
  const recordQuery = useQuery({
    queryKey: inspectionKey,
    queryFn: () => api.inspections.create({ taskId: task.id }),
    enabled:
      task.status === FacilityTaskStatus.IN_PROGRESS ||
      task.status === FacilityTaskStatus.COMPLETED,
  });
  const refresh = async () => {
    await Promise.all([
      recordQuery.refetch(),
      client.invalidateQueries({ queryKey: ["mobile-staff-tasks", owner] }),
      client.invalidateQueries({ queryKey: ["mobile-staff-task", owner, task.id] }),
    ]);
  };
  const start = useMutation({
    mutationFn: async () => {
      if (task.status === FacilityTaskStatus.ASSIGNED)
        await api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
      return api.inspections.create({ taskId: task.id });
    },
    onSuccess: async (record) => {
      client.setQueryData(inspectionKey, record);
      await refresh();
    },
  });
  const save = useMutation({
    mutationFn: (input: UpdateInspectionInput) => {
      if (!recordQuery.data) throw new Error(M.inspectionTaskUnavailable);
      return api.inspections.save(recordQuery.data.id, input);
    },
    onSuccess: async (record) => {
      client.setQueryData(inspectionKey, record);
      await refresh();
    },
  });
  const photo = useMutation({
    mutationFn: async (camera: boolean) => {
      const maxPhotos = recordQuery.data?.maxEvidenceCount ?? INSPECTION_PHOTO_MAX_COUNT;
      const currentCount = recordQuery.data?.evidence.length ?? 0;
      const remaining = Math.max(0, maxPhotos - currentCount);
      if (remaining <= 0) return null;
      const inputs = await pickImages({ camera, limit: remaining });
      return inputs.length && recordQuery.data
        ? api.inspections.upload(recordQuery.data.id, inputs)
        : null;
    },
    onSuccess: async (record) => {
      if (record) client.setQueryData(inspectionKey, record);
      await refresh();
    },
  });
  const removePhoto = useMutation({
    mutationFn: (photoId: string) =>
      api.inspections.removePhoto(recordQuery.data?.id ?? "", photoId),
    onSuccess: async (record) => {
      client.setQueryData(inspectionKey, record);
      await refresh();
    },
  });
  return {
    record: recordQuery.data,
    isPending: recordQuery.isPending,
    error: recordQuery.error ?? start.error ?? save.error ?? photo.error ?? removePhoto.error,
    start,
    save,
    photo,
    removePhoto,
    busy: start.isPending || save.isPending || photo.isPending || removePhoto.isPending,
  };
}
