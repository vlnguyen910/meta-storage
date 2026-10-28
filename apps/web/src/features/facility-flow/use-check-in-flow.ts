"use client";
import type {
  CheckInLookupInput,
  InspectionRecord,
  UpdateInspectionInput,
} from "@metastorage/contracts";
import {
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_BYTES,
  INSPECTION_PHOTO_MAX_COUNT,
  InspectionConditionValueSchema,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
    (inspection) =>
      inspection.inspectionType === "CHECK_IN" &&
      inspection.reservationId === bookingId &&
      inspection.storageUnitId === result?.assignedUnit?.physicalUnitId,
  );
  const view = params.get("view") ?? "verify";
  const navigate = (next: string) => {
    const query = new URLSearchParams(params.toString());
    if (next === "verify") query.delete("view");
    else query.set("view", next);
    router.push(`${pathname}?${query.toString()}`);
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
          (inspection) =>
            inspection.inspectionType === "CHECK_IN" &&
            inspection.reservationId === bookingId &&
            inspection.storageUnitId === data.assignedUnit?.physicalUnitId,
        )
      ) {
        try {
          const inspection = await api.inspections.start(bookingId);
          queryClient.setQueryData(inspectionKey(bookingId), [
            inspection,
            ...(response.data ?? []),
          ]);
        } catch (error) {
          showToast(flowError(error), "error");
        }
      }
      navigate("inspect");
    },
    onError: async (error) => {
      showToast(flowError(error), "error");
      await queryClient.invalidateQueries({ queryKey: ["facility-flow", "lookup"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
  const start = useMutation({
    meta: { globalLoading: true },
    mutationFn: () => api.inspections.start(bookingId),
    onSuccess: async (inspection) => {
      queryClient.setQueryData(inspectionKey(bookingId), (old: InspectionRecord[] | undefined) => [
        inspection,
        ...(old ?? []).filter((item) => item.id !== inspection.id),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (error) => showToast(flowError(error), "error"),
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

export function readResults(checklist: Record<string, unknown>) {
  const value = checklist.results;
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = HandoverChecklistItemResultSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
}

export function useInspectionEditor(record: InspectionRecord, onNavigate: (next: string) => void) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { runWithGlobalLoading } = useGlobalLoading();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(() => readResults(record.checklist));
  const [condition, setCondition] = useState(record.condition);
  const [notes, setNotes] = useState(record.notes ?? "");
  const locked = record.status === "PASSED" || record.status === "FAILED";
  const dirty =
    JSON.stringify(results) !== JSON.stringify(readResults(record.checklist)) ||
    condition !== record.condition ||
    notes !== (record.notes ?? "");

  useEffect(() => {
    if (dirty) return;
    setResults(readResults(record.checklist));
    setCondition(record.condition);
    setNotes(record.notes ?? "");
  }, [record.checklist, record.condition, record.notes, dirty]);

  const items = HANDOVER_CHECKLIST_ITEMS;
  const count = items.filter((item) =>
    results.some((entry) => entry.itemCode === item.code && entry.result === "PASS"),
  ).length;
  const canComplete = HandoverChecklistCompletionSchema.safeParse(results).success;
  function setResult(itemCode: string, result: "PASS" | "FAIL") {
    setResults((previous) => {
      const old = previous.find((entry) => entry.itemCode === itemCode);
      return [
        ...previous.filter((entry) => entry.itemCode !== itemCode),
        {
          itemCode,
          resultType: "PASS_FAIL",
          result,
          note: old?.note ?? null,
          photos: old?.photos ?? [],
        },
      ];
    });
  }

  function updateInput(
    status: UpdateInspectionInput["status"] = "IN_PROGRESS",
  ): UpdateInspectionInput {
    return {
      status,
      condition,
      checklist: { ...record.checklist, results },
      notes: notes.trim() || null,
    };
  }
  function accept(data: InspectionRecord) {
    if (data.reservationId) {
      queryClient.setQueryData(
        inspectionKey(data.reservationId),
        (old: InspectionRecord[] | undefined) => [
          data,
          ...(old ?? []).filter((item) => item.id !== data.id),
        ],
      );
    }
    setResults(readResults(data.checklist));
    setCondition(data.condition);
    setNotes(data.notes ?? "");
    return data;
  }
  async function action(work: () => Promise<InspectionRecord>) {
    if (busy || locked) return undefined;
    setBusy(true);
    setError("");
    try {
      return accept(await runWithGlobalLoading(work));
    } catch (cause) {
      const message = flowError(cause);
      setError(message);
      showToast(message, "error");
      if (record.reservationId)
        await queryClient.invalidateQueries({ queryKey: inspectionKey(record.reservationId) });
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function save(next?: string) {
    const data = await action(() => api.inspections.save(record.id, updateInput()));
    if (!data) return;
    if (next) onNavigate(next);
    else showToast(FLOW.saveSuccess, "success");
  }
  async function upload(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > INSPECTION_PHOTO_MAX_BYTES
    ) {
      setError(FLOW.photoError);
      return;
    }
    if (record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT) {
      setError(FLOW.photoLimit);
      return;
    }
    await action(async () => {
      if (dirty) await api.inspections.save(record.id, updateInput());
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error(FLOW.photoError));
        reader.readAsDataURL(file);
      });
      return api.inspections.upload(record.id, {
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64,
      });
    });
  }
  async function remove(photoId: string) {
    await action(async () => {
      if (dirty) await api.inspections.save(record.id, updateInput());
      return api.inspections.removePhoto(record.id, photoId);
    });
  }
  async function complete() {
    if (!canComplete || dirty) return;
    const parsedCondition = InspectionConditionValueSchema.safeParse(condition);
    const data = await action(() =>
      api.inspections.save(record.id, {
        ...updateInput("PASSED"),
        condition: parsedCondition.success ? parsedCondition.data : "GOOD",
      }),
    );
    if (!data) return;
    await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    showToast(FLOW.completeSuccess, "success");
    onNavigate("handover");
  }

  return {
    values: { results, condition, notes },
    setNotes,
    setCondition,
    dirty,
    locked,
    busy,
    error,
    count,
    items,
    canComplete,
    setResult,
    save,
    upload,
    remove,
    complete,
  };
}

export function useHandover(record: InspectionRecord) {
  const [received, setReceived] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: () => api.inspections.handover(record.id, { customerReceivedUnit: true }),
    onSuccess: async (data) => {
      if (record.reservationId)
        queryClient.setQueryData(
          inspectionKey(record.reservationId),
          (old: InspectionRecord[] | undefined) => [
            data,
            ...(old ?? []).filter((item) => item.id !== data.id),
          ],
        );
      await queryClient.invalidateQueries({ queryKey: ["facility-flow", "lookup"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["rentals"] });
      showToast(FLOW.handoverSuccess, "success");
    },
    onError: async (cause) => {
      showToast(flowError(cause), "error");
      if (record.reservationId)
        await queryClient.invalidateQueries({ queryKey: inspectionKey(record.reservationId) });
    },
  });
  return { received, setReceived, mutation };
}
