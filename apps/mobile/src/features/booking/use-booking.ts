import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AppointmentRecordDto,
  CheckoutSessionInputSchema,
  CreateReservationDraftSchema,
  type ReservationPaymentSession,
  type ReservationRecordDto,
} from "@metastorage/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type {
  BookingNavigatorProps,
  BookingStep,
  BookingValues,
  SavedBooking,
} from "../../common/booking.types";
import { bookingError, isPaidReservation, unitAreaMatches } from "../../common/booking.utils";
import { canSelectCheckInSlot } from "../../common/check-in-schedule.utils";
import { shiftDate, vietnamDate } from "../../common/customer-home.utils";
import { api } from "../../lib/api";
import { customerCommandId } from "../customer-api/customer-native";
import { BOOKING as M } from "./booking.messages";
import {
  bookingAppointment,
  bookingSignature,
  clearBooking,
  readBooking,
  retireBookingAppointment,
  saveBooking,
} from "./booking.service";
import { useBookingPayment } from "./use-booking-payment";

const schema = CreateReservationDraftSchema.extend({
  contactPhone: CheckoutSessionInputSchema.shape.contactPhone.unwrap(),
  notes: z.string().max(2000),
});
export function useBooking({
  facility,
  user,
  unitTypeId,
}: Pick<BookingNavigatorProps, "facility" | "user" | "unitTypeId">) {
  const client = useQueryClient();
  const [step, setStep] = useState<BookingStep>(0);
  const [area, setArea] = useState("all");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [restoreError, setRestoreError] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [draft, setDraft] = useState<ReservationRecordDto>();
  const [appointment, setAppointment] = useState<AppointmentRecordDto>();
  const [session, setSession] = useState<ReservationPaymentSession>();
  const [payment, setPayment] = useState<SavedBooking["payment"]>();
  const [paymentUncertain, setPaymentUncertain] = useState(false);
  const command = useRef<SavedBooking | null>(null);
  const signature = useRef("");
  const locked = useRef(true);
  const minDate = shiftDate(vietnamDate(), 1);
  const form = useForm<BookingValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      facilityId: facility.id,
      unitTypeId: unitTypeId ?? "",
      checkInDate: minDate,
      checkInSlotId: "",
      durationMonths: 1,
      contactPhone: user.phone ?? "",
      notes: "",
    },
  });
  const values = useWatch({ control: form.control }) as BookingValues;
  const types = useQuery({
    queryKey: ["mobile-booking-types", facility.id],
    queryFn: () => api.facilities.listUnitTypes(facility.id, { limit: 100 }),
  });
  const slots = useQuery({
    queryKey: ["customer-check-in-slots"],
    queryFn: () => api.appointments.slots(),
  });
  const unit = types.data?.find((item) => item.id === values.unitTypeId);
  const slot = slots.data?.find((item) => item.id === values.checkInSlotId);
  const scheduleReady = Boolean(
    unit &&
      slot &&
      values.checkInDate >= minDate &&
      canSelectCheckInSlot(values.checkInDate, slot.startTime),
  );
  const availability = useQuery({
    queryKey: [
      "mobile-booking-availability",
      facility.id,
      values.unitTypeId,
      values.checkInDate,
      values.checkInSlotId,
      values.durationMonths,
    ],
    queryFn: ({ signal }) =>
      api.facilities.availability(
        facility.id,
        CreateReservationDraftSchema.parse(form.getValues()),
        signal,
      ),
    enabled: scheduleReady && step === 1,
    staleTime: 15000,
    retry: 1,
  });
  const paymentState = useBookingPayment(payment);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A retry explicitly reruns recovery after a network failure.
  useEffect(() => {
    let alive = true;
    let restored = false;
    locked.current = true;
    setBusy(true);
    setRestoreError(false);
    setError("");
    async function restore() {
      try {
        const saved = await readBooking(user.id);
        if (!saved || saved.facilityId !== facility.id) {
          restored = true;
          return;
        }
        const record = await api.reservations.get(saved.draftId);
        const appt = await bookingAppointment(saved.draftId);
        if (!alive) return;
        const restoredValues: BookingValues = {
          ...CreateReservationDraftSchema.parse(saved),
          contactPhone: saved.contactPhone,
          notes: appt?.notes ?? "",
        };
        command.current = saved;
        signature.current = bookingSignature(restoredValues);
        form.reset(restoredValues);
        setDraft(record);
        setAppointment(appt);
        setPayment(saved.payment);
        setPaymentUncertain(Boolean(saved.paymentRequested && !saved.payment));
        if (isPaidReservation(record)) {
          setStep(4);
          await clearBooking(user.id);
        } else setStep(saved.payment ? 3 : appt ? 2 : 1);
        restored = true;
      } catch (e) {
        if (alive) {
          setError(bookingError(e));
          setRestoreError(true);
        }
      } finally {
        if (alive) {
          locked.current = !restored;
          setBusy(false);
        }
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [facility.id, user.id, form, restoreAttempt]);
  useEffect(() => {
    if (!form.getValues("checkInSlotId") && slots.data?.[0])
      form.setValue("checkInSlotId", slots.data[0].id);
  }, [slots.data, form]);
  useEffect(() => {
    if (!paymentState.receipt.data) return;
    setDraft(paymentState.receipt.data);
    setStep(4);
    setError("");
    void clearBooking(user.id).catch(() => undefined);
    void client.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("customer-"),
    });
  }, [paymentState.receipt.data, user.id, client]);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await action();
    } catch (e) {
      setError(bookingError(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function edit(next: BookingStep) {
    if (locked.current || command.current?.paymentRequested) return;
    setError("");
    setFeedback("");
    setStep(next);
  }
  async function prepare() {
    await run(async () => {
      if (command.current?.paymentRequested) throw new Error(M.conflict);
      if (!(await form.trigger())) throw new Error(M.invalidForm);
      const input = form.getValues();
      if (
        !unit?.isActive ||
        !slot ||
        input.checkInDate < minDate ||
        !canSelectCheckInSlot(input.checkInDate, slot.startTime)
      )
        throw new Error(M.slotInvalid);
      const stock = await availability.refetch();
      if (stock.isError) throw stock.error;
      if (!stock.data?.availableCount) throw new Error(M.capacity);
      const nextSignature = bookingSignature(input);
      let current = command.current;
      if (!current || signature.current !== nextSignature) {
        if (current) {
          await retireBookingAppointment(current);
          await clearBooking(user.id);
          command.current = null;
        }
        const result = await api.reservations.createDraft(
          CreateReservationDraftSchema.parse(input),
        );
        current = {
          ...CreateReservationDraftSchema.parse(input),
          contactPhone: input.contactPhone.trim(),
          draftId: result.id,
          key: customerCommandId(),
        };
        // Store the draft before the appointment request so retries reuse its context.
        command.current = current;
        signature.current = nextSignature;
        setDraft(result);
      }
      await saveBooking(user.id, current);
      const appt = await bookingAppointment(current.draftId, input);
      setAppointment(appt);
      setStep(2);
    });
  }
  async function pay() {
    await run(async () => {
      const current = command.current;
      if (!current || !appointment) throw new Error(M.invalidForm);
      const attempt = { ...current, paymentRequested: true };
      // Persist the same key before sending. An uncertain response must never rotate it.
      await saveBooking(user.id, attempt);
      command.current = attempt;
      setPaymentUncertain(true);
      let result: ReservationPaymentSession;
      try {
        result = await api.reservations.pay(attempt.draftId, {
          idempotencyKey: attempt.key,
          contactPhone: attempt.contactPhone,
        });
      } catch (cause) {
        // Unlock editing only after a definitive rejection and canonical proof that no payment exists.
        if (
          isAxiosError(cause) &&
          cause.response &&
          cause.response.status >= 400 &&
          cause.response.status < 500
        ) {
          const canonical = await api.reservations.get(attempt.draftId);
          if (canonical.status === "DRAFT" && !canonical.paymentStatus) {
            const rejected = { ...attempt, paymentRequested: false };
            await saveBooking(user.id, rejected);
            command.current = rejected;
            setPaymentUncertain(false);
          }
        }
        throw cause;
      }
      const next = {
        ...attempt,
        payment: {
          paymentId: result.paymentId,
          reservationId: result.reservationId,
          paymentCode: result.paymentCode,
          expiresAt: result.expiresAt,
        },
      };
      command.current = next;
      setSession(result);
      setPayment(next.payment);
      setStep(3);
      setPaymentUncertain(false);
      await saveBooking(user.id, next);
    });
  }
  async function restart() {
    await run(async () => {
      if (paymentState.status !== "FAILED") return;
      // A terminal failure requires a new draft and a fresh availability check.
      if (command.current) await retireBookingAppointment(command.current);
      await clearBooking(user.id);
      command.current = null;
      signature.current = "";
      setSession(undefined);
      setPayment(undefined);
      setDraft(undefined);
      setAppointment(undefined);
      setPaymentUncertain(false);
      setStep(1);
    });
  }
  async function copy(value: string) {
    try {
      await Clipboard.setStringAsync(value);
      setFeedback(M.copied);
    } catch {
      setError(M.copyError);
    }
  }
  return {
    facility,
    user,
    step,
    busy,
    error,
    feedback,
    form,
    values,
    types,
    slots,
    unit,
    slot,
    minDate,
    restoreError,
    retryRestore: () => setRestoreAttempt((n) => n + 1),
    area,
    setArea,
    units: types.data?.filter((u) => u.isActive && unitAreaMatches(u, area)) ?? [],
    availability,
    scheduleReady,
    draft,
    appointment,
    session,
    payment,
    paymentState,
    paymentUncertain,
    next: () => edit(1),
    edit,
    back: () => edit(Math.max(0, step - 1) as BookingStep),
    prepare,
    pay,
    restart,
    copy,
    changeFacility: (onChange: () => void) =>
      run(async () => {
        if (command.current?.paymentRequested) return;
        await clearBooking(user.id);
        command.current = null;
        onChange();
      }),
    reportGatewayError: () => setError(M.gatewayError),
  };
}
