"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  BookingConfirmation,
  BookingDraft,
  BookingPaymentSession,
} from "@metastorage/contracts";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useAvailability, useFacilities } from "@/features/facilities/hooks";
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
  const searchParams = useSearchParams();
  const initialSearch = useRef(searchParams);
  const [step, setStep] = useState(0);
  const [changingFacility, setChangingFacility] = useState(!searchParams.get("facilityId"));
  const [areaFilter, setAreaFilter] = useState(searchParams.get("area") ?? "all");
  const [note, setNote] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [pendingPayment, setPendingPayment] = useState<BookingPaymentSession | null>(null);
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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
      fullName: "",
      email: "",
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
  const availabilityQuery = useAvailability(facilityId);
  const selectedFacility = facilitiesQuery.data?.items.find((item) => item.id === facilityId);
  const selectedOption = availabilityQuery.data?.find((item) => item.unitTypeId === unitTypeId);
  const paymentStatusQuery = useCheckoutPaymentStatus(
    pendingPayment?.paymentId ?? null,
    draft?.draftAccessToken,
  );

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
      saved.draft.durationMonths,
    ]);
    form.reset({
      facilityId: saved.draft.facilityId,
      unitTypeId: saved.draft.unitTypeId,
      checkInDate: saved.checkInDate,
      checkInSlotId: saved.checkInSlotId,
      durationMonths: saved.draft.durationMonths,
      fullName: "",
      email: "",
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
  useEffect(() => {
    if (!confirmation) return;
    let active = true;
    QRCode.toDataURL(confirmation.qrUrl, { margin: 1, width: 320 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [confirmation]);
  useEffect(() => {
    const result = paymentStatusQuery.data;
    if (result?.status === "SUCCEEDED" && result.confirmation) {
      setConfirmation(result.confirmation);
      setPaymentError(null);
      setStep(4);
    } else if (result?.status === "FAILED") setPaymentError(checkoutMessages.paymentNotCompleted);
    else if (result?.status === "REFUND_PENDING") setPaymentError(checkoutMessages.refundPending);
    else if (result?.status === "REFUNDED") setPaymentError(checkoutMessages.refunded);
  }, [paymentStatusQuery.data]);

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
      const context = { draft, checkInDate, checkInSlotId, idempotencyKey: paymentKey };
      saveCheckoutContext(context);
      const result = await paymentMutation.mutateAsync({
        bookingId: draft.id,
        input: {
          draftAccessToken: draft.draftAccessToken,
          idempotencyKey: paymentKey,
          contact: {
            fullName: values.fullName.trim(),
            email: values.email.trim(),
            phone: normalizePhone(values.phone),
          },
        },
      });
      saveCheckoutContext({ ...context, payment: result });
      setPendingPayment(result);
    } catch (error) {
      setPaymentError(checkoutFailure(error, "payment").message);
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
    qrDataUrl,
    paidPricing: draft?.pricing ?? null,
    pendingPayment,
    paymentStatusQuery,
    submissionError,
    paymentError,
    busy: draftMutation.isPending,
    paying: paymentMutation.isPending,
    next,
    pay,
  };
}
