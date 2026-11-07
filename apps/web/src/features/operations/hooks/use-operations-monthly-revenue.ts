"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import type { OperationsReportFilter } from "./operations-query.types";
export function useOperationsMonthlyRevenue(filter: OperationsReportFilter) {
  const actor = useAuthStore((state) => state.session?.user);
  const params = {
    from: filter.from,
    to: filter.to,
    facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
    unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
  };
  return useQuery({
    queryKey: ["reports", "monthly", actor?.id, actor?.role, actor?.assignedFacilityId, params],
    queryFn: () => api.reports.getMonthlyRevenue(params),
    staleTime: 60000,
  });
}
