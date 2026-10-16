"use client";

import type { ApiFacility, ApiUnitType, PaginatedResult } from "@metastorage/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  FacilityCatalogFilters,
  FacilityCatalogItem,
  FacilityUnitTypeOption,
} from "./facility-catalog.types";

export const facilityKeys = {
  all: ["facilities"] as const,
  catalog: ["facilities", "catalog"] as const,
  list: (params: FacilityCatalogFilters) => ["facilities", "list", params] as const,
  detail: (id: string) => ["facilities", "detail", id] as const,
  unitTypes: (id: string) => ["facilities", "unit-types", id] as const,
};

async function loadUnitTypes(facilityId: string): Promise<ApiUnitType[]> {
  const rows: ApiUnitType[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api.facilities.listUnitTypes(facilityId, { limit: 100, offset });
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

function useFacilityCatalog() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: facilityKeys.catalog,
    queryFn: async (): Promise<FacilityCatalogItem[]> => {
      const facilities: ApiFacility[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.facilities.listActive({ limit: 100, offset });
        facilities.push(...page);
        if (page.length < 100) break;
      }
      return Promise.all(
        facilities.map(async (facility) => {
          const types = await queryClient.fetchQuery({
            queryKey: facilityKeys.unitTypes(facility.id),
            queryFn: () => loadUnitTypes(facility.id),
            staleTime: 30000,
          });
          return {
            ...facility,
            startingMonthlyPrice: types.length
              ? Math.min(...types.map((type) => type.monthlyPrice))
              : null,
          };
        }),
      );
    },
  });
}

export function useFacilities(params: FacilityCatalogFilters) {
  const query = useFacilityCatalog();
  let data: PaginatedResult<FacilityCatalogItem> | undefined;
  if (query.data) {
    const search = params.search?.trim().toLocaleLowerCase("vi");
    const city = params.city?.trim().toLocaleLowerCase("vi");
    const rows = query.data.filter(
      (facility) =>
        (!search ||
          `${facility.name} ${facility.address}`.toLocaleLowerCase("vi").includes(search)) &&
        (!city || facility.address.toLocaleLowerCase("vi").includes(city)),
    );
    rows.sort((a, b) =>
      params.sort === "price"
        ? (a.startingMonthlyPrice ?? Infinity) - (b.startingMonthlyPrice ?? Infinity) ||
          a.name.localeCompare(b.name, "vi")
        : a.name.localeCompare(b.name, "vi"),
    );
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    data = {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
    };
  }
  return { ...query, data };
}

export function useFacility(id: string) {
  const query = useFacilityCatalog();
  return { ...query, data: query.data?.find((facility) => facility.id === id) };
}

// No period-availability endpoint exists in the original API. A null count is
// unknown; draft creation and start-payment remain authoritative.
export function useAvailability(id: string) {
  return useQuery({
    queryKey: facilityKeys.unitTypes(id),
    queryFn: () => loadUnitTypes(id),
    enabled: Boolean(id),
    staleTime: 30000,
    select: (types): FacilityUnitTypeOption[] =>
      types.map((type) => ({
        facilityId: id,
        unitTypeId: type.id,
        unitType: type.name,
        sizeLabel: type.sizeLabel,
        sizeSqm: type.lengthM * type.widthM,
        lengthM: type.lengthM,
        widthM: type.widthM,
        heightM: type.heightM,
        monthlyPrice: type.monthlyPrice,
        availableCount: null,
      })),
  });
}
