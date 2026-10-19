"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { api } from "@/lib/api";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";

export function useOperationsPricing() {
  const queryClient = useQueryClient();
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

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
      setMutationError(null);
      return api.pricing.updateUnitTypePrice(unitTypeId, {
        expectedVersion,
        monthlyPrice,
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
          setMutationError(
            error.response?.data?.message || error.message || "Lỗi khi cập nhật giá loại kho",
          );
        }
      } else {
        setMutationError("Lỗi kết nối khi cập nhật giá");
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
          setMutationError(
            error.response?.data?.message ||
              error.message ||
              "Lỗi khi cập nhật chính sách tiền cọc",
          );
        }
      } else {
        setMutationError("Lỗi kết nối khi cập nhật tiền cọc");
      }
    },
  });

  function reloadData() {
    setConflictError(null);
    setMutationError(null);
    void configQuery.refetch();
    void historyQuery.refetch();
  }

  return {
    configQuery,
    historyQuery,
    updatePriceMutation,
    updateDepositMutation,
    conflictError,
    mutationError,
    setConflictError,
    setMutationError,
    reloadData,
  };
}
