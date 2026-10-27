"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CheckInLookupInput, Inspection, InspectionDraftInput } from "@metastorage/contracts";
import {
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  INSPECTION_PHOTO_MAX_BYTES,
  INSPECTION_PHOTO_MAX_COUNT,
  InspectionDraftInputSchema,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { FLOW } from "./flow.messages";
export function flowError(error: unknown) {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: { message?: string }; message?: string })?.error
        ?.message ??
        error.response?.data?.message ??
        FLOW.error)
    : error instanceof Error
      ? error.message
      : FLOW.error;
}
export function normalizeLookup(value: string) {
  try {
    return new URL(value.trim()).searchParams.get("token") ?? value.trim();
  } catch {
    return value.trim();
  }
}
export const inspectionKey = (bookingId: string) =>
  ["facility-flow", "inspections", bookingId] as const;
export function useCheckInFlow() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { showToast } = useToast();
  const userId = useAuthStore((state) => state.session?.user.id);
  const code = params.get("bookingCode") ?? "";
  const token = params.get("qrToken") ?? "";
  const lookup = useQuery({
    queryKey: ["facility-flow", "lookup", code, token],
    queryFn: () =>
      api.checkIns.lookup({ type: token ? "QR_TOKEN" : "BOOKING_CODE", value: token || code }),
    enabled: !!(code || token),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const result = lookup.data;
  const bookingId = result?.booking.id ?? "";
  const history = useQuery({
    queryKey: inspectionKey(bookingId),
    queryFn: () => api.inspections.history(bookingId),
    enabled: !!bookingId,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const current = history.data?.find(
    (i) =>
      i.unitAssignmentId === result?.assignedUnit?.id &&
      i.verificationId === result?.verification?.id,
  );
  const view = params.get("view") ?? "verify";
  const navigate = (next: string) => {
    const q = new URLSearchParams(params.toString());
    if (next === "verify") q.delete("view");
    else q.set("view", next);
    router.push(`${pathname}?${q.toString()}`);
  };
  const queryClient = useQueryClient();
  const verify = useMutation({
    meta: { globalLoading: true },
    mutationFn: () =>
      result?.booking.status === "CHECKED_IN" ||
      (result?.verification?.status === "VERIFIED" && result.verification.staffId === userId)
        ? Promise.resolve(result)
        : api.checkIns.confirm(bookingId),
    onSuccess: async (data) => {
      queryClient.setQueryData(["facility-flow", "lookup", code, token], data);
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      const response = await history.refetch();
      if (
        !response.isError &&
        !response.data?.some(
          (i) =>
            i.unitAssignmentId === data.assignedUnit?.id &&
            i.verificationId === data.verification?.id,
        )
      ) {
        try {
          const record = await api.inspections.start(bookingId);
          queryClient.setQueryData(inspectionKey(bookingId), [record, ...(response.data ?? [])]);
        } catch (error) {
          showToast(flowError(error), "error");
        }
      }
      navigate("inspect");
    },
    onError: async (e) => {
      showToast(flowError(e), "error");
      await queryClient.invalidateQueries({ queryKey: ["facility-flow", "lookup"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
  const start = useMutation({
    meta: { globalLoading: true },
    mutationFn: () => api.inspections.start(bookingId),
    onSuccess: async (data) => {
      queryClient.setQueryData(inspectionKey(bookingId), (old: Inspection[] | undefined) => [
        data,
        ...(old ?? []).filter((i) => i.id !== data.id),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => showToast(flowError(e), "error"),
  });
  function search(type: CheckInLookupInput["type"], value: string) {
    if (!value.trim()) {
      showToast(FLOW.lookupRequired, "error");
      return;
    }
    router.push(
      `${pathname}?${type === "QR_TOKEN" ? "qrToken" : "bookingCode"}=${encodeURIComponent(type === "QR_TOKEN" ? normalizeLookup(value) : value.trim())}`,
    );
  }
  return { lookup, result, history, current, view, navigate, verify, start, search };
}
export function useInspectionEditor(record: Inspection, onNavigate: (next: string) => void) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { runWithGlobalLoading } = useGlobalLoading();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);
  const [serverConflict, setServerConflict] = useState(false);
  const [comparison, setComparison] = useState<Inspection | null>(null);
  const recordId = useRef(record.id);
  const form = useForm<InspectionDraftInput>({
    resolver: zodResolver(InspectionDraftInputSchema),
    defaultValues: {
      version: record.version,
      results: record.results ?? [],
      correctUnit: record.correctUnit,
      conditionNotes: record.conditionNotes,
    },
  });
  const locked = record.status === "COMPLETED";
  const dirty = form.formState.isDirty;
  useEffect(() => {
    if (recordId.current === record.id && form.formState.isDirty) return;
    recordId.current = record.id;
    form.reset({
      version: record.version,
      results: record.results ?? [],
      correctUnit: record.correctUnit,
      conditionNotes: record.conditionNotes,
    });
    setConfirmLock(false);
    setComparison(null);
    setServerConflict(false);
  }, [record.id, record.version, record.correctUnit, record.conditionNotes, record.results, form]);
  useEffect(() => {
    if (!dirty) return;
    const listener = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const guardLinks = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link?.getAttribute("href")?.startsWith("/")) return;
      if (!window.confirm(FLOW.confirmLeave)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", listener);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", listener);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [dirty]);
  const values = form.watch();
  const conflict = serverConflict || values.version !== record.version;
  const canKeepDraft =
    !!comparison &&
    comparison.status === "DRAFT" &&
    comparison.unitAssignmentId === record.unitAssignmentId &&
    comparison.verificationId === record.verificationId &&
    comparison.checklistVersion === record.checklistVersion;
  const items = record.checklistDefinition?.length
    ? record.checklistDefinition
    : HANDOVER_CHECKLIST_ITEMS;
  const count = items.filter((item) =>
    values.results?.some((entry) => entry.itemCode === item.code && entry.result === "PASS"),
  ).length;
  const canComplete = HandoverChecklistCompletionSchema.safeParse(values.results).success;
  function setResult(itemCode: string, result: "PASS" | "FAIL") {
    const previous = form.getValues("results") ?? [];
    const old = previous.find((entry) => entry.itemCode === itemCode);
    form.setValue(
      "results",
      [
        ...previous.filter((entry) => entry.itemCode !== itemCode),
        {
          itemCode,
          resultType: "PASS_FAIL",
          result,
          note: old?.note ?? null,
          photos: old?.photos ?? [],
        },
      ],
      { shouldDirty: true },
    );
    if (itemCode === "ASSIGNED_UNIT")
      form.setValue("correctUnit", result === "PASS", { shouldDirty: true });
  }
  function accept(data: Inspection) {
    queryClient.setQueryData(inspectionKey(record.bookingId), (old: Inspection[] | undefined) => [
      data,
      ...(old ?? []).filter((i) => i.id !== data.id),
    ]);
    form.reset({
      version: data.version,
      results: data.results ?? [],
      correctUnit: data.correctUnit,
      conditionNotes: data.conditionNotes,
    });
    setServerConflict(false);
    setComparison(null);
    return data;
  }
  async function refreshForComparison() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const records = await queryClient.fetchQuery({
        queryKey: inspectionKey(record.bookingId),
        queryFn: () => api.inspections.history(record.bookingId),
        staleTime: 0,
      });
      const latest = records.find((item) => item.id === record.id);
      if (!latest) throw new Error(FLOW.comparisonUnavailable);
      setComparison(latest);
    } catch (error) {
      setError(flowError(error));
    } finally {
      setBusy(false);
    }
  }
  function keepDraft() {
    if (!comparison || !canKeepDraft || busy) return;
    const draft = form.getValues();
    form.reset({
      version: comparison.version,
      results: comparison.results ?? [],
      correctUnit: comparison.correctUnit,
      conditionNotes: comparison.conditionNotes,
    });
    form.setValue("results", draft.results, { shouldDirty: true });
    form.setValue("correctUnit", draft.correctUnit, { shouldDirty: true });
    form.setValue("conditionNotes", draft.conditionNotes, { shouldDirty: true });
    setConfirmLock(false);
    setServerConflict(false);
    setComparison(null);
    setError("");
  }
  function loadServerDraft() {
    if (!comparison || busy) return;
    accept(comparison);
    setConfirmLock(false);
    setError("");
  }
  async function action(work: () => Promise<Inspection>): Promise<Inspection | undefined> {
    if (busy || locked || conflict) return undefined;
    setBusy(true);
    setError("");
    try {
      return accept(await runWithGlobalLoading(work));
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) setServerConflict(true);
      const msg = flowError(e);
      setError(msg);
      showToast(msg, "error");
      await queryClient.invalidateQueries({ queryKey: inspectionKey(record.bookingId) });
    } finally {
      setBusy(false);
    }
    return undefined;
  }
  async function save(next?: string) {
    if (busy || locked || conflict) return;
    if (!(await form.trigger())) return;
    const data = await action(() => api.inspections.save(record.id, form.getValues()));
    if (data) {
      if (next) onNavigate(next);
      else showToast(FLOW.saveSuccess, "success");
    }
  }
  async function upload(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > INSPECTION_PHOTO_MAX_BYTES
    ) {
      setError(FLOW.photoError);
      return;
    }
    if (record.photos.length >= INSPECTION_PHOTO_MAX_COUNT) {
      setError(FLOW.photoLimit);
      return;
    }
    await action(async () => {
      let saved = record;
      if (dirty)
        saved = await api.inspections.save(record.id, {
          ...form.getValues(),
          version: form.getValues("version"),
        });
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error(FLOW.photoError));
        reader.readAsDataURL(file);
      });
      return api.inspections.upload(record.id, {
        version: saved.version,
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: data,
      });
    });
  }
  async function remove(photoId: string) {
    await action(async () => {
      let saved = record;
      if (dirty)
        saved = await api.inspections.save(record.id, {
          ...form.getValues(),
          version: form.getValues("version"),
        });
      return api.inspections.removePhoto(record.id, photoId, saved.version);
    });
  }
  async function complete() {
    if (!canComplete || !confirmLock || dirty) return;
    const data = await action(() => api.inspections.complete(record.id, record.version));
    if (data) {
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      showToast(FLOW.completeSuccess, "success");
      onNavigate("handover");
    }
  }
  return {
    form,
    values,
    dirty,
    locked,
    conflict,
    comparison,
    canKeepDraft,
    refreshForComparison,
    keepDraft,
    loadServerDraft,
    busy,
    error,
    count,
    items,
    canComplete,
    setResult,
    save,
    upload,
    remove,
    confirmLock,
    setConfirmLock,
    complete,
  };
}

export function useHandover(record: Inspection) {
  const [received, setReceived] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: () => api.inspections.handover(record.id, record.version),
    onSuccess: async (data) => {
      queryClient.setQueryData(inspectionKey(record.bookingId), (old: Inspection[] | undefined) => [
        data,
        ...(old ?? []).filter((i) => i.id !== data.id),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["facility-flow", "lookup"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["rentals"] });
      showToast(FLOW.handoverSuccess, "success");
    },
    onError: async (error) => {
      showToast(flowError(error), "error");
      await queryClient.invalidateQueries({ queryKey: inspectionKey(record.bookingId) });
    },
  });
  return { received, setReceived, mutation };
}
