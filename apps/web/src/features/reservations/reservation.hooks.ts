"use client";
import { APPOINTMENT_TYPES } from "@metastorage/database/schema/appointments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { clearCheckoutContext, readCheckoutContext } from "./checkout-storage";
import { RESERVATION_UI as m } from "./reservation.messages";

export function useReservationRecord(id: string) {
  const owner = useFlow3Identity();
  const client = useQueryClient();
  const reservation = useQuery({
    queryKey: ["reservations", owner, id],
    queryFn: () => api.reservations.get(id),
    enabled: Boolean(id),
    refetchInterval: 15000,
  });
  const appointments = useQuery({
    queryKey: ["appointments", owner, "mine"],
    queryFn: () => api.appointments.mine(),
    refetchInterval: 15000,
  });
  const slots = useQuery({ queryKey: ["appointments", "slots"], queryFn: api.appointments.slots });
  const record = reservation.data;
  const appointment = appointments.data?.find(
    (item) => item.reservationId === id && !["CANCELLED", "NO_SHOW"].includes(item.status),
  );
  const facility = useQuery({
    queryKey: ["facilities", "active"],
    queryFn: () => api.facilities.listActive({ limit: 100 }),
  });
  const types = useQuery({
    queryKey: ["unit-types", record?.facilityId],
    queryFn: () => api.facilities.listUnitTypes(record?.facilityId ?? "", { limit: 100 }),
    enabled: Boolean(record),
  });
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
      await client.invalidateQueries({ queryKey: ["appointments"] });
      if (readCheckoutContext()?.draft.id === id) clearCheckoutContext();
    },
    onError: () => appointments.refetch(),
  });
  const cancel = useMutation({
    mutationFn: () => api.reservations.cancel(id),
    onSuccess: async () => {
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
    facility: facility.data?.find((item) => item.id === record?.facilityId),
    unitType: types.data?.find((item) => item.id === record?.unitTypeId),
  };
}
