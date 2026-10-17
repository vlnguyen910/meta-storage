"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyAdminChange } from "./admin.helpers";
import { adminMockData } from "./admin.mock";
import type { AdminAccountChange, AdminMockData } from "./admin.types";

const key = ["administration", "mock-workspace"] as const;

export function useAdminData() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => structuredClone(adminMockData),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const mutation = useMutation({
    mutationFn: async (changes: readonly AdminAccountChange[]) => {
      const data = client.getQueryData<AdminMockData>(key) ?? structuredClone(adminMockData);
      return changes.reduce(applyAdminChange, data);
    },
    onSuccess: (data) => client.setQueryData(key, data),
  });
  return { ...query, mutation };
}
