"use client";

import type {
  AssignReturnStaff,
  CreateReturnRequest,
  ReturnVersion,
  SaveReturnInspection,
} from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { useFlow3Identity } from "./use-flow3-identity";

const identity = () => {
  const user = authStore.getState().session?.user;
  return `${user?.id ?? "anonymous"}:${user?.role ?? "guest"}`;
};

export const returnKeys = {
  all: ["returns"] as const,
  rental: (rentalId: string) => ["returns", "rental", rentalId, identity()] as const,
  request: (requestId: string) => ["returns", "request", requestId, identity()] as const,
  slots: (rentalId: string, date: string) =>
    ["returns", "slots", rentalId, date, identity()] as const,
  queue: (facilityId: string, role: string) =>
    ["returns", "queue", facilityId, role, identity()] as const,
};

export function useRentalReturns(rentalId: string) {
  const actor = useFlow3Identity();
  return useQuery({
    queryKey: [...returnKeys.rental(rentalId), actor],
    queryFn: () => api.rentals.returns(rentalId),
    enabled: Boolean(rentalId),
  });
}

export function useReturnSlots(rentalId: string, date: string) {
  const actor = useFlow3Identity();
  return useQuery({
    queryKey: [...returnKeys.slots(rentalId, date), actor],
    queryFn: () => api.rentals.returnSlots(rentalId, date),
    enabled: Boolean(rentalId && date),
    staleTime: 0,
  });
}

export function useReturnRequest(requestId: string) {
  useFlow3Identity();
  return useQuery({
    queryKey: returnKeys.request(requestId),
    queryFn: () => api.returns.get(requestId),
    enabled: Boolean(requestId),
  });
}

export function useCreateReturnRequest(rentalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: CreateReturnRequest) => api.rentals.createReturn(rentalId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.rental(rentalId) }),
        queryClient.invalidateQueries({ queryKey: ["rentals"] }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.rental(rentalId) }),
        queryClient.invalidateQueries({ queryKey: ["returns", "slots", rentalId] }),
      ]);
    },
  });
}

export function useUpdateReturnRequest(requestId: string, rentalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: CreateReturnRequest & ReturnVersion) =>
      api.returns.update(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.rental(rentalId) }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
        queryClient.invalidateQueries({ queryKey: ["returns", "slots", rentalId] }),
      ]);
    },
  });
}

export function useCancelReturnRequest(requestId: string, rentalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: ReturnVersion) => api.returns.cancel(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.rental(rentalId) }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
        queryClient.invalidateQueries({ queryKey: ["rentals"] }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.rental(rentalId) }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
  });
}

export function useFacilityReturnQueue(
  facilityId: string,
  role: "FACILITY_MANAGER" | "FACILITY_STAFF",
  status?: string,
) {
  const actor = useFlow3Identity();
  const query = useInfiniteQuery({
    queryKey: [...returnKeys.queue(facilityId, role), status, actor],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.returns.queue(facilityId, {
        limit: 20,
        offset: pageParam,
        status: status as ReturnQueueStatus | undefined,
      }),
    getNextPageParam: (lastPage, pages) => (lastPage.length === 20 ? pages.length * 20 : undefined),
    enabled: Boolean(facilityId),
  });
  return {
    ...query,
    data: query.data?.pages
      .flat()
      .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index),
  };
}

type ReturnQueueStatus =
  | "PENDING"
  | "CONFIRMED"
  | "INSPECTING"
  | "FAILED"
  | "COMPLETED"
  | "CANCELLED";

export function useAssignReturnStaff(requestId: string, facilityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: AssignReturnStaff) => api.returns.assignStaff(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: returnKeys.queue(facilityId, "FACILITY_MANAGER"),
        }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: returnKeys.queue(facilityId, "FACILITY_MANAGER"),
        }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
  });
}

export function useConfirmReturnRequest(requestId: string, facilityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: ReturnVersion) => api.returns.confirm(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({
          queryKey: returnKeys.queue(facilityId, "FACILITY_MANAGER"),
        }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
  });
}

export function useStartReturnInspection(requestId: string, facilityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: ReturnVersion) => api.returns.startInspection(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
  });
}

export function useRecordPhysicalReturn(requestId: string, facilityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: { expectedVersion: number; actualReturnAt: string; reason: string }) =>
      api.returns.recordPhysicalReturn(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
      ]);
    },
  });
}

export function useSaveReturnInspection(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ inspectionId, input }: { inspectionId: string; input: SaveReturnInspection }) =>
      api.returns.saveInspection(requestId, inspectionId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) });
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) });
    },
  });
}

export function useCompleteReturnInspection(requestId: string, facilityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ inspectionId, input }: { inspectionId: string; input: ReturnVersion }) =>
      api.returns.completeInspection(requestId, inspectionId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) });
    },
  });
}

export function useFinalizeReturnRequest(requestId: string, facilityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: ReturnVersion) => api.returns.finalize(requestId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) }),
        queryClient.invalidateQueries({ queryKey: returnKeys.queue(facilityId, "FACILITY_STAFF") }),
        queryClient.invalidateQueries({
          queryKey: returnKeys.queue(facilityId, "FACILITY_MANAGER"),
        }),
        queryClient.invalidateQueries({ queryKey: ["rentals"] }),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) });
    },
  });
}
