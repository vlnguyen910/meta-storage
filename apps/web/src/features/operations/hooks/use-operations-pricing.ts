"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { loadPricingConfiguration } from "../operations.data";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";

export function useOperationsPricing() {
  const actor = useAuthStore((state) => state.session?.user);
  const queryClient = useQueryClient();
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["pricing", "configuration", actor?.id, actor?.role, actor?.assignedFacilityId],
    queryFn: loadPricingConfiguration,
    staleTime: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ["pricing", "history", actor?.id, actor?.role, actor?.assignedFacilityId],
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.pricing.getHistory({ limit: 100, offset });
        rows.push(...page);
        if (page.length < 100) return rows;
      }
    },
    staleTime: 60_000,
  });

  const updateDepositMutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: async ({
      expectedVersion,
      depositMonths,
    }: {
      expectedVersion: number;
      depositMonths: number;
    }) => {
      setConflictError(null);
      setMutationError(null);
      return api.pricing.updateDepositPolicy({
        expectedVersion,
        depositMonths,
      });
    },
    onSuccess: () => {
      setConflictError(null);
      setMutationError(null);
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["unit-types"] });
      void queryClient.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          setConflictError(M.conflictMessage);
        } else {
          setMutationError(error.response?.data?.message || error.message || R.mutationError);
        }
      } else {
        setMutationError(R.mutationError);
      }
    },
  });

  async function reloadData() {
    const result = await configQuery.refetch();
    if (result.error || !result.data) throw result.error ?? new Error(R.reloadError);
    await historyQuery.refetch();
    setConflictError(null);
    setMutationError(null);
    return result.data;
  }

  return {
    configQuery,
    historyQuery,
    updateDepositMutation,
    conflictError,
    mutationError,
    setConflictError,
    setMutationError,
    reloadData,
  };
}
