"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

export function useOperationsRefunds() {
  const actor = useAuthStore((state) => state.session?.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["payments", "refunds", actor?.id, actor?.role, actor?.assignedFacilityId],
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.payments.listRefunds({ limit: 100, offset });
        rows.push(...page);
        if (page.length < 100) return rows;
      }
    },
    staleTime: 30_000,
  });

  const confirmMutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: async ({ paymentId, reference }: { paymentId: string; reference: string }) =>
      api.payments.confirmManualRefund(paymentId, { reference }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["payments", "refunds", actor?.id, actor?.role, actor?.assignedFacilityId],
      });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  return {
    query,
    confirmMutation,
  };
}
