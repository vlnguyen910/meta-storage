"use client";
import type {
  AppointmentRecordDto,
  CustomerBookingPageCursor,
  ReservationRecordDto,
} from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

function reservationView(
  r: ReservationRecordDto,
  appointment?: AppointmentRecordDto,
  rentalId?: string,
) {
  return {
    ...r,
    bookingCode: r.id,
    facility: r.facility ?? { id: r.facilityId, name: r.facilityId, address: "" },
    unitType: r.unitType ?? { id: r.unitTypeId, name: r.unitTypeId, sizeLabel: "" },
    checkInSlotStart: r.rentalStartAt,
    checkInSlotEnd: appointment?.slotEnd
      ? `${appointment.scheduledDate}T${appointment.slotEnd}+07:00`
      : null,
    assignedUnit: appointment?.assignedUnit
      ? {
          id: appointment.assignedUnit.physicalUnitId,
          code: appointment.assignedUnit.physicalUnitCode,
        }
      : null,
    handoverStage:
      r.status === "CHECKED_IN"
        ? "HANDED_OVER"
        : appointment?.status === "CONFIRMED"
          ? "WAITING_CUSTOMER"
          : undefined,
    pricing: {
      monthlyRateSnapshot: String(r.monthlyRateSnapshot),
      rentalFeeAmount: String(r.rentalFeeAmount),
      depositAmount: String(r.depositAmount),
      totalAmount: String(r.totalAmount),
      currency: "VND",
    },
    confirmation:
      r.paymentStatus === "SUCCEEDED"
        ? { qrUrl: new URL(`/customer/reservations/${r.id}`, window.location.origin).toString() }
        : null,
    rentalId: rentalId ?? r.rentalId,
  };
}
export function useCustomerBookings() {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: ["customer-bookings", identity],
    initialPageParam: undefined as CustomerBookingPageCursor | undefined,
    queryFn: async () => ({
      items: (await api.reservations.mine()).map((r) => reservationView(r)),
      nextCursor: null,
    }),
    getNextPageParam: () => undefined,
  });
}
export function useCustomerBooking(id: string) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: ["customer-booking", identity, id],
    queryFn: async () => {
      const [r, appointments] = await Promise.all([
        api.reservations.get(id),
        api.appointments.mine(),
      ]);
      const appointment = appointments.find(
        (a) => a.reservationId === id && !["CANCELLED", "NO_SHOW"].includes(a.status),
      );
      return reservationView(r, appointment);
    },
    refetchInterval: 10000,
  });
}
export function useCancelCustomerBooking(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.reservations.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["customer-bookings"] }),
        client.invalidateQueries({ queryKey: ["customer-booking"] }),
        client.invalidateQueries({ queryKey: ["reservations"] }),
        client.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
    },
  });
}
