"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { returnKeys } from "./hooks";

export function useReturnWrite<T, R = unknown>(
  requestId: string,
  operation: (input: T) => Promise<R>,
) {
  const client = useQueryClient();
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
    retry: false,
    onMutate: () => setRefreshError(false),
    onSettled: refresh,
  });
  return { ...mutation, refreshError, refresh };
}
