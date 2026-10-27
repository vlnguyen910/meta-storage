"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { returnKeys } from "./hooks";
import { F3 } from "./integration.messages";
import { integrationError } from "./integration-utils";

export function useReturnWrite<T, R = unknown>(
  requestId: string,
  operation: (input: T) => Promise<R>,
  successMessage: string = F3.saved,
) {
  const client = useQueryClient();
  const { showToast } = useToast();
  const role = useAuthStore((s) => s.session?.user.role);
  const [refreshError, setRefreshError] = useState(false);
  const requestKey = returnKeys.request(requestId);
  async function refresh() {
    try {
      await Promise.all(
        [
          "returns",
          "rentals",
          "rental-payments",
          "lifecycle-notifications",
          "reports",
          "operations",
          "payments",
          "check-ins",
          "manager-overview",
          "manager-monthly",
          "manager-tabs",
        ].map((root) => client.invalidateQueries({ queryKey: [root] })),
      );
      await client.fetchQuery({
        queryKey: requestKey,
        queryFn: () => api.returns.get(requestId),
        staleTime: 0,
        retry: false,
      });
      setRefreshError(false);
      return true;
    } catch {
      setRefreshError(true);
      return false;
    }
  }
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: operation,
    onSuccess: () => {
      if (role === "FACILITY_MANAGER") showToast(successMessage, "success");
    },
    onError: (error) => {
      if (role === "FACILITY_MANAGER") showToast(integrationError(error), "error");
    },
    retry: false,
    onMutate: () => setRefreshError(false),
    onSettled: refresh,
  });
  return { ...mutation, refreshError, refresh };
}
