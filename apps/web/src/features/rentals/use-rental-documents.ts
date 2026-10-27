"use client";
import { useQuery } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export function useRentalDocuments(bookingId: string, rentalId?: string) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: ["rental-documents", identity, bookingId, rentalId],
    queryFn: ({ signal }) =>
      rentalId
        ? api.rentalDocuments.rental(rentalId, signal)
        : api.rentalDocuments.list(bookingId, signal),
    enabled: Boolean(bookingId),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
