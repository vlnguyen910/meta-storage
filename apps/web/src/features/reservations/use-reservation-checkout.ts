"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  BookingConfirmation,
  PaymentPendingResponse,
  PaymentResult,
  ReservationDraft,
  ReservationHold,
} from "@metastorage/contracts";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { useAvailability, useFacilities } from "@/features/facilities/hooks";
import { checkoutMessages } from "./checkout.messages";
import {
  checkoutFailure,
  normalizePhone,
  toLocalDateTimeInput,
  wizardSchema,
} from "./checkout-validation";
import {
  usePaymentStatus,
  useReservationDraft,
  useReservationHold,
  useReservationPayment,
} from "./hooks";
import { RESERVATION_MESSAGES } from "./reservation.messages";

type WizardValues = z.input<typeof wizardSchema>;
function toApiDateTime(localValue: string): string {
  return new Date(`${localValue}:00+07:00`).toISOString();
}

function nextCheckInInput(): string {
  return toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));
}

export function useReservationCheckout() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [changingFacility, setChangingFacility] = useState(!searchParams.get("facilityId"));
  const [areaFilter, setAreaFilter] = useState(() => {
    const area = searchParams.get("area");
    return area && ["small", "medium", "large"].includes(area) ? area : "all";
  });
  const [note, setNote] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paidPricing, setPaidPricing] = useState<PaymentResult["pricing"] | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentPendingResponse | null>(null);
  const paymentStatusQuery = usePaymentStatus(pendingPayment?.paymentId ?? null);
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState<ReservationDraft | null>(null);
  const [hold, setHold] = useState<ReservationHold | null>(null);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const facilitiesQuery = useFacilities({ pageSize: 20 });
  const draftMutation = useReservationDraft();
  const holdMutation = useReservationHold();
  const paymentMutation = useReservationPayment();
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      facilityId: searchParams.get("facilityId") ?? "",
      unitTypeId: searchParams.get("unitTypeId") ?? "",
      checkInAt: nextCheckInInput(),
      durationMonths: 1,
      fullName: "",
      email: "",
      phone: "",
    },
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each checkout step starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  const facilityId = form.watch("facilityId");
  const unitTypeId = form.watch("unitTypeId");
  const checkInValue = form.watch("checkInAt");
  const checkInDate = new Date(`${checkInValue}:00+07:00`);
  const availabilityQuery = useAvailability(facilityId, {
    checkInAt: Number.isFinite(checkInDate.getTime()) ? checkInDate.toISOString() : undefined,
    durationMonths: Number(form.watch("durationMonths")),
    draftId: draft?.id,
  });
  const selectedFacility = facilitiesQuery.data?.items.find((item) => item.id === facilityId);
  const selectedOption = availabilityQuery.data?.find((item) => item.unitTypeId === unitTypeId);

  useEffect(() => {
    const facilityParam = searchParams.get("facilityId");
    if (facilityParam) form.setValue("facilityId", facilityParam);
  }, [form, searchParams]);

  useEffect(() => {
    if (!hold) return;
    const update = () =>
      setHoldSeconds(
        Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold]);

  useEffect(() => {
    if (!confirmation) return;
    QRCode.toDataURL(confirmation.qrUrl, { margin: 1, width: 320 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [confirmation]);

  useEffect(() => {
    const result = paymentStatusQuery.data;
    if (result?.status === "SUCCEEDED" && result.confirmation) {
      setConfirmation(result.confirmation);
      setPendingPayment(null);
      setPaymentError(null);
      setStep(4);
    } else if (result?.status === "SUCCEEDED") {
      setPaymentError(RESERVATION_MESSAGES.paymentConfirmationMissing);
    } else if (result?.status === "FAILED" || result?.status === "REFUNDED") {
      setPaymentError(checkoutMessages.paymentNotCompleted);
      setPendingPayment(null);
      setPaymentKey(crypto.randomUUID());
    }
  }, [paymentStatusQuery.data]);

  async function next() {
    if (
      draftMutation.isPending ||
      holdMutation.isPending ||
      availabilityQuery.isFetching ||
      availabilityQuery.isError
    )
      return;
    if (selectedOption?.availableCount === 0) {
      setSubmissionError(checkoutMessages.unavailablePeriod);
      return;
    }
    if (step === 0 && (await form.trigger(["facilityId", "unitTypeId"]))) setStep(1);
    else if (step === 2) setStep(3);
    else if (
      step === 1 &&
      (await form.trigger(["checkInAt", "durationMonths", "fullName", "email", "phone"], {
        shouldFocus: true,
      }))
    ) {
      setSubmissionError(null);
      const rawValues = form.getValues();
      const values = {
        ...rawValues,
        fullName: rawValues.fullName.trim(),
        email: rawValues.email.trim(),
        phone: normalizePhone(rawValues.phone),
      };
      let requestStage: "draft" | "hold" = "draft";
      try {
        const checkInAt = toApiDateTime(values.checkInAt);
        const reusableDraft =
          draft &&
          draft.facilityId === values.facilityId &&
          draft.unitTypeId === values.unitTypeId &&
          draft.checkInAt === checkInAt &&
          draft.durationMonths === Number(values.durationMonths) &&
          draft.contact.fullName === values.fullName &&
          draft.contact.email === values.email &&
          draft.contact.phone === values.phone
            ? draft
            : null;
        const created =
          reusableDraft ??
          (await draftMutation.mutateAsync({
            facilityId: values.facilityId,
            unitTypeId: values.unitTypeId,
            checkInAt,
            durationMonths: Number(values.durationMonths),
            contact: { fullName: values.fullName, email: values.email, phone: values.phone },
          }));
        if (!reusableDraft) setDraft(created);
        requestStage = "hold";
        const createdHold =
          reusableDraft && hold && new Date(hold.expiresAt).getTime() > Date.now()
            ? hold
            : await holdMutation.mutateAsync({
                draftId: created.id,
                draftAccessToken: created.draftAccessToken,
              });
        setHold(createdHold);
        setPaymentKey(crypto.randomUUID());
        setPaymentError(null);
        setStep(2);
      } catch (error) {
        const failure = checkoutFailure(error, requestStage);
        setSubmissionError(failure.message);
        if (failure.code === "CAPACITY_UNAVAILABLE") void availabilityQuery.refetch();
        for (const detail of failure.details ?? []) {
          const field = detail.field.replace(/^contact[./]/, "");
          if (["fullName", "email", "phone", "checkInAt", "durationMonths"].includes(field)) {
            form.setError(field as keyof WizardValues, { type: "server", message: detail.message });
          }
        }
        showToast(failure.message, "error");
      }
    }
  }

  async function pay() {
    if (!draft || !hold || holdSeconds <= 0 || paymentMutation.isPending || pendingPayment) return;
    setPaymentError(null);
    try {
      const result = await paymentMutation.mutateAsync({
        draftId: draft.id,
        input: {
          holdToken: hold.holdToken,
          idempotencyKey: paymentKey,
          paymentMethodToken: "mock_success",
        },
      });
      if (result.status === "PENDING") {
        setPaidPricing(draft.pricing);
        setPendingPayment(result);
        return;
      }
      if (!result.confirmation) {
        setPaymentError(RESERVATION_MESSAGES.paymentConfirmationMissing);
        showToast(RESERVATION_MESSAGES.paymentConfirmationMissing, "error");
        return;
      }
      setPaidPricing(result.pricing);
      setConfirmation(result.confirmation);
      setStep(4);
    } catch (error) {
      const failure = checkoutFailure(error, "payment");
      setPaymentError(failure.message);
      showToast(failure.message, "error");
    }
  }

  const changeFacility = (id: string) => {
    form.setValue("facilityId", id, { shouldValidate: true });
    form.setValue("unitTypeId", "");
    setAreaFilter("all");
    setDraft(null);
    setHold(null);
    setChangingFacility(false);
    setStep(0);
  };
  return {
    step,
    setStep,
    form,
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
    hold,
    holdSeconds,
    confirmation,
    qrDataUrl,
    paidPricing,
    pendingPayment,
    paymentStatusQuery,
    submissionError,
    paymentError,
    busy: draftMutation.isPending || holdMutation.isPending,
    paying: paymentMutation.isPending,
    next,
    pay,
  };
}
