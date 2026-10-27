"use client";
import type { SupportContextQuery, SupportTicketQuery } from "@metastorage/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export function useSupportTickets(filters: Partial<SupportTicketQuery> = {}) {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: ["support-tickets", identity, filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.list({ ...filters, limit: 20, cursor: pageParam }, signal),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
export function useSupportContexts(category: SupportContextQuery["category"]) {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: ["support-contexts", identity, category],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.contexts({ category, limit: 20, cursor: pageParam }, signal),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
export function useSupportPaymentContexts(id: string, enabled: boolean) {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: ["support-payment-contexts", identity, id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.contextPayments(id, { limit: 20, cursor: pageParam }, signal),
    enabled: Boolean(id) && enabled,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
export function useSupportTicket(id: string) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: ["support-ticket", identity, id],
    queryFn: ({ signal }) => api.support.detail(id, signal),
  });
}
