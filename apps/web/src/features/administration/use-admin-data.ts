"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMockMode } from "@/config/api-mode";
import { applyAdminChange } from "./admin.helpers";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import { adminMockData } from "./admin.mock";
import type { AdminAccountChange, AdminMockData } from "./admin.types";

const key = ["administration", "mock-workspace"] as const;

export function useAdminData() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    enabled: isMockMode,
    queryFn: async () => structuredClone(adminMockData),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const mutation = useMutation({
    mutationFn: async (changes: readonly AdminAccountChange[]) => {
      if (!isMockMode) throw new Error(M.liveRequired);
      const data = client.getQueryData<AdminMockData>(key) ?? structuredClone(adminMockData);
      return changes.reduce(applyAdminChange, data);
    },
    onSuccess: (data) => client.setQueryData(key, data),
  });
  return { ...query, mutation };
}
