import { zodResolver } from "@hookform/resolvers/zod";
import {
  type SUPPORT_CATEGORIES,
  type SupportBookingContext,
  type SupportContextQuery,
  type SupportCreateInput,
  SupportCreateInputSchema,
  type SupportPaymentContext,
} from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../lib/api";
import { customerCommandId } from "../customer-api/customer-native";

export type CustomerSupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export function useSupportRequest(
  owner: string,
  onCreated: (ticketId: string) => void,
  reservationId?: string,
  paymentId?: string,
) {
  const initialCategory: CustomerSupportCategory = paymentId ? "PAYMENT" : "UNIT";
  const form = useForm<SupportCreateInput>({
    resolver: zodResolver(SupportCreateInputSchema),
    defaultValues: {
      ...(reservationId ? { reservationId } : {}),
      ...(paymentId ? { paymentId } : {}),
      category: initialCategory,
      subject: "",
      content: "",
      idempotencyKey: customerCommandId(),
    },
  });
  const category = form.watch("category");
  const selectedReservationId = form.watch("reservationId");
  const selectedPaymentId = form.watch("paymentId");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const lastSubmission = useRef<string | undefined>(undefined);

  const contexts = useInfiniteQuery({
    queryKey: ["customer-support-contexts", owner, category, submittedSearch],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.contexts(
        {
          category,
          limit: 20,
          cursor: pageParam,
          search: submittedSearch || undefined,
        } satisfies SupportContextQuery,
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const payments = useInfiniteQuery({
    queryKey: ["customer-support-payments", owner, selectedReservationId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.contextPayments(
        selectedReservationId ?? "",
        { limit: 20, cursor: pageParam },
        signal,
      ),
    enabled: Boolean(selectedReservationId) && category === "PAYMENT",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const create = useMutation({
    mutationFn: (input: SupportCreateInput) => api.support.create(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["support-tickets", owner] });
      onCreated(result.ticket.id);
    },
  });
  const contextItems = contexts.data?.pages.flatMap((page) => page.items) ?? [];
  const paymentItems = payments.data?.pages.flatMap((page) => page.items) ?? [];
  const [pickedContext, setPickedContext] = useState<SupportBookingContext>();
  const contextFromResults = contextItems.find((item) => item.id === selectedReservationId);
  useEffect(() => {
    if (contextFromResults) setPickedContext(contextFromResults);
  }, [contextFromResults]);
  const selectedContext =
    contextFromResults ?? (pickedContext?.id === selectedReservationId ? pickedContext : undefined);
  const selectedPayment = paymentItems.find((item) => item.id === selectedPaymentId);

  function changeCategory(value: CustomerSupportCategory) {
    if (value === category) return;
    const validate = form.formState.isSubmitted;
    form.setValue("category", value, { shouldDirty: true, shouldValidate: validate });
    form.setValue("reservationId", undefined, { shouldDirty: true, shouldValidate: validate });
    form.setValue("paymentId", undefined, { shouldDirty: true });
    create.reset();
  }
  function selectContext(context: SupportBookingContext) {
    form.setValue("reservationId", context.id, { shouldDirty: true, shouldValidate: true });
    form.setValue("paymentId", undefined, { shouldDirty: true });
    create.reset();
  }
  function selectPayment(payment?: SupportPaymentContext) {
    form.setValue("paymentId", payment?.id, { shouldDirty: true });
    create.reset();
  }
  function submit() {
    return form.handleSubmit((values) => {
      const signature = JSON.stringify({ ...values, idempotencyKey: undefined });
      const idempotencyKey =
        lastSubmission.current && lastSubmission.current !== signature
          ? customerCommandId()
          : values.idempotencyKey;
      lastSubmission.current = signature;
      if (idempotencyKey !== values.idempotencyKey) form.setValue("idempotencyKey", idempotencyKey);
      create.mutate({ ...values, idempotencyKey });
    })();
  }

  return {
    category,
    changeCategory,
    contexts,
    contextItems,
    create,
    form,
    payments,
    paymentItems,
    search,
    selectedContext,
    selectedPayment,
    selectedPaymentId,
    selectedReservationId,
    selectContext,
    selectPayment,
    setSearch,
    setSubmittedSearch: (value: string) => setSubmittedSearch(value.trim().slice(0, 120)),
    submit,
  };
}
