"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OperationsOverviewFilter {
  from: string;
  to: string;
  facilityId?: string;
  unitTypeId?: string;
}

export function useOperationsOverview(filter: OperationsOverviewFilter) {
  const query = useQuery({
    queryKey: [
      "reports",
      "overview",
      {
        from: filter.from,
        to: filter.to,
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
      },
    ],
    queryFn: () =>
      api.reports.getOverview({
        from: filter.from,
        to: filter.to,
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
      }),
    staleTime: 60_000,
  });

  return query;
}
