import { zodResolver } from "@hookform/resolvers/zod";
import {
  type BookingDraftInput,
  BookingDraftInputSchema,
  type BookingPaymentInput,
  BookingPaymentInputSchema,
  type BookingPaymentSession,
  type CustomerBookingPageCursor,
  type RentalPageCursor,
  type SupportContextQuery,
  type SupportCreateInput,
  SupportCreateInputSchema,
} from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../lib/api";
import type { CustomerCheckoutCommand, CustomerNavigation } from "./customer-api.types";

function checkoutSelectionKey(input: BookingDraftInput) {
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
    initialPageParam: undefined as CustomerBookingPageCursor | undefined,
    queryFn: ({ pageParam }) => api.bookings.mine({ limit: 20, ...pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
export function useCustomerBooking(owner: string, id: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["customer-booking", owner, id],
    queryFn: () => api.bookings.getMine(id),
    refetchInterval: (q) =>
      !q.state.error && q.state.data?.status === "CONFIRMED" && q.state.dataUpdateCount < 60
        ? 10000
        : false,
  });
  const cancel = useMutation({
    mutationFn: () => api.bookings.cancel(id),
    onSuccess: async () => {
      await query.refetch();
      await client.invalidateQueries({ queryKey: ["customer-bookings"] });
    },
  });
  return { query, cancel };
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
    resolver: zodResolver(BookingDraftInputSchema),
    defaultValues: {
      facilityId,
      unitTypeId,
      checkInDate: "",
      checkInSlotId: "",
      durationMonths: 1,
    },
  });
  const paymentForm = useForm<BookingPaymentInput>({
    resolver: zodResolver(BookingPaymentInputSchema),
    defaultValues: { idempotencyKey: customerCommandId(), contactPhone: undefined },
  });
  const slots = useQuery({ queryKey: ["customer-slots"], queryFn: api.bookings.checkInSlots });
  const values = form.watch();
  const valid = BookingDraftInputSchema.safeParse(values);
  const availability = useQuery({
    queryKey: ["customer-availability", values],
    queryFn: ({ signal }) => api.facilities.availability(facilityId, values, signal),
    enabled: valid.success,
  });
  const draftRef = useRef<CustomerCheckoutCommand | null>(null);
  const restored = useQuery({
    queryKey: ["customer-checkout-recovery", owner, facilityId, unitTypeId],
    queryFn: () => readCustomerCommand<NonNullable<typeof draftRef.current>>(owner, "checkout"),
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
        const draft = await api.bookings.createDraft(input);
        draftRef.current = { signature, draft, key: customerCommandId(), values: input };
        await saveCustomerCommand(owner, "checkout", draftRef.current);
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
        await saveCustomerCommand(owner, "checkout", saved);
      }
      let result: BookingPaymentSession;
      try {
        result =
          saved.payment ??
          (await api.bookings.pay(saved.draft.id, {
            idempotencyKey: saved.key,
            ...(saved.contactPhone ? { contactPhone: saved.contactPhone } : {}),
          }));
      } catch (error) {
        if (isAxiosError(error) && [400, 409, 422].includes(error.response?.status ?? 0)) {
          saved.key = customerCommandId();
          saved.contactPhone = undefined;
          await saveCustomerCommand(owner, "checkout", saved);
        }
        throw error;
      }
      saved.payment = result;
      await saveCustomerCommand(owner, "checkout", saved);
      await saveCustomerCommand(owner, "payment", {
        screen: "payment",
        id: result.paymentId,
        bookingId: result.bookingId,
      });
      return result;
    },
    onSuccess: (result) =>
      go({ screen: "payment", id: result.paymentId, bookingId: result.bookingId }),
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
      void readCustomerCommand<CustomerCheckoutCommand>(owner, "checkout").then(async (saved) => {
        if (saved?.payment?.paymentId !== id) return;
        if (paymentStatus === "SUCCEEDED") await clearCustomerCommand(owner, "checkout");
        else if (paymentStatus === "FAILED") {
          saved.payment = undefined;
          saved.contactPhone = undefined;
          saved.key = customerCommandId();
          await saveCustomerCommand(owner, "checkout", saved);
        }
      });
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
      const saved = await readCustomerCommand<CustomerCheckoutCommand>(owner, "checkout");
      if (!saved) return null;
      saved.payment = undefined;
      saved.contactPhone = undefined;
      saved.key = customerCommandId();
      await saveCustomerCommand(owner, "checkout", saved);
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
  bookingId?: string,
  paymentId?: string,
) {
  const form = useForm<SupportCreateInput>({
    resolver: zodResolver(SupportCreateInputSchema),
    defaultValues: {
      bookingId: bookingId ?? "",
      paymentId,
      category: "PAYMENT",
      subject: "",
      content: "",
      idempotencyKey: customerCommandId(),
    },
  });
  const category = form.watch("category");
  const selected = form.watch("bookingId");
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
      api.support.contextPayments(selected, { limit: 20, cursor: pageParam }, signal),
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
      if (saved && !bookingId) form.reset(saved);
    });
  }, [owner, bookingId, form.reset]);
  const submit = form.handleSubmit(async (input) => {
    await saveCustomerCommand(owner, "support-draft", input);
    create.mutate(input);
  });
  return { form, contexts, attempts, create, submit };
}
