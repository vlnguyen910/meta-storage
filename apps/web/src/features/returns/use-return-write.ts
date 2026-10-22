"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { returnKeys } from "./hooks";

export function useReturnWrite<T>(requestId: string, operation: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: operation,
    retry: false,
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["returns"] }),
        client.invalidateQueries({ queryKey: ["rentals"] }),
        client.invalidateQueries({ queryKey: ["rental-payments"] }),
        client.invalidateQueries({ queryKey: ["lifecycle-notifications"] }),
      ]);
      await client.fetchQuery({
        queryKey: returnKeys.request(requestId),
        queryFn: () => api.returns.get(requestId),
        staleTime: 0,
      });
    },
  });
}
