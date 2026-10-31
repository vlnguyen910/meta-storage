"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReservationPaymentSession, ReservationRecordDto } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { useAvailability, useFacilities } from "@/features/facilities/hooks";
import { api } from "@/lib/api";
import {
  useBookingDraft,
  useBookingPayment,
  useBookingSlots,
  useCheckoutPaymentStatus,
} from "./booking-checkout.hooks";
import { checkoutMessages } from "./checkout.messages";
import { clearCheckoutContext, readCheckoutContext, saveCheckoutContext } from "./checkout-storage";
import {
  checkoutFailure,
  normalizePhone,
  toLocalDateTimeInput,
  wizardSchema,
} from "./checkout-validation";

type WizardValues = z.input<typeof wizardSchema>;

export function useReservationCheckout() {
  const session = useAuthStore((state) => state.session);
  const searchParams = useSearchParams();
  const initialSearch = useRef(searchParams);
  const routeSignature = useRef(searchParams.toString());
  const [step, setStep] = useState(0);
  const [changingFacility, setChangingFacility] = useState(!searchParams.get("facilityId"));
  const [areaFilter, setAreaFilter] = useState(searchParams.get("area") ?? "all");
  const [note, setNote] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReservationRecordDto | null>(null);
  const [pendingPayment, setPendingPayment] = useState<ReservationPaymentSession | null>(null);
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [holdSeconds, setHoldSeconds] = useState(0);

  const [isRedirecting, setIsRedirecting] = useState(false);
  const requestInFlight = useRef(false);
  const draftSelection = useRef("");
  const draftMutation = useBookingDraft();
  const paymentMutation = useBookingPayment();
  const slotsQuery = useBookingSlots();
  const facilitiesQuery = useFacilities({ pageSize: 100 });
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      facilityId: searchParams.get("facilityId") ?? "",
      unitTypeId: searchParams.get("unitTypeId") ?? "",
      checkInDate: "",
      checkInSlotId: "",
      durationMonths: 1,
      fullName: !isMockMode && session ? session.user.name : "",
      email: !isMockMode && session ? session.user.email : "",
      phone: "",
    },
  });
  const facilityId = form.watch("facilityId");
  const unitTypeId = form.watch("unitTypeId");
  const checkInDate = form.watch("checkInDate");
  const checkInSlotId = form.watch("checkInSlotId");
  const durationMonths = Number(form.watch("durationMonths"));
  const selectedSlot = slotsQuery.data?.find((slot) => slot.id === checkInSlotId);
  const scheduleReady =
    /^\d{4}-\d{2}-\d{2}$/.test(checkInDate) &&
    checkInDate > toLocalDateTimeInput(new Date()).slice(0, 10) &&
    Boolean(selectedSlot) &&
    durationMonths >= 1 &&
    durationMonths <= 12;
  const availabilityQuery = useAvailability(
    facilityId,
    scheduleReady && unitTypeId
      ? { unitTypeId, checkInDate, checkInSlotId, durationMonths }
      : undefined,
  );
  const selectedFacility = facilitiesQuery.data?.items.find((item) => item.id === facilityId);
  const selectedOption = availabilityQuery.data?.find((item) => item.unitTypeId === unitTypeId);
  const paymentStatusQuery = useCheckoutPaymentStatus(pendingPayment?.paymentId ?? null);

  useEffect(() => {
    const signature = searchParams.toString();
    if (signature === routeSignature.current) return;
    routeSignature.current = signature;
    clearCheckoutContext();
    setStep(0);
    setChangingFacility(!searchParams.get("facilityId"));
    setDraft(null);
    setPendingPayment(null);
    setPaymentError(null);
    setSubmissionError(null);
    setPaymentKey(crypto.randomUUID());
    form.reset({
      facilityId: searchParams.get("facilityId") ?? "",
      unitTypeId: searchParams.get("unitTypeId") ?? "",
      checkInDate: "",
      checkInSlotId: "",
      durationMonths: 1,
      fullName: form.getValues("fullName"),
      email: form.getValues("email"),
      phone: "",
    });
  }, [form, searchParams]);

  useEffect(() => {
    if (initialSearch.current.get("new") === "1") {
      clearCheckoutContext();
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url);
      return;
    }
    const saved = readCheckoutContext();
    if (!saved) return;
    const requestedFacility = initialSearch.current.get("facilityId");
    const requestedUnitType = initialSearch.current.get("unitTypeId");
    if (
      (requestedFacility && requestedFacility !== saved.draft.facilityId) ||
      (requestedUnitType && requestedUnitType !== saved.draft.unitTypeId)
    ) {
      clearCheckoutContext();
      return;
    }
    setDraft(saved.draft);
    setPaymentKey(saved.idempotencyKey);
    draftSelection.current = JSON.stringify([
      saved.draft.facilityId,
      saved.draft.unitTypeId,
      saved.checkInDate,
      saved.checkInSlotId,
      saved.draft.requestedMonths,
    ]);
    form.reset({
      facilityId: saved.draft.facilityId,
      unitTypeId: saved.draft.unitTypeId,
      checkInDate: saved.checkInDate,
      checkInSlotId: saved.checkInSlotId,
      durationMonths: saved.draft.requestedMonths,
      fullName: form.getValues("fullName"),
      email: form.getValues("email"),
      phone: "",
    });
    if (saved.payment) {
      setPendingPayment(saved.payment);
      setStep(3);
    } else {
      setStep(1);
      setSubmissionError(checkoutMessages.resumeContact);
    }
    setChangingFacility(false);
  }, [form]);
  useEffect(() => {
    if (!isMockMode && session) {
      if (session.user.name && !form.getValues("fullName")) {
        form.setValue("fullName", session.user.name);
      }
      if (session.user.email && !form.getValues("email")) {
        form.setValue("email", session.user.email);
      }
      const userPhone = (session.user as { phone?: string | null })?.phone;
      if (userPhone && !form.getValues("phone")) {
        form.setValue("phone", String(userPhone).replace(/^\+84/, "0"));
      }
    }
  }, [form, session]);
  useEffect(() => {
    const firstSlot = slotsQuery.data?.[0];
    if (!checkInSlotId && firstSlot) {
      form.setValue("checkInSlotId", firstSlot.id, {
        shouldValidate: true,
      });
    }
  }, [checkInSlotId, form, slotsQuery.data]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll on step transitions.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  useEffect(() => {
    if (!pendingPayment) return;
    const update = () =>
      setHoldSeconds(
        Math.max(0, Math.ceil((Date.parse(pendingPayment.expiresAt) - Date.now()) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [pendingPayment]);
  const confirmationQuery = useQuery({
    queryKey: ["reservations", session?.user.id, "receipt", pendingPayment?.reservationId],
    queryFn: () => api.reservations.get(pendingPayment?.reservationId ?? ""),
    enabled:
      paymentStatusQuery.data?.status === "SUCCEEDED" &&
      Boolean(pendingPayment?.reservationId) &&
      paymentStatusQuery.data.reservationId === pendingPayment?.reservationId,
  });
  const confirmation = confirmationQuery.data ?? null;
  useEffect(() => {
    const result = paymentStatusQuery.data;
    if (
      result?.status === "SUCCEEDED" &&
      result.reservationId &&
      result.reservationId === pendingPayment?.reservationId
    ) {
      setPaymentError(null);
      setStep(4);
    } else if (result?.status === "FAILED") setPaymentError(checkoutMessages.paymentNotCompleted);
    else if (result?.status === "REFUND_PENDING") setPaymentError(checkoutMessages.refundPending);
    else if (result?.status === "REFUNDED") setPaymentError(checkoutMessages.refunded);
  }, [paymentStatusQuery.data, pendingPayment?.reservationId]);

  async function next() {
    if (
      requestInFlight.current ||
      draftMutation.isPending ||
      availabilityQuery.isFetching ||
      availabilityQuery.isError
    )
      return;
    if (step === 0) {
      if (await form.trigger(["facilityId", "unitTypeId"])) setStep(1);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step !== 1 || !(await form.trigger())) return;
    if (!selectedOption || selectedOption.availableCount === 0 || !scheduleReady) {
      setSubmissionError(checkoutMessages.unavailablePeriod);
      return;
    }
    requestInFlight.current = true;
    setSubmissionError(null);
    try {
      const selection = JSON.stringify([
        facilityId,
        unitTypeId,
        checkInDate,
        checkInSlotId,
        durationMonths,
      ]);
      if (!draft || draftSelection.current !== selection) {
        const created = await draftMutation.mutateAsync({
          facilityId,
          unitTypeId,
          checkInDate,
          checkInSlotId,
          durationMonths,
        });
        setDraft(created);
        draftSelection.current = selection;
        setPaymentKey(crypto.randomUUID());
      }
      setStep(2);
    } catch (error) {
      const failure = checkoutFailure(error, "draft");
      setSubmissionError(failure.message);
      void availabilityQuery.refetch();
      for (const detail of failure.details ?? []) {
        if (["checkInDate", "checkInSlotId", "durationMonths"].includes(detail.field))
          form.setError(detail.field as keyof WizardValues, { message: detail.message });
      }
    } finally {
      requestInFlight.current = false;
    }
  }
  async function pay() {
    if (!draft || requestInFlight.current || pendingPayment) return;
    requestInFlight.current = true;
    setPaymentError(null);
    try {
      const values = form.getValues();
      const previous = readCheckoutContext();
      const contactPhone =
        previous?.idempotencyKey === paymentKey && previous.contactPhone !== undefined
          ? previous.contactPhone
          : normalizePhone(values.phone);
      const context = {
        draft,
        checkInDate,
        checkInSlotId,
        idempotencyKey: paymentKey,
        contactPhone,
      };
      saveCheckoutContext(context);
      const result = await paymentMutation.mutateAsync({
        bookingId: draft.id,
        input: {
          idempotencyKey: paymentKey,
          contactPhone,
        },
      });
      saveCheckoutContext({ ...context, payment: result });
      setPendingPayment(result);

      if (typeof window !== "undefined" && result.checkoutUrl) {
        setIsRedirecting(true);
        if (result.checkoutFormFields && Object.keys(result.checkoutFormFields).length > 0) {
          const formEl = document.createElement("form");
          formEl.method = "POST";
          formEl.action = result.checkoutUrl;
          formEl.target = "_self";
          for (const [key, val] of Object.entries(result.checkoutFormFields)) {
            const inputEl = document.createElement("input");
            inputEl.type = "hidden";
            inputEl.name = key;
            inputEl.value = String(val);
            formEl.appendChild(inputEl);
          }
          document.body.appendChild(formEl);
          formEl.submit();
        } else {
          window.location.assign(result.checkoutUrl);
        }
      }
    } catch (error) {
      setPaymentError(checkoutFailure(error, "payment").message);
      if (isAxiosError(error) && [400, 409, 422].includes(error.response?.status ?? 0)) {
        clearCheckoutContext();
        setPaymentKey(crypto.randomUUID());
      }
    } finally {
      requestInFlight.current = false;
    }
  }
  const changeFacility = (id: string) => {
    if (pendingPayment) return;
    form.setValue("facilityId", id, { shouldValidate: true });
    form.setValue("unitTypeId", "");
    setAreaFilter("all");
    setDraft(null);
    setChangingFacility(false);
    setStep(0);
  };
  return {
    step,
    setStep,
    form,
    slotsQuery,
    selectedSlot,
    facilitiesQuery,
    availabilityQuery,
    selectedFacility,
    selectedOption,
    changingFacility,
    setChangingFacility,
    changeFacility,
    areaFilter,
    setAreaFilter,
    note,
    setNote,
    draft,
    hold: pendingPayment,
    holdSeconds,
    confirmation,
    qrDataUrl: null,
    paidPricing: draft,
    pendingPayment,
    paymentStatusQuery,
    submissionError,
    paymentError,
    busy: draftMutation.isPending,
    paying: paymentMutation.isPending,
    isRedirecting,
    next,
    pay,
  };
}
