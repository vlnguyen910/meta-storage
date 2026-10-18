"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OperationsRentalsFilter {
  facilityId?: string;
  unitTypeId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export function useOperationsRentals(filter: OperationsRentalsFilter) {
  const query = useQuery({
    queryKey: [
      "reports",
      "rentals",
      {
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        status: filter.status === "all" ? undefined : filter.status,
        limit: filter.limit,
        offset: filter.offset,
      },
    ],
    queryFn: () =>
      api.reports.getRentals({
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        status: filter.status === "all" ? undefined : filter.status,
        limit: filter.limit,
        offset: filter.offset,
      }),
    staleTime: 60_000,
  });

  return query;
}
