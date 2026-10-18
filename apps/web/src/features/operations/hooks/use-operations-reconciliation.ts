"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OperationsReconciliationFilter {
  facilityId?: string;
  unitTypeId?: string;
  limit?: number;
  offset?: number;
}

export function useOperationsReconciliation(filter: OperationsReconciliationFilter) {
  const query = useQuery({
    queryKey: [
      "reports",
      "reconciliation",
      {
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        limit: filter.limit,
        offset: filter.offset,
      },
    ],
    queryFn: () =>
      api.reports.getReconciliation({
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        limit: filter.limit,
        offset: filter.offset,
      }),
    staleTime: 60_000,
  });

  return query;
}
