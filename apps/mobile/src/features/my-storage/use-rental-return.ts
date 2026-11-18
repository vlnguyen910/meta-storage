import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentRecordDto,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiErrorMessage } from "../../common/api-error.utils";
import { canSelectCheckInSlot } from "../../common/check-in-schedule.utils";
import { isEarlyReturn } from "../../common/my-storage.utils";
import { api } from "../../lib/api";
import { MY_STORAGE as M } from "./my-storage.messages";

const OPEN_STATUSES: readonly string[] = [
  APPOINTMENT_STATUSES.SCHEDULED,
  APPOINTMENT_STATUSES.CONFIRMED,
];

export function useRentalReturn(owner: string, rentalId: string, endAt: string) {
  const client = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const appointments = useQuery({
    queryKey: ["customer-return-appointments", owner, rentalId],
    queryFn: async () =>
      (await api.appointments.mine({ appointmentType: APPOINTMENT_TYPES.CHECK_OUT })).filter(
        (item: AppointmentRecordDto) => item.rentalId === rentalId,
      ),
    staleTime: 10000,
  });
  const slots = useQuery({
    queryKey: ["customer-check-in-slots"],
    queryFn: () => api.appointments.slots(),
    enabled: formOpen,
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["customer-return-appointments", owner, rentalId] }),
      client.invalidateQueries({ queryKey: ["customer-home-appointments", owner] }),
    ]);
  const create = useMutation({
    mutationFn: () =>
      api.appointments.create({
        appointmentType: APPOINTMENT_TYPES.CHECK_OUT,
        rentalId,
        scheduledDate: date,
        slotId,
      }),
    onSuccess: async () => {
      closeForm();
      setMessage({ text: M.returnCreated, error: false });
      await refresh();
    },
    onError: (error) => {
      setConfirmEarly(false);
      setMessage({ text: apiErrorMessage(error, M.returnCreateError), error: true });
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api.appointments.update(id, { status: APPOINTMENT_STATUSES.CANCELLED }),
    onSuccess: async () => {
      setMessage({ text: M.returnCancelled, error: false });
      await refresh();
    },
    onError: (error) =>
      setMessage({ text: apiErrorMessage(error, M.returnCancelError), error: true }),
  });
  function closeForm() {
    setFormOpen(false);
    setConfirmEarly(false);
    setDate("");
    setSlotId("");
  }
  const items = appointments.data ?? [];
  const active = items.find((item) => OPEN_STATUSES.includes(item.status));
  const slot = slots.data?.find((item) => item.id === slotId);
  const canSubmit = Boolean(slot && date && canSelectCheckInSlot(date, slot));
  return {
    appointments,
    slots,
    items,
    active,
    formOpen,
    date,
    slotId,
    slot,
    confirmEarly,
    message,
    canSubmit,
    busy: create.isPending || cancel.isPending,
    creating: create.isPending,
    cancelling: cancel.isPending,
    openForm: () => {
      setMessage(null);
      setFormOpen(true);
    },
    closeForm,
    setDate,
    setSlotId,
    setConfirmEarly,
    submit: () => {
      if (isEarlyReturn(date, endAt)) setConfirmEarly(true);
      else create.mutate();
    },
    confirmSubmit: () => create.mutate(),
    cancel: (id: string) => cancel.mutate(id),
  };
}
