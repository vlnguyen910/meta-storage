"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CheckInLookupInput, Inspection, InspectionDraftInput } from "@metastorage/contracts";
import {
  INSPECTION_PHOTO_MAX_BYTES,
  INSPECTION_PHOTO_MAX_COUNT,
  InspectionDraftInputSchema,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { FLOW } from "./flow.messages";
export function flowError(error: unknown) {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { message?: string })?.message ?? FLOW.error)
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
  const code = params.get("bookingCode") ?? "";
  const token = params.get("qrToken") ?? "";
  const lookup = useQuery({
    queryKey: ["facility-flow", "lookup", code, token],
    queryFn: () =>
      api.checkIns.lookup({ type: token ? "QR_TOKEN" : "BOOKING_CODE", value: token || code }),
    enabled: !!(code || token),
    retry: false,
  });
  const result = lookup.data;
  const bookingId = result?.booking.id ?? "";
  const history = useQuery({
    queryKey: inspectionKey(bookingId),
    queryFn: () => api.inspections.history(bookingId),
    enabled: !!bookingId,
    retry: false,
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
    mutationFn: () =>
      result?.booking.status === "CHECKED_IN"
        ? Promise.resolve(result)
        : api.checkIns.confirm(bookingId),
    onSuccess: async (data) => {
      queryClient.setQueryData(["facility-flow", "lookup", code, token], data);
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
    onError: (e) => showToast(flowError(e), "error"),
  });
  const start = useMutation({
    mutationFn: () => api.inspections.start(bookingId),
    onSuccess: (data) => {
      queryClient.setQueryData(inspectionKey(bookingId), (old: Inspection[] | undefined) => [
        data,
        ...(old ?? []).filter((i) => i.id !== data.id),
      ]);
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);
  const form = useForm<InspectionDraftInput>({
    resolver: zodResolver(InspectionDraftInputSchema),
    defaultValues: {
      version: record.version,
      correctUnit: record.correctUnit,
      conditionNotes: record.conditionNotes,
    },
  });
  const locked = record.status === "COMPLETED";
  const dirty = form.formState.isDirty;
  useEffect(() => {
    form.reset({
      version: record.version,
      correctUnit: record.correctUnit,
      conditionNotes: record.conditionNotes,
    });
  }, [record.version, record.correctUnit, record.conditionNotes, form]);
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
  const count =
    Number(values.correctUnit === true) +
    Number(!!values.conditionNotes.trim()) +
    Number(record.photos.length > 0);
  function accept(data: Inspection) {
    queryClient.setQueryData(inspectionKey(record.bookingId), (old: Inspection[] | undefined) => [
      data,
      ...(old ?? []).filter((i) => i.id !== data.id),
    ]);
    form.reset({
      version: data.version,
      correctUnit: data.correctUnit,
      conditionNotes: data.conditionNotes,
    });
    return data;
  }
  async function action(work: () => Promise<Inspection>): Promise<Inspection | undefined> {
    if (busy || locked) return undefined;
    setBusy(true);
    setError("");
    try {
      return accept(await work());
    } catch (e) {
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
    if (busy || locked) return;
    if (!(await form.trigger())) return;
    const data = await action(() =>
      api.inspections.save(record.id, { ...form.getValues(), version: record.version }),
    );
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
          version: record.version,
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
          version: record.version,
        });
      return api.inspections.removePhoto(record.id, photoId, saved.version);
    });
  }
  async function complete() {
    if (count !== 3 || !confirmLock) return;
    const data = await action(() => api.inspections.complete(record.id, record.version));
    if (data) {
      showToast(FLOW.completeSuccess, "success");
      onNavigate("handover");
    }
  }
  return {
    form,
    values,
    dirty,
    locked,
    busy,
    error,
    count,
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
    mutationFn: () => api.inspections.handover(record.id, record.version),
    onSuccess: async (data) => {
      queryClient.setQueryData(inspectionKey(record.bookingId), (old: Inspection[] | undefined) => [
        data,
        ...(old ?? []).filter((i) => i.id !== data.id),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["facility-flow", "lookup"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      showToast(FLOW.handoverSuccess, "success");
    },
    onError: async (error) => {
      showToast(flowError(error), "error");
      await queryClient.invalidateQueries({ queryKey: inspectionKey(record.bookingId) });
    },
  });
  return { received, setReceived, mutation };
}
