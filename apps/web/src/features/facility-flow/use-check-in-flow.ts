"use client";
import type {
  AppointmentRecordDto,
  CheckInLookupInput,
  InspectionRecord,
  UpdateInspectionInput,
} from "@metastorage/contracts";
import {
  FacilityTaskStatus,
  FacilityTaskType,
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
import { api } from "@/lib/api";
import { FLOW } from "./flow.messages";
import { appointmentItem } from "./use-dispatch";

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
  const code = params.get("appointmentId") ?? params.get("bookingCode") ?? "";
  const token = params.get("qrToken") ?? "";
  const lookup = useQuery({
    queryKey: ["facility-flow", "lookup", code, token],
    queryFn: async () => {
      let id = token ? normalizeLookup(token) : code;
      try {
        const url = new URL(id);
        id =
          url.searchParams.get("appointmentId") ??
          url.pathname.split("/").filter(Boolean).at(-1) ??
          id;
      } catch {}
      const isId = /^[0-9a-f-]{36}$/i.test(id);
      let appointment: AppointmentRecordDto | undefined;
      try {
        appointment = isId ? await api.appointments.get(id) : undefined;
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
      }
      if (!appointment) {
        const assignments = await api.facilities.myAssignments();
        const scope = assignments.filter((x) => x.isActive);
        for (const facility of scope) {
          const list = await (pathname.startsWith("/staff")
            ? api.appointments.assignedToMe({ facilityId: facility.facilityId })
            : api.appointments.listFacility(facility.facilityId));
          appointment = list.find((x) => x.id === id || x.reservationId === id);
          if (appointment) break;
        }
      }
      if (!appointment) throw new Error(FLOW.emptyTitle);
      const booking = {
        ...appointmentItem(appointment),
        checkInDeadlineAt: `${appointment.scheduledDate}T23:59:59.999+07:00`,
      };
      const r = appointment.reservation;
      const reasons = [];
      if (booking.status !== "CONFIRMED" || appointment.status !== "CONFIRMED")
        reasons.push("INVALID_BOOKING_STATUS");
      if (appointment.paymentStatus !== "SUCCEEDED") reasons.push("PAYMENT_NOT_SUCCEEDED");
      if (!booking.assignedUnit) reasons.push("UNIT_NOT_ASSIGNED");
      return {
        booking,
        payment: {
          status: appointment.paymentStatus,
          paidAt: appointment.paidAt ?? null,
          totalAmount: r?.totalAmount ?? null,
          rentalFeeAmount: r?.rentalFeeAmount ?? null,
          depositAmount: r?.depositAmount ?? null,
          currency: r ? "VND" : null,
        },
        assignedUnit: booking.assignedUnit,
        checkInReadiness: { canProceed: reasons.length === 0, reasons },
      };
    },
    enabled: !!(code || token),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const result = lookup.data;
  const bookingId = result?.booking.id ?? "";
  const recordKey = inspectionKey(result?.booking.reservationId ?? bookingId);
  const history = useQuery({
    queryKey: recordKey,
    queryFn: () => api.inspections.forAppointment(bookingId),
    enabled: !!bookingId,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const current = history.data?.find(
    (inspection) =>
      inspection.inspectionType === "CHECK_IN" &&
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
  async function startInspection() {
    const { items } = await api.flow5.tasks.listMine({
      type: FacilityTaskType.CHECK_IN_HANDOVER,
      referenceId: bookingId,
      limit: 100,
      offset: 0,
    });
    const task = items.find((item) => item.referenceId === bookingId);
    if (!task) throw new Error(FLOW.taskNotFound);
    if (task.status === FacilityTaskStatus.ASSIGNED)
      await api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
    else if (task.status !== FacilityTaskStatus.IN_PROGRESS) throw new Error(FLOW.taskNotReady);
    if (!result?.assignedUnit) throw new Error(FLOW.unassigned);
    return api.inspections.create({
      taskId: task.id,
      storageUnitId: result.assignedUnit.physicalUnitId,
    });
  }
  const verify = useMutation({
    meta: { globalLoading: true },
    mutationFn: startInspection,
    onSuccess: async (inspection) => {
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      const response = await history.refetch();
      queryClient.setQueryData(recordKey, [
        inspection,
        ...(response.data ?? []).filter((item) => item.id !== inspection.id),
      ]);
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
    mutationFn: startInspection,
    onSuccess: async (inspection) => {
      queryClient.setQueryData(recordKey, (old: InspectionRecord[] | undefined) => [
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
