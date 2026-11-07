"use client";

import type { ConfirmReservationInput, ReservationQuoteInput } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const reservationKeys = {
  all: ["reservations"] as const,
  mine: ["reservations", "mine"] as const,
  detail: (id: string) => ["reservations", "detail", id] as const,
};

export function useMyReservations() {
  return useQuery({ queryKey: reservationKeys.mine, queryFn: api.legacyReservations.mine });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => api.legacyReservations.get(id),
  });
}

export function useReservationQuote() {
  return useMutation({
    mutationFn: (input: ReservationQuoteInput) => api.legacyReservations.quote(input),
  });
}

export function useConfirmReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmReservationInput) => api.legacyReservations.confirm(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}
