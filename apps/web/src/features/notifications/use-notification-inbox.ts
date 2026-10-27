"use client";

import { UserRole } from "@metastorage/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export function useNotificationInbox() {
  const identity = useFlow3Identity();
  const role = useAuthStore((state) => state.session?.user.role);
  const query = useInfiniteQuery({
    queryKey: ["lifecycle-notifications", identity],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.inbox(pageParam, signal),
    getNextPageParam: (last, pages) => (last.length === 20 ? pages.length * 20 : undefined),
    enabled:
      !isMockMode && (role === UserRole.STORAGE_CUSTOMER || role === UserRole.FACILITY_MANAGER),
    refetchOnWindowFocus: true,
  });
  const seen = new Set<string>();
  const items = (query.data?.pages.flat() ?? []).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return { ...query, items, unavailable: isMockMode };
}
