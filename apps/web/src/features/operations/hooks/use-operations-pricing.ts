"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { api } from "@/lib/api";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";

export function useOperationsPricing() {
  const queryClient = useQueryClient();
  const [conflictError, setConflictError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["pricing", "configuration"],
    queryFn: () => api.pricing.getConfiguration({ limit: 100 }),
    staleTime: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ["pricing", "history"],
    queryFn: () => api.pricing.getHistory({ limit: 50 }),
    staleTime: 60_000,
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({
      unitTypeId,
      expectedVersion,
      monthlyPrice,
    }: {
      unitTypeId: string;
      expectedVersion: number;
      monthlyPrice: number;
    }) => {
      setConflictError(null);
      return api.pricing.updateUnitTypePrice(unitTypeId, {
        expectedVersion,
        monthlyPrice,
      });
    },
    onSuccess: () => {
      setConflictError(null);
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setConflictError(M.conflictMessage);
      }
    },
  });

  const updateDepositMutation = useMutation({
    mutationFn: async ({
      expectedVersion,
      depositMonths,
    }: {
      expectedVersion: number;
      depositMonths: number;
    }) => {
      setConflictError(null);
      return api.pricing.updateDepositPolicy({
        expectedVersion,
        depositMonths,
      });
    },
    onSuccess: () => {
      setConflictError(null);
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setConflictError(M.conflictMessage);
      }
    },
  });

  function reloadData() {
    setConflictError(null);
    void configQuery.refetch();
    void historyQuery.refetch();
  }

  return {
    configQuery,
    historyQuery,
    updatePriceMutation,
    updateDepositMutation,
    conflictError,
    setConflictError,
    reloadData,
  };
}
