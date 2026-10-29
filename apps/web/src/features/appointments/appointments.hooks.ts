"use client";
import type { FacilityTaskDetail, UpdateInspectionInput } from "@metastorage/contracts";
import {
  FacilityTaskStatus,
  INSPECTION_PHOTO_MAX_BYTES,
  StorageUnitStatus,
} from "@metastorage/contracts";
import { APPOINTMENT_STATUSES } from "@metastorage/database/schema/appointments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { readFileBase64 } from "@/features/returns/integration-utils";
import { api } from "@/lib/api";
import { APPOINTMENTS_UI as m } from "./appointments.messages";

export function useAppointmentList(facilityId: string, manager: boolean) {
  const owner = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const appointments = useQuery({
    queryKey: ["appointments", owner, facilityId, manager],
    queryFn: () =>
      manager
        ? api.appointments.listFacility(facilityId)
        : api.appointments.assignedToMe({ facilityId }),
    enabled: Boolean(facilityId && owner),
    refetchInterval: 15000,
  });
  const staff = useQuery({
    queryKey: ["appointment-staff", owner, facilityId],
    queryFn: () => api.facilities.getStaff(facilityId),
    enabled: manager && Boolean(facilityId && owner),
  });
  const update = useMutation({
    mutationFn: ({ id, staffId, cancel }: { id: string; staffId?: string; cancel?: boolean }) =>
      api.appointments.update(
        id,
        cancel
          ? { status: APPOINTMENT_STATUSES.CANCELLED }
          : { assignedStaffId: staffId, status: APPOINTMENT_STATUSES.CONFIRMED },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["appointments"] }),
  });
  return { appointments, staff, update };
}

export function useAppointmentCheckIn(id: string) {
  const owner = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const appointment = useQuery({
    queryKey: ["appointments", owner, id],
    queryFn: () => api.appointments.get(id),
    enabled: Boolean(id),
    refetchInterval: 15000,
  });
  const tasks = useQuery({
    queryKey: ["appointment-tasks", owner],
    queryFn: async () => {
      const items: FacilityTaskDetail[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.tasks.listMine({ limit: 100, offset });
        items.push(...page.items);
        if (offset + page.items.length >= page.total || !page.items.length) return items;
      }
    },
    enabled: Boolean(id),
  });
  const task = tasks.data?.find(
    (item) =>
      item.referenceType === "APPOINTMENT" &&
      item.referenceId === id &&
      item.status !== "CANCELLED",
  );
  const inspections = useQuery({
    queryKey: ["appointment-inspections", owner, id],
    queryFn: () => api.inspections.forAppointment(id),
    enabled: Boolean(id),
  });
  const record = inspections.data?.find((item) => item.taskId === task?.id);
  const context = appointment.data;
  const units = useQuery({
    queryKey: ["appointment-units", owner, context?.facilityId, context?.reservation?.unitTypeId],
    queryFn: async () => {
      if (!context?.reservation) return [];
      const items: import("@metastorage/contracts").StorageUnitDetail[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.units.list({
          facilityId: context.facilityId,
          unitTypeId: context.reservation.unitTypeId,
          status: StorageUnitStatus.AVAILABLE,
          limit: 100,
          offset,
        });
        items.push(...page.items);
        if (offset + page.items.length >= page.total || !page.items.length) return items;
      }
    },
    enabled: Boolean(context?.reservation) && !record,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["appointments"] }),
      client.invalidateQueries({ queryKey: ["appointment-tasks"] }),
      client.invalidateQueries({ queryKey: ["appointment-inspections"] }),
      client.invalidateQueries({ queryKey: ["staff-work"] }),
    ]);
  };
  const start = useMutation({
    mutationFn: () => {
      if (!task) throw new Error(m.noTask);
      return api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
    },
    onSuccess: refresh,
  });
  const inspect = useMutation({
    mutationFn: (storageUnitId: string) => {
      if (!task) throw new Error(m.noTask);
      return api.inspections.create({ taskId: task.id, storageUnitId });
    },
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: (input: UpdateInspectionInput) => api.inspections.save(record?.id ?? "", input),
    onSuccess: refresh,
  });
  const handover = useMutation({
    mutationFn: () => api.inspections.handover(record?.id ?? "", { customerReceivedUnit: true }),
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (
        file.size > INSPECTION_PHOTO_MAX_BYTES ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error(m.invalidPhoto);
      return api.inspections.upload(record?.id ?? "", {
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: await readFileBase64(file),
      });
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
    inspections,
    record,
    units,
    start,
    inspect,
    save,
    handover,
    upload,
    removePhoto,
    refresh,
    busy:
      start.isPending ||
      inspect.isPending ||
      save.isPending ||
      handover.isPending ||
      upload.isPending ||
      removePhoto.isPending,
    error:
      appointment.error ??
      tasks.error ??
      inspections.error ??
      units.error ??
      start.error ??
      inspect.error ??
      save.error ??
      handover.error ??
      upload.error ??
      removePhoto.error,
  };
}
