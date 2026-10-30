import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CheckoutSessionInput,
  CheckoutSessionInputSchema,
  type CreateReservationDraftInput,
  CreateReservationDraftSchema,
  type RentalPageCursor,
  type ReservationPaymentSession,
  type SupportContextQuery,
  type SupportCreateInput,
  SupportCreateInputSchema,
} from "@metastorage/contracts";
import { APPOINTMENT_TYPES } from "@metastorage/database/schema/appointments";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../lib/api";
import type { CustomerCheckoutCommand, CustomerNavigation } from "./customer-api.types";

function checkoutSelectionKey(input: CreateReservationDraftInput) {
  return JSON.stringify([
    input.facilityId,
    input.unitTypeId,
    input.checkInDate,
    input.checkInSlotId,
    input.durationMonths,
  ]);
}

import {
  clearCustomerCommand,
  customerCommandId,
  readCustomerCommand,
  saveCustomerCommand,
} from "./customer-native";

export function useCustomerBookings(owner: string) {
  return useInfiniteQuery({
    queryKey: ["customer-bookings", owner],
    initialPageParam: undefined as undefined,
    queryFn: async () => ({ items: await api.reservations.mine() }),
    getNextPageParam: () => undefined,
  });
}
export function useCustomerBooking(owner: string, id: string) {
  const client = useQueryClient();
  const appointments = useQuery({
    queryKey: ["customer-appointments", owner],
    queryFn: () => api.appointments.mine(),
    enabled: Boolean(id),
  });
  const query = useQuery({
    queryKey: ["customer-booking", owner, id],
    queryFn: () => api.reservations.get(id),
    enabled: Boolean(id),
    refetchInterval: (q) =>
      !q.state.error && q.state.data?.status === "CONFIRMED" && q.state.dataUpdateCount < 60
        ? 10000
        : false,
  });
  const cancel = useMutation({
    mutationFn: () => api.reservations.cancel(id),
    onSuccess: async () => {
      await query.refetch();
      await client.invalidateQueries({ queryKey: ["customer-bookings"] });
    },
  });
  return { query, cancel, appointments };
}
export function useCustomerRentals(owner: string, view: "current" | "history") {
  return useInfiniteQuery({
    queryKey: ["rentals", owner, view],
    initialPageParam: undefined as RentalPageCursor | undefined,
    queryFn: ({ pageParam }) => api.rentals.mine({ view, limit: 20, ...pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
export function useCustomerCatalog() {
  return useInfiniteQuery({
    queryKey: ["customer-catalog"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.facilities.listActive({ limit: 20, offset: pageParam }),
    getNextPageParam: (p, pages) => (p.length === 20 ? pages.length * 20 : undefined),
  });
}
export function useCustomerTypes(id: string) {
  return useInfiniteQuery({
    queryKey: ["customer-unit-types", id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.facilities.listUnitTypes(id, { limit: 20, offset: pageParam }),
    getNextPageParam: (p, pages) => (p.length === 20 ? pages.length * 20 : undefined),
    enabled: Boolean(id),
  });
}
export function useCustomerCheckout(
  owner: string,
  facilityId: string,
  unitTypeId: string,
  go: CustomerNavigation,
) {
  const form = useForm({
    resolver: zodResolver(CreateReservationDraftSchema),
    defaultValues: {
      facilityId,
      unitTypeId,
      checkInDate: "",
      checkInSlotId: "",
      durationMonths: 1,
    },
  });
  const paymentForm = useForm<CheckoutSessionInput>({
    resolver: zodResolver(CheckoutSessionInputSchema),
    defaultValues: { idempotencyKey: customerCommandId(), contactPhone: undefined },
  });
  const slots = useQuery({ queryKey: ["customer-slots"], queryFn: api.appointments.slots });
  const values = form.watch();
  const valid = CreateReservationDraftSchema.safeParse(values);
  const availability = useQuery({
    queryKey: ["customer-availability", values],
    queryFn: ({ signal }) => api.facilities.availability(facilityId, values, signal),
    enabled: valid.success,
  });
  const draftRef = useRef<CustomerCheckoutCommand | null>(null);
  const restored = useQuery({
    queryKey: ["customer-checkout-recovery", owner, facilityId, unitTypeId],
    queryFn: () =>
      readCustomerCommand<NonNullable<typeof draftRef.current>>(owner, "reservation-checkout-v2"),
  });
  useEffect(() => {
    const saved = restored.data;
    if (saved?.draft.facilityId === facilityId && saved.draft.unitTypeId === unitTypeId) {
      draftRef.current = saved;
      form.reset(saved.values);
    }
  }, [restored.data, facilityId, unitTypeId, form.reset]);
  const prepare = useMutation({
    mutationFn: async (input: typeof values) => {
      const signature = checkoutSelectionKey(input);
      if (!draftRef.current || draftRef.current.signature !== signature) {
        const draft = await api.reservations.createDraft(input);
        await api.appointments.create({
          appointmentType: APPOINTMENT_TYPES.CHECK_IN,
          reservationId: draft.id,
          scheduledDate: input.checkInDate,
          slotId: input.checkInSlotId,
        });
        draftRef.current = { signature, draft, key: customerCommandId(), values: input };
        await saveCustomerCommand(owner, "reservation-checkout-v2", draftRef.current);
      }
      return draftRef.current.draft;
    },
  });
  const pay = useMutation({
    mutationFn: async (phone: string) => {
      const saved = draftRef.current;
      if (!saved || saved.signature !== checkoutSelectionKey(form.getValues()))
        throw new Error(M.error);
      if (saved.contactPhone === undefined) {
        saved.contactPhone = phone.trim();
        await saveCustomerCommand(owner, "reservation-checkout-v2", saved);
      }
      let result: ReservationPaymentSession;
      try {
        result =
          saved.payment ??
          (await api.reservations.pay(saved.draft.id, {
            idempotencyKey: saved.key,
            ...(saved.contactPhone ? { contactPhone: saved.contactPhone } : {}),
          }));
      } catch (error) {
        if (isAxiosError(error) && [400, 409, 422].includes(error.response?.status ?? 0)) {
          saved.key = customerCommandId();
          saved.contactPhone = undefined;
          await saveCustomerCommand(owner, "reservation-checkout-v2", saved);
        }
        throw error;
      }
      saved.payment = result;
      await saveCustomerCommand(owner, "reservation-checkout-v2", saved);
      await saveCustomerCommand(owner, "payment", {
        screen: "payment",
        id: result.paymentId,
        reservationId: result.reservationId,
      });
      return result;
    },
    onSuccess: (result) =>
      go({ screen: "payment", id: result.paymentId, reservationId: result.reservationId }),
  });
  return {
    form,
    paymentForm,
    slots,
    availability,
    prepare,
    pay,
    draft:
      draftRef.current?.signature === checkoutSelectionKey(values)
        ? draftRef.current.draft
        : undefined,
  };
}
export function useCustomerPayment(owner: string, id: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["customer-payment", owner, id],
    queryFn: () => api.payments.status(id),
    retry: false,
    refetchInterval: (q) =>
      !q.state.error &&
      (!q.state.data || q.state.data.status === "PENDING") &&
      q.state.dataUpdateCount < 150
        ? 2000
        : false,
  });
  const paymentStatus = query.data?.status;
  useEffect(() => {
    if (paymentStatus && paymentStatus !== "PENDING") {
      void clearCustomerCommand(owner, "payment");
      void readCustomerCommand<CustomerCheckoutCommand>(owner, "reservation-checkout-v2").then(
        async (saved) => {
          if (saved?.payment?.paymentId !== id) return;
          if (paymentStatus === "FAILED") {
            saved.payment = undefined;
            saved.contactPhone = undefined;
            saved.key = customerCommandId();
            await saveCustomerCommand(owner, "reservation-checkout-v2", saved);
          }
        },
      );
      for (const key of [
        "customer-bookings",
        "customer-booking",
        "rentals",
        "rental",
        "rental-payments",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    }
  }, [paymentStatus, owner, id, client.invalidateQueries]);
  const restart = useMutation({
    mutationFn: async () => {
      const saved = await readCustomerCommand<CustomerCheckoutCommand>(
        owner,
        "reservation-checkout-v2",
      );
      if (!saved) return null;
      saved.payment = undefined;
      saved.contactPhone = undefined;
      saved.key = customerCommandId();
      await saveCustomerCommand(owner, "reservation-checkout-v2", saved);
      return saved.draft;
    },
  });
  return { ...query, restart };
}
export function useCustomerRental(owner: string, id: string) {
  const rental = useQuery({ queryKey: ["rental", owner, id], queryFn: () => api.rentals.get(id) });
  const payments = useQuery({
    queryKey: ["rental-payments", owner, id],
    queryFn: ({ signal }) => api.rentalPayments(id, signal),
  });
  return { rental, payments };
}
export function useCustomerTickets(owner: string) {
  return useInfiniteQuery({
    queryKey: ["support-tickets", owner],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.support.list({ limit: 20, cursor: pageParam }, signal),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
export function useCustomerSupportForm(
  owner: string,
  go: CustomerNavigation,
  reservationId?: string,
  paymentId?: string,
) {
  const form = useForm<SupportCreateInput>({
    resolver: zodResolver(SupportCreateInputSchema),
    defaultValues: {
      reservationId: reservationId ?? "",
      paymentId,
      category: "PAYMENT",
      subject: "",
      content: "",
      idempotencyKey: customerCommandId(),
    },
  });
  const category = form.watch("category");
  const selected = form.watch("reservationId");
  const contexts = useInfiniteQuery({
    queryKey: ["support-contexts", owner, category],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.contexts(
        { category, limit: 20, cursor: pageParam } satisfies SupportContextQuery,
        signal,
      ),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const attempts = useInfiniteQuery({
    queryKey: ["support-context-payments", owner, selected],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.contextPayments(selected ?? "", { limit: 20, cursor: pageParam }, signal),
    enabled: Boolean(selected) && category === "PAYMENT",
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const create = useMutation({
    mutationFn: (input: SupportCreateInput) => api.support.create(input),
    onSuccess: async (r) => {
      await clearCustomerCommand(owner, "support-draft");
      go({ screen: "ticket", id: r.ticket.id });
    },
  });
  useEffect(() => {
    void readCustomerCommand<SupportCreateInput>(owner, "support-draft").then((saved) => {
      if (saved && !reservationId) form.reset(saved);
    });
  }, [owner, reservationId, form.reset]);
  const submit = form.handleSubmit(async (input) => {
    await saveCustomerCommand(owner, "support-draft", input);
    create.mutate(input);
  });
  return { form, contexts, attempts, create, submit };
}

export function useCustomerReceivingAppointment(
  owner: string,
  reservation: import("@metastorage/contracts").ReservationRecordDto,
) {
  const client = useQueryClient();
  const appointments = useQuery({
    queryKey: ["customer-appointments", owner],
    queryFn: () => api.appointments.mine(),
    refetchInterval: 15000,
  });
  const slots = useQuery({ queryKey: ["customer-slots"], queryFn: api.appointments.slots });
  const existing = appointments.data?.find(
    (item) =>
      item.reservationId === reservation.id && !["CANCELLED", "NO_SHOW"].includes(item.status),
  );
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(reservation.rentalStartAt));
  const matchingSlots = slots.data?.filter((slot) => slot.startTime.slice(0, 5) === time) ?? [];
  const attempted = useRef(false);
  const create = useMutation({
    mutationFn: async (slotId: string) => {
      const saved = await readCustomerCommand<CustomerCheckoutCommand>(
        owner,
        "reservation-checkout-v2",
      );
      return api.appointments.create({
        appointmentType: APPOINTMENT_TYPES.CHECK_IN,
        reservationId: reservation.id,
        scheduledDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
          new Date(reservation.rentalStartAt),
        ),
        slotId,
        contactPhone: saved?.draft.id === reservation.id ? saved.contactPhone : undefined,
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["customer-appointments", owner] });
      await clearCustomerCommand(owner, "reservation-checkout-v2");
    },
    onError: () => appointments.refetch(),
  });
  const slotId = matchingSlots.length === 1 ? matchingSlots[0]?.id : undefined;
  useEffect(() => {
    if (
      reservation.status === "CONFIRMED" &&
      appointments.isSuccess &&
      !existing &&
      slotId &&
      !attempted.current
    ) {
      attempted.current = true;
      create.mutate(slotId);
    }
  }, [reservation.status, appointments.isSuccess, existing, slotId, create.mutate]);
  return { appointments, existing, slots: matchingSlots, create };
}
