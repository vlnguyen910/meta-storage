"use client";
import type { ConfirmReturnRefund, ReturnRequestDetailDto } from "@metastorage/contracts";
import { ConfirmReturnRefundSchema } from "@metastorage/contracts";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { integrationError, readWholeVnd } from "./integration-utils";
import type { PendingRefundAttempt, RefundDraft } from "./return-finance.types";
import { refundAmounts } from "./return-finance.validation";
import { useFlow3Identity } from "./use-flow3-identity";
import { useReturnWrite } from "./use-return-write";

export function useRefundEditor(detail: ReturnRequestDetailDto) {
  const identity = useFlow3Identity();
  const storageKey = `storex.refund-attempt:${identity}:${detail.request.id}`;
  const form = useForm<RefundDraft>({
    defaultValues: {
      depositRefundAmount: "0",
      rentRefundAmount: "0",
      reference: "",
      confirmed: false,
    },
  });
  const [evidence, setEvidence] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [ready, setReady] = useState(false);
  const pending = useRef<PendingRefundAttempt | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    pending.current = null;
    setEvidence([]);
    form.reset();
    setRestored(false);
    setUncertain(false);
    setMessage("");
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const input = JSON.parse(saved) as PendingRefundAttempt;
        const parsed = ConfirmReturnRefundSchema.safeParse({
          ...input.payload,
          expectedVersion: 0,
        });
        if (
          parsed.success &&
          parsed.data.depositRefundAmount !== undefined &&
          parsed.data.rentRefundAmount !== undefined
        ) {
          const { expectedVersion: _, ...payload } = parsed.data;
          pending.current = { payload };
          form.reset({
            depositRefundAmount: payload.depositRefundAmount ?? "0",
            rentRefundAmount: payload.rentRefundAmount ?? "0",
            reference: payload.reference,
            confirmed: false,
          });
          setEvidence(payload.evidencePhotoIds);
          setRestored(true);
        } else sessionStorage.removeItem(storageKey);
      }
    } catch {
      setMessage(F3.storageUnavailable);
    }
    setReady(true);
  }, [storageKey, form]);
  const mutation = useReturnWrite(detail.request.id, (input: ConfirmReturnRefund) =>
    api.returnActions.confirmRefund(detail.request.id, input),
  );
  const recorded =
    pending.current &&
    detail.refunds.some(
      (r) =>
        r.reference === pending.current?.payload.reference &&
        readWholeVnd(r.amount) === readWholeVnd(pending.current?.payload.amount ?? "") &&
        readWholeVnd(r.depositRefundAmount ?? "") ===
          readWholeVnd(pending.current?.payload.depositRefundAmount ?? "") &&
        readWholeVnd(r.rentRefundAmount ?? "") ===
          readWholeVnd(pending.current?.payload.rentRefundAmount ?? ""),
    );
  useEffect(() => {
    if (recorded) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* The recorded transfer remains blocked even if storage is unavailable. */
      }
      setMessage(F3.refundAlreadyRecorded);
      pending.current = null;
      form.reset();
      setEvidence([]);
      setRestored(false);
      setUncertain(false);
    }
  }, [recorded, storageKey, form]);
  async function submit(values: RefundDraft) {
    if (busy.current || !ready || recorded || mutation.refreshError) return;
    const amounts = refundAmounts(values, detail.refundSummary);
    if (!amounts || !values.confirmed) {
      setMessage(F3.invalid);
      return;
    }
    const payload = { ...amounts, reference: values.reference.trim(), evidencePhotoIds: evidence };
    const previous = pending.current?.payload;
    const same =
      previous &&
      previous.amount === payload.amount &&
      previous.depositRefundAmount === payload.depositRefundAmount &&
      previous.rentRefundAmount === payload.rentRefundAmount &&
      previous.reference === payload.reference &&
      JSON.stringify(previous.evidencePhotoIds) === JSON.stringify(payload.evidencePhotoIds);
    const input = ConfirmReturnRefundSchema.safeParse({
      ...payload,
      idempotencyKey: same ? previous.idempotencyKey : crypto.randomUUID(),
      expectedVersion: detail.request.version,
    });
    if (!input.success) {
      setMessage(F3.invalid);
      return;
    }
    const { expectedVersion: _, ...persistent } = input.data;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ payload: persistent }));
    } catch {
      setMessage(F3.storageUnavailable);
      return;
    }
    pending.current = { payload: persistent };
    busy.current = true;
    setMessage("");
    try {
      await mutation.mutateAsync(input.data);
      sessionStorage.removeItem(storageKey);
      pending.current = null;
      setEvidence([]);
      form.reset();
      setRestored(false);
      setUncertain(false);
      setMessage(F3.saved);
    } catch (error) {
      setUncertain(!isAxiosError(error) || !error.response || error.response.status >= 500);
      setMessage(integrationError(error));
    } finally {
      busy.current = false;
    }
  }
  async function recover() {
    if (await mutation.refresh()) setUncertain(false);
  }
  return {
    form,
    evidence,
    setEvidence,
    restored,
    message,
    uncertain,
    ready,
    recorded: Boolean(recorded),
    mutation,
    submit,
    recover,
  };
}
