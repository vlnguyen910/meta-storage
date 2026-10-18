"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useOperationsRefunds() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["payments", "refunds"],
    queryFn: () => api.payments.listRefunds({ limit: 50 }),
    staleTime: 30_000,
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, reference }: { paymentId: string; reference: string }) =>
      api.payments.confirmManualRefund(paymentId, { reference }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", "refunds"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  return {
    query,
    confirmMutation,
  };
}
