import type { SupportTicketDto } from "@metastorage/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function useCustomerTickets(owner: string, status?: SupportTicketDto["status"]) {
  return useInfiniteQuery({
    queryKey: status ? ["support-tickets", owner, status] : ["support-tickets", owner],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.list({ limit: 20, cursor: pageParam, ...(status ? { status } : {}) }, signal),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
