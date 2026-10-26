"use client";
import type { CustomerBookingPageCursor } from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export function useCustomerBookings() {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: ["customer-bookings", identity],
    initialPageParam: undefined as CustomerBookingPageCursor | undefined,
    queryFn: ({ pageParam }) => api.bookings.mine({ limit: 6, ...pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function useCustomerBooking(id: string) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: ["customer-booking", identity, id],
    queryFn: () => api.bookings.getMine(id),
    refetchInterval: (query) =>
      !query.state.error &&
      query.state.data?.status === "CONFIRMED" &&
      query.state.dataUpdateCount < 60
        ? 10000
        : false,
  });
}
export function useCancelCustomerBooking(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.bookings.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["customer-bookings"] }),
        client.invalidateQueries({ queryKey: ["customer-booking"] }),
      ]);
    },
  });
}
