"use client";
import type {
  ReturnRequestDetailDto,
  ReturnSettlementPreviewDto,
  SettleReturn,
} from "@metastorage/contracts";
import { SettleReturnSchema } from "@metastorage/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { returnKeys } from "./hooks";
import { F3 } from "./integration.messages";
import { integrationError } from "./integration-utils";
import type { SettlementDraft } from "./return-finance.types";
import { useReturnWrite } from "./use-return-write";

export function useSettlementEditor(detail: ReturnRequestDetailDto) {
  const form = useForm<SettlementDraft>({
    defaultValues: { damageAmount: "0", unusedRentRefundAmount: "0", reason: "" },
  });
  const signature = JSON.stringify([form.watch(), detail]);
  const current = useRef(signature);
  current.current = signature;
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const client = useQueryClient();
  const [preview, setPreview] = useState<{
    signature: string;
    input: SettleReturn;
    result: ReturnSettlementPreviewDto;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (current.current !== signature) return;
    controller.current?.abort();
    setPreview(null);
    setConfirming(false);
    setLoading(false);
    return () => controller.current?.abort();
  }, [signature]);
  const mutation = useReturnWrite(
    detail.request.id,
    (input: SettleReturn) => api.returns.settle(detail.request.id, input),
    F3.settlementSaved,
  );

  async function loadPreview(confirm = false) {
    const parsed = SettleReturnSchema.safeParse({
      ...form.getValues(),
      expectedVersion: detail.request.version,
    });
    form.clearErrors();
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "damageAmount" || field === "unusedRentRefundAmount" || field === "reason")
          form.setError(field, { type: "validate", message: F3.invalid });
      }
      setMessage(F3.invalid);
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const snapshot = current.current;
    setLoading(true);
    setConfirming(false);
    setMessage("");
    try {
      if (confirm) {
        const fresh = await api.returns.get(detail.request.id);
        if (abort.signal.aborted) return;
        client.setQueryData(returnKeys.request(detail.request.id), fresh);
        if (JSON.stringify(fresh) !== JSON.stringify(detail)) {
          setMessage(F3.stale);
          return;
        }
      }
      const result = await api.returns.previewSettlement(
        detail.request.id,
        parsed.data,
        abort.signal,
      );
      if (abort.signal.aborted || snapshot !== current.current) return;
      if (
        result.version !== parsed.data.expectedVersion ||
        result.requestId !== detail.request.id
      ) {
        setMessage(F3.previewInvalid);
        setPreview(null);
        return;
      }
      setPreview({ signature: snapshot, input: parsed.data, result });
      setConfirming(confirm && result.canClose && result.calculation !== null);
    } catch (error) {
      if (!abort.signal.aborted) {
        setMessage(integrationError(error));
        setPreview(null);
        if (isAxiosError(error) && error.response?.status === 409) await mutation.refresh();
      }
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  async function approve() {
    if (
      !preview ||
      preview.signature !== current.current ||
      !confirming ||
      !preview.result.canClose ||
      !preview.result.calculation ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    setMessage("");
    try {
      await mutation.mutateAsync(preview.input);
      setSaved(true);
      setConfirming(false);
      setPreview(null);
    } catch (error) {
      setUncertain(!isAxiosError(error) || !error.response || error.response.status >= 500);
      setMessage(integrationError(error));
      setConfirming(false);
      setPreview(null);
    } finally {
      inFlight.current = false;
    }
  }
  async function recover() {
    const ok = await mutation.refresh();
    if (ok) {
      setUncertain(false);
      setMessage("");
      setPreview(null);
    }
  }
  return {
    form,
    preview: preview?.signature === signature ? preview.result : null,
    confirming,
    setConfirming,
    loading,
    message,
    uncertain,
    saved,
    mutation,
    loadPreview,
    approve,
    recover,
  };
}
