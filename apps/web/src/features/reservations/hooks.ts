"use client";

import type { ConfirmReservationInput, ReservationQuoteInput } from "@storex/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const reservationKeys = {
  all: ["reservations"] as const,
  mine: ["reservations", "mine"] as const,
  detail: (id: string) => ["reservations", "detail", id] as const,
};

export function useMyReservations() {
  return useQuery({ queryKey: reservationKeys.mine, queryFn: api.reservations.mine });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => api.reservations.get(id),
  });
}

export function useReservationQuote() {
  return useMutation({
    mutationFn: (input: ReservationQuoteInput) => api.reservations.quote(input),
  });
}

export function useConfirmReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmReservationInput) => api.reservations.confirm(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}
