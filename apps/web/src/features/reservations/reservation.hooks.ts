"use client";
import { APPOINTMENT_TYPES } from "@metastorage/database/schema/appointments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { clearCheckoutContext, readCheckoutContext } from "./checkout-storage";
import { RESERVATION_UI as m } from "./reservation.messages";

export function useReservationRecord(id: string) {
  const { showToast } = useToast();
  const owner = useFlow3Identity();
  const client = useQueryClient();
  const reservation = useQuery({
    queryKey: ["reservations", owner, id],
    queryFn: () => api.reservations.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "DRAFT" || query.state.data?.status === "CONFIRMED"
        ? 15000
        : false,
  });
  const record = reservation.data;
  const appointments = useQuery({
    queryKey: ["appointments", owner, "mine"],
    queryFn: () => api.appointments.mine(),
    refetchInterval: record?.status === "CONFIRMED" ? 15000 : false,
  });
  const slots = useQuery({ queryKey: ["appointments", "slots"], queryFn: api.appointments.slots });
  const appointment = appointments.data?.find(
    (item) => item.reservationId === id && !["CANCELLED", "NO_SHOW"].includes(item.status),
  );
  const createAppointment = useMutation({
    mutationFn: async (slotId: string) => {
      if (!record) throw new Error(m.error);
      const saved = readCheckoutContext();
      return api.appointments.create({
        appointmentType: APPOINTMENT_TYPES.CHECK_IN,
        reservationId: id,
        scheduledDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
          new Date(record.rentalStartAt),
        ),
        slotId,
        contactPhone: saved?.draft.id === id ? saved.contactPhone : undefined,
      });
    },
    onSuccess: async () => {
      showToast(m.appointmentCreated, "success");
      await client.invalidateQueries({ queryKey: ["appointments"] });
      if (readCheckoutContext()?.draft.id === id) clearCheckoutContext();
    },
    onError: () => appointments.refetch(),
  });
  const cancel = useMutation({
    mutationFn: () => api.reservations.cancel(id),
    onSuccess: async () => {
      showToast(m.cancelSuccess, "success");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reservations"] }),
        client.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
    },
  });
  const localTime = record
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(record.rentalStartAt))
    : "";
  const matchingSlots =
    slots.data?.filter((slot) => slot.startTime.slice(0, 5) === localTime) ?? [];
  const saved = readCheckoutContext();
  const preferredSlot =
    saved?.draft.id === id && matchingSlots.some((slot) => slot.id === saved.checkInSlotId)
      ? saved.checkInSlotId
      : undefined;
  return {
    reservation,
    record,
    appointments,
    appointment,
    slots: matchingSlots,
    preferredSlot,
    createAppointment,
    cancel,
  };
}
