"use client";

import type {
  ApiFacility,
  AssignFacilityTaskInput,
  CreateAssignmentBody,
  CreateFacilityBody,
  CreateFacilityTaskInput,
  CreateFacilityTaskReportInput,
  CreateStorageUnitInput,
  CreateUnitTypeInput,
  FacilityTaskListQuery,
  StorageUnitListQuery,
  StorageUnitMaintenanceTransition,
  UpdateFacilityBody,
  UpdateStorageUnitInput,
  UpdateUnitTypeInput,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { F5 } from "./management.messages";
import type { FacilityOption } from "./management.types";

export function managementError(error: unknown) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === "string") return message;
  }
  return F5.saveError;
}

async function allPages<T>(load: (offset: number) => Promise<T[]>) {
  const items: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await load(offset);
    items.push(...page);
    if (page.length < 100) return items;
  }
}

export function useManagementKey() {
  const actor = useAuthStore((state) => state.session?.user);
  return ["flow5", actor?.id, actor?.role] as const;
}

export function useFacilityOptions(global = false) {
  const key = useManagementKey();
  const [selected, select] = useState("");
  const query = useQuery({
    queryKey: [...key, "scope", global],
    enabled: !isMockMode,
    queryFn: async ({ signal }): Promise<FacilityOption[]> => {
      if (global)
        return allPages((offset) => api.flow5.facilities.list({ limit: 100, offset }, signal));
      const rows = await api.facilities.myAssignments();
      return rows
        .filter((row) => row.isActive)
        .map((row) => ({
          id: row.facilityId,
          name: row.facilityName ?? row.facilityId,
          code: row.facilityCode ?? "",
        }));
    },
  });
  const facilityId = query.data?.some((row) => row.id === selected)
    ? selected
    : (query.data?.[0]?.id ?? "");
  return { query, facilityId, select };
}

export function useAllFacilities() {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "all-facilities-list"],
    enabled: !isMockMode,
    queryFn: async ({ signal }): Promise<ApiFacility[]> => {
      return allPages((offset) => api.flow5.facilities.list({ limit: 100, offset }, signal));
    },
  });
}

export function useUnitInventory(query: StorageUnitListQuery) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "units", query],
    queryFn: ({ signal }) => api.flow5.units.list(query, signal),
    enabled: Boolean(query.facilityId) && !isMockMode,
  });
}
export function useUnitDetail(id: string) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "unit", id],
    queryFn: ({ signal }) => api.flow5.units.get(id, signal),
    enabled: Boolean(id) && !isMockMode,
  });
}
export function useMaintenanceHistory(id: string, offset: number) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "maintenance", id, offset],
    queryFn: ({ signal }) => api.flow5.units.history(id, offset, signal),
    enabled: Boolean(id) && !isMockMode,
  });
}
export function useFacilityTypeOptions(facilityId: string) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "available-types", facilityId],
    queryFn: () =>
      allPages((offset) => api.facilities.listUnitTypes(facilityId, { limit: 100, offset })),
    enabled: Boolean(facilityId) && !isMockMode,
  });
}
export function useFacilityTaskList(query: FacilityTaskListQuery) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "tasks", query],
    queryFn: ({ signal }) => api.flow5.tasks.list(query, signal),
    enabled: Boolean(query.facilityId) && !isMockMode,
    refetchInterval: 30_000,
  });
}
export function useFacilityTaskDetail(id: string) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "task", id],
    queryFn: ({ signal }) => api.flow5.tasks.get(id, signal),
    enabled: Boolean(id) && !isMockMode,
    refetchInterval: 30_000,
  });
}
export function useTaskReportHistory(id: string, offset: number) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "reports", id, offset],
    queryFn: ({ signal }) => api.flow5.tasks.reports(id, offset, signal),
    enabled: Boolean(id) && !isMockMode,
  });
}
export function useTaskStaff(facilityId: string, enabled = true) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "staff", facilityId],
    queryFn: () => api.facilities.getStaff(facilityId),
    enabled: Boolean(facilityId) && enabled && !isMockMode,
  });
}
export function useTaskUnitOptions(facilityId: string, enabled = true) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "task-units", facilityId],
    queryFn: ({ signal }) =>
      allPages((offset) =>
        api.flow5.units.list({ facilityId, limit: 100, offset }, signal).then((page) => page.items),
      ),
    enabled: Boolean(facilityId) && enabled && !isMockMode,
  });
}

function useFlow5Write<T, R>(write: (input: T) => Promise<R>) {
  const client = useQueryClient();
  const key = useManagementKey();
  return useMutation({
    mutationFn: write,
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["facilities"] }),
        client.invalidateQueries({ queryKey: ["bookings"] }),
        client.invalidateQueries({ queryKey: ["facility-flow"] }),
        client.invalidateQueries({ queryKey: ["pricing"] }),
        client.invalidateQueries({ queryKey: ["catalog"] }),
        client.invalidateQueries({ queryKey: ["unit-types"] }),
      ]);
    },
  });
}
export const useCreateUnit = (facilityId: string) =>
  useFlow5Write((input: CreateStorageUnitInput) => api.flow5.units.create(facilityId, input));
export const useUpdateUnit = (id: string) =>
  useFlow5Write((input: UpdateStorageUnitInput) => api.flow5.units.update(id, input));
export const useUnitMaintenance = (id: string) =>
  useFlow5Write((input: StorageUnitMaintenanceTransition) => api.flow5.units.transition(id, input));
export const useCreateTask = () =>
  useFlow5Write((input: CreateFacilityTaskInput) => api.flow5.tasks.create(input));
export const useAssignTask = (id: string) =>
  useFlow5Write((input: AssignFacilityTaskInput) => api.flow5.tasks.assign(id, input));
export const useReportTask = (id: string) =>
  useFlow5Write((input: CreateFacilityTaskReportInput) => api.flow5.tasks.report(id, input));
export const useStartTask = (id: string) => useFlow5Write(() => api.flow5.tasks.start(id));
export const useAcceptTaskReport = (id: string) =>
  useFlow5Write((reportId: string) => api.flow5.tasks.acceptReport(id, reportId));

export function useManagedFacility(id: string) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "facility", id],
    queryFn: ({ signal }) => api.flow5.facilities.get(id, signal),
    enabled: Boolean(id) && !isMockMode,
  });
}
export function useManagedTypes() {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "types"],
    queryFn: ({ signal }) =>
      allPages((offset) => api.flow5.unitTypes.list({ limit: 100, offset }, signal)),
    enabled: !isMockMode,
  });
}
export function useOfferings(id: string) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "offerings", id],
    queryFn: ({ signal }) =>
      allPages((offset) => api.flow5.facilities.offerings(id, offset, signal)),
    enabled: Boolean(id) && !isMockMode,
  });
}
export function useMemberships(id: string) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "memberships", id],
    queryFn: ({ signal }) =>
      allPages((offset) => api.flow5.facilities.assignments(id, offset, signal)),
    enabled: Boolean(id) && !isMockMode,
  });
}
export function useAssignableAccounts(enabled: boolean) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "accounts"],
    queryFn: ({ signal }) => allPages((offset) => api.flow5.accounts(offset, signal)),
    enabled: enabled && !isMockMode,
  });
}
export const useCreateFacility = () =>
  useFlow5Write((input: CreateFacilityBody) => api.flow5.facilities.create(input));
export const useUpdateFacility = (id: string) =>
  useFlow5Write((input: UpdateFacilityBody) => api.flow5.facilities.update(id, input));
export const useCreateType = () =>
  useFlow5Write((input: CreateUnitTypeInput) => api.flow5.unitTypes.create(input));
export const useUpdateType = (id: string) =>
  useFlow5Write((input: UpdateUnitTypeInput) => api.flow5.unitTypes.update(id, input));
export const useSetOffering = (id: string) =>
  useFlow5Write((input: { unitTypeId: string; isActive: boolean }) =>
    api.flow5.facilities.setOffering(id, input.unitTypeId, input.isActive),
  );
export const useAssignMember = (id: string) =>
  useFlow5Write((input: CreateAssignmentBody) => api.flow5.facilities.assign(id, input));
export const useRevokeMember = (id: string) =>
  useFlow5Write((userId: string) => api.flow5.facilities.revoke(id, userId));
