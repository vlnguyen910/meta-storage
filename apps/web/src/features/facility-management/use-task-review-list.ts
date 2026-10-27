"use client";
import { type FacilityTaskListQuery, FacilityTaskStatus } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useManagementKey } from "./hooks";
import { F5 } from "./management.messages";
export function useTaskReviewList(query: FacilityTaskListQuery, enabled: boolean) {
  const key = useManagementKey();
  return useQuery({
    queryKey: [...key, "task-reviews", query],
    enabled: enabled && Boolean(query.facilityId),
    queryFn: async ({ signal }) => {
      const items = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.tasks.list({ ...query, limit: 100, offset }, signal);
        items.push(
          ...page.items.filter((item) => item.status === FacilityTaskStatus.AWAITING_APPROVAL),
        );
        if (offset + page.items.length >= page.total) break;
        if (!page.items.length) throw new Error(F5.loadError);
      }
      const unique = [...new Map(items.map((item) => [item.id, item])).values()];
      return {
        items: unique.slice(query.offset, query.offset + query.limit),
        total: unique.length,
        limit: query.limit,
        offset: query.offset,
      };
    },
    refetchInterval: 30_000,
  });
}
