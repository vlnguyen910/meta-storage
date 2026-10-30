"use client";

import {
  FacilityTaskStatus,
  HANDOVER_CHECKLIST_ITEMS,
  type HandoverChecklistItemResult,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_BYTES,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionRecord,
  type PolicyViolationFee,
  ReturnChecklistCompletionSchema,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  UserRound,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OperationalBadge } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { bookingKeys } from "@/features/check-in/hooks";
import { InspectionChecklist } from "@/features/facility-flow/inspection-checklist";
import { InspectionPhotoCard } from "@/features/facility-flow/inspection-screen";
import {
  managementError,
  useFacilityTaskDetail,
  useUpdateTask,
} from "@/features/facility-management/hooks";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { STAFF_WORK as M } from "./staff-work.messages";

export function StaffTaskDetailScreen({ taskId }: { taskId: string }) {
  const router = useRouter();
  const query = useFacilityTaskDetail(taskId);
  const actor = useAuthStore((s) => s.session?.user.id);
  const update = useUpdateTask(taskId);
  const client = useQueryClient();
  const task = query.data;
  const isReturnTask = task?.type === "UNIT_INSPECTION" && task.referenceType === "APPOINTMENT";
  const appointment = useQuery({
    queryKey: ["staff-return-appointment", task?.referenceId],
    queryFn: () => api.appointments.get(task?.referenceId ?? ""),
    enabled: Boolean(isReturnTask && task?.referenceId),
  });
  const history = useQuery({
    queryKey: ["staff-return-inspections", task?.referenceId],
    queryFn: () => api.inspections.forAppointment(task?.referenceId ?? ""),
    enabled: Boolean(isReturnTask && appointment.data?.appointmentType === "CHECK_OUT"),
  });
  const record = history.data?.find((item) => item.taskId === taskId);
  const [recordId, setRecordId] = useState("");
  const [results, setResults] = useState<HandoverChecklistItemResult[]>([]);
  const [notes, setNotes] = useState("");
  const [condition, setCondition] = useState<InspectionRecord["condition"]>("GOOD");
  const [violations, setViolations] = useState<{ code: string; note: string }[]>([]);
  const [policyCatalog, setPolicyCatalog] = useState<{
    version: number;
    items: PolicyViolationFee[];
  } | null>(null);
  const [policyNeedsReview, setPolicyNeedsReview] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState("");
  useEffect(() => {
    if (!record || record.id === recordId) return;
    setRecordId(record.id);
    setResults(
      Array.isArray(record.checklist.results)
        ? record.checklist.results.flatMap((item) => {
            const parsed = HandoverChecklistItemResultSchema.safeParse(item);
            return parsed.success ? [parsed.data] : [];
          })
        : [],
    );
    setNotes(record.notes ?? "");
    setCondition(record.condition ?? "GOOD");
    setViolations(
      record.returnContext?.fees.map(({ code, note }) => ({ code, note: note ?? "" })) ?? [],
    );
  }, [record, recordId]);
  const startReturn = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error(M.returnStartError);
      if (task.status === "ASSIGNED")
        await api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
      return api.inspections.create({ taskId: task.id });
    },
    onSuccess: async () => {
      await Promise.all([query.refetch(), history.refetch()]);
      await client.invalidateQueries({ queryKey: ["staff-return-inspections", task?.referenceId] });
    },
  });
  const saveReturn = useMutation({
    mutationFn: (status: "IN_PROGRESS" | "PASSED") => {
      if (!record?.returnContext) throw new Error(M.returnSaveError);
      return api.inspections.save(record.id, {
        status,
        condition,
        notes,
        checklist: { ...record.checklist, results },
        policyVersion: policyCatalog?.version ?? record.returnContext.policyVersion,
        violations,
      });
    },
    onError: async (error) => {
      if (!axios.isAxiosError(error) || error.response?.status !== 409) return;
      try {
        const catalog = await api.inspections.policyFees();
        const activeItems = catalog.items.filter((fee) => fee.isActive);
        setPolicyCatalog({ ...catalog, items: activeItems });
        setViolations((current) =>
          current.filter((violation) => activeItems.some((fee) => fee.code === violation.code)),
        );
        setPolicyNeedsReview(true);
      } catch {
        // Keep the original inspection data so the staff member can retry after refreshing.
      }
    },
    onSuccess: async (updated) => {
      setRecordId("");
      setPolicyNeedsReview(false);
      setPolicyCatalog(null);
      await Promise.all([
        history.refetch(),
        client.invalidateQueries({ queryKey: ["facility-management"] }),
        client.invalidateQueries({ queryKey: ["rentals"] }),
        client.invalidateQueries({ queryKey: bookingKeys.staffTasks(task?.facilityId) }),
      ]);
      if (updated.status === "PASSED") router.push("/staff/tasks");
    },
  });
  const uploadEvidence = useMutation({
    mutationFn: async (file: File) => {
      if (!record) throw new Error(M.returnPhotoError);
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error(M.returnPhotoError));
        reader.readAsDataURL(file);
      });
      return api.inspections.upload(record.id, {
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64,
      });
    },
    onSuccess: () => void history.refetch(),
  });
  const removeEvidence = useMutation({
    mutationFn: (photoId: string) => {
      if (!record) throw new Error(M.returnPhotoError);
      return api.inspections.removePhoto(record.id, photoId);
    },
    onSuccess: () => void history.refetch(),
  });
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError || query.data.assignedStaffId !== actor)
    return <ErrorState message={M.loadError} onRetry={() => query.refetch()} />;
  const currentTask = query.data;
  const returnRecord = isReturnTask && appointment.data?.appointmentType === "CHECK_OUT";
  if (isReturnTask && appointment.isPending) return <LoadingState variant="detail" />;
  if (isReturnTask && (appointment.isError || appointment.data?.appointmentType !== "CHECK_OUT"))
    return <ErrorState message={M.returnLoadError} onRetry={() => void appointment.refetch()} />;
  if (returnRecord && history.isPending) return <LoadingState variant="detail" />;
  const conditionLabels: Record<string, string> = {
    GOOD: M.good,
    MINOR_DAMAGE: M.minorDamage,
    MAJOR_DAMAGE: M.majorDamage,
  };
  const availableFees = policyCatalog?.items ?? record?.returnContext?.penalties ?? [];
  const selectedFees = availableFees.filter((fee) =>
    violations.some((item) => item.code === fee.code),
  );
  const feeTotal = selectedFees.reduce((sum, fee) => sum + fee.amount, 0);
  const evidencePending = uploadEvidence.isPending || removeEvidence.isPending;
  const canFinalize =
    Boolean(record?.returnContext) &&
    ReturnChecklistCompletionSchema.safeParse(results).success &&
    condition === "GOOD" &&
    feeTotal <= (record?.returnContext?.depositAmount ?? 0);
  function setChecklistResult(code: string, result: "PASS" | "FAIL") {
    setResults((previous) => {
      const old = previous.find((item) => item.itemCode === code);
      return [
        ...previous.filter((item) => item.itemCode !== code),
        {
          itemCode: code,
          resultType: "PASS_FAIL",
          result,
          note: old?.note ?? null,
          photos: old?.photos ?? [],
        },
      ];
    });
  }
  function setChecklistNote(code: string, note: string) {
    setResults((previous) =>
      previous.map((item) => (item.itemCode === code ? { ...item, note } : item)),
    );
  }
  function toggleViolation(code: string, checked: boolean) {
    setViolations((previous) =>
      checked ? [...previous, { code, note: "" }] : previous.filter((item) => item.code !== code),
    );
  }
  function selectEvidence(file?: File) {
    if (!file || !record) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError(M.returnPhotoError);
      return;
    }
    if (file.size > INSPECTION_PHOTO_MAX_BYTES) {
      setPhotoError(M.returnPhotoError);
      return;
    }
    if (record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT) {
      setPhotoError(M.returnPhotoLimit);
      return;
    }
    setPhotoError("");
    uploadEvidence.mutate(file);
  }
  return (
    <div className="space-y-5 pb-6">
      <Link
        href="/staff/tasks"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft size={17} />
        {M.back}
      </Link>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-primary">
              <ClipboardCheck size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {returnRecord ? M.returnWorkspace : M.facilityTasksTitle}
              </p>
              <h1 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
                {returnRecord
                  ? `${M.returnTitle}${record?.unitCode ? ` · ${record.unitCode}` : ""}`
                  : currentTask.description || M.inspect}
              </h1>
              <p className="mt-2 text-xs text-slate-500">
                {M.assignedTime}: {formatDateTime(currentTask.assignedAt)}
              </p>
            </div>
          </div>
          <OperationalBadge
            value={currentTask.status}
            label={
              {
                ASSIGNED: M.assigned,
                IN_PROGRESS: M.inProgress,
                COMPLETED: M.complete,
                CANCELLED: M.cancelled,
              }[currentTask.status]
            }
          />
        </div>
        {returnRecord && appointment.data && (
          <dl className="grid gap-4 border-t border-slate-100 bg-slate-50/70 p-5 text-sm sm:grid-cols-3 sm:px-6">
            <div className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-500">{M.customer}</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {appointment.data.customerName ?? M.returnMissing}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">{appointment.data.contactPhone}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-500">{M.returnAppointment}</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {formatDateTime(
                    `${appointment.data.scheduledDate}T${appointment.data.slotStart ?? "00:00:00"}+07:00`,
                  )}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">{appointment.data.slotName}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Warehouse className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-500">{M.returnUnitCode}</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {record?.unitCode ??
                    appointment.data.assignedUnit?.physicalUnitCode ??
                    M.unitPendingInspection}
                </dd>
              </div>
            </div>
          </dl>
        )}
        <div className="flex flex-wrap gap-2 px-5 pb-4 sm:px-6">
          {!returnRecord && currentTask.status === "ASSIGNED" && (
            <Button
              disabled={update.isPending}
              onClick={() => update.mutate({ status: FacilityTaskStatus.IN_PROGRESS })}
            >
              {M.openTask}
            </Button>
          )}
          {!returnRecord && currentTask.status === "IN_PROGRESS" && (
            <Button
              disabled={update.isPending}
              onClick={() => update.mutate({ status: FacilityTaskStatus.COMPLETED })}
            >
              {M.complete}
            </Button>
          )}
          {!isReturnTask && update.isError && <p role="alert">{managementError(update.error)}</p>}
          {update.isSuccess && <p role="status">{M.complete}</p>}
        </div>
      </section>
      {returnRecord && (
        <section className="space-y-5">
          {history.isError ? (
            <ErrorState message={M.returnLoadError} onRetry={() => void history.refetch()} />
          ) : !record ? (
            <section className="rounded-2xl border border-emerald-100 bg-white px-5 py-8 shadow-xs sm:px-8">
              <div className="mx-auto max-w-xl text-center">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-emerald-50 text-primary">
                  <ClipboardCheck size={28} aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-slate-900">{M.returnReady}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{M.returnStartHint}</p>
                <div className="my-6 flex flex-wrap justify-center gap-2 text-xs font-medium text-slate-600">
                  {[M.returnCheck, M.returnEvidence, M.returnFees].map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    startReturn.isPending ||
                    currentTask.status === "COMPLETED" ||
                    currentTask.status === "CANCELLED"
                  }
                  onClick={() => startReturn.mutate()}
                >
                  {startReturn.isPending ? M.inProgress : M.returnStart}
                </Button>
              </div>
            </section>
          ) : (
            <>
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
                <div className="min-w-0 space-y-5">
                  <Card className="space-y-4 rounded-2xl border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{M.returnCheck}</h2>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {M.checkProgress(results.length, HANDOVER_CHECKLIST_ITEMS.length)}
                      </span>
                    </div>
                    <InspectionChecklist
                      items={HANDOVER_CHECKLIST_ITEMS}
                      results={results}
                      disabled={record.status === "PASSED" || saveReturn.isPending}
                      onChange={setChecklistResult}
                      onNoteChange={setChecklistNote}
                    />
                    <label className="grid gap-2 text-sm font-semibold">
                      {M.returnConditionLabel}
                      <select
                        className="min-h-11 rounded-lg border border-line px-3"
                        value={condition ?? ""}
                        disabled={
                          record.status === "PASSED" || saveReturn.isPending || evidencePending
                        }
                        onChange={(event) =>
                          setCondition(
                            (event.target.value || null) as InspectionRecord["condition"],
                          )
                        }
                      >
                        <option value="GOOD">{M.good}</option>
                        <option value="MINOR_DAMAGE">{M.minorDamage}</option>
                        <option value="MAJOR_DAMAGE">{M.majorDamage}</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      {M.inspectionNotes}
                      <textarea
                        className="min-h-24 rounded-lg border border-line p-3"
                        maxLength={4000}
                        value={notes}
                        disabled={
                          record.status === "PASSED" || saveReturn.isPending || evidencePending
                        }
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </label>
                  </Card>
                  <Card className="space-y-4 rounded-2xl border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">
                        {M.returnEvidence} ({record.evidence.length}/{INSPECTION_PHOTO_MAX_COUNT})
                      </h2>
                      {record.status !== "PASSED" && (
                        <>
                          <input
                            ref={photoInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            aria-label={M.returnAddPhoto}
                            onChange={(event) => {
                              selectEvidence(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                          <Button
                            variant="outline"
                            disabled={
                              uploadEvidence.isPending ||
                              removeEvidence.isPending ||
                              saveReturn.isPending ||
                              record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT
                            }
                            onClick={() => photoInput.current?.click()}
                          >
                            <Camera size={16} />
                            {uploadEvidence.isPending ? M.returnPhotoUploading : M.returnAddPhoto}
                          </Button>
                        </>
                      )}
                    </div>
                    {photoError && (
                      <p role="alert" className="text-sm text-danger">
                        {photoError}
                      </p>
                    )}
                    {(uploadEvidence.isError || removeEvidence.isError) && (
                      <p role="alert" className="text-sm text-danger">
                        {M.returnPhotoSaveError}
                      </p>
                    )}
                    {record.evidence.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {record.evidence.map((photo) => (
                          <InspectionPhotoCard
                            key={photo.id}
                            photo={photo}
                            onRemove={
                              record.status === "PASSED" ? undefined : removeEvidence.mutate
                            }
                            disabled={
                              removeEvidence.isPending ||
                              uploadEvidence.isPending ||
                              saveReturn.isPending
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">{M.returnNoEvidence}</p>
                    )}
                  </Card>
                </div>
                <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
                  {record.returnContext && (
                    <Card className="space-y-3 rounded-2xl border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                      <h2 className="text-lg font-semibold">{M.returnContext}</h2>
                      {record.returnContext.checkIn ? (
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <p>
                            {M.checkInCondition}:{" "}
                            {conditionLabels[record.returnContext.checkIn.condition ?? ""] ??
                              M.returnMissing}
                          </p>
                          <p>
                            {M.inspectionTime}:{" "}
                            {formatDateTime(record.returnContext.checkIn.inspectedAt)}
                          </p>
                          <p className="sm:col-span-2 whitespace-pre-wrap">
                            {record.returnContext.checkIn.notes || M.returnMissing}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted">{M.noCheckInRecord}</p>
                      )}
                      <p className="text-sm">
                        {M.returnDeposit}:{" "}
                        <strong>
                          {record.returnContext.depositAmount.toLocaleString("vi-VN")} đ
                        </strong>
                      </p>
                    </Card>
                  )}
                  {record.returnContext && (
                    <Card className="space-y-3 rounded-2xl border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                      <h2 className="text-lg font-semibold">{M.returnFees}</h2>
                      {availableFees.length ? (
                        availableFees.map((fee) => {
                          const selected = violations.find((item) => item.code === fee.code);
                          return (
                            <div
                              key={fee.code}
                              className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_auto]"
                            >
                              <label className="flex items-center gap-3 text-sm font-semibold">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected)}
                                  disabled={
                                    record.status === "PASSED" ||
                                    saveReturn.isPending ||
                                    evidencePending
                                  }
                                  onChange={(event) =>
                                    toggleViolation(fee.code, event.target.checked)
                                  }
                                />
                                <span>{fee.name}</span>
                              </label>
                              <strong className="text-sm tabular-nums">
                                {fee.amount.toLocaleString("vi-VN")} đ
                              </strong>
                              {selected && (
                                <textarea
                                  className="min-h-16 rounded-lg border border-line p-2 text-sm sm:col-span-2"
                                  maxLength={1000}
                                  aria-label={`${fee.name}: ${M.returnFeeNote}`}
                                  placeholder={M.returnFeeNote}
                                  value={selected.note}
                                  disabled={
                                    record.status === "PASSED" ||
                                    saveReturn.isPending ||
                                    evidencePending
                                  }
                                  onChange={(event) =>
                                    setViolations((previous) =>
                                      previous.map((item) =>
                                        item.code === fee.code
                                          ? { ...item, note: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted">{M.returnNoFees}</p>
                      )}
                      <div className="rounded-xl bg-primary-soft p-4 text-sm">
                        <p>
                          {M.returnEstimate}:{" "}
                          <strong>
                            {Math.max(
                              0,
                              record.returnContext.depositAmount - feeTotal,
                            ).toLocaleString("vi-VN")}{" "}
                            đ
                          </strong>
                        </p>
                        <p className="mt-1 text-xs text-muted">{M.returnEstimateHint}</p>
                      </div>
                    </Card>
                  )}
                </aside>
              </div>
              {saveReturn.isError && (
                <p role="alert" className="text-sm text-danger">
                  {M.returnSaveError}
                </p>
              )}
              {policyNeedsReview && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
                >
                  <span>{M.returnPolicyChanged}</span>
                  <Button variant="outline" onClick={() => setPolicyNeedsReview(false)}>
                    {M.returnPolicyReviewed}
                  </Button>
                </div>
              )}
              {record.status !== "PASSED" && (
                <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:px-6">
                  <Button
                    variant="outline"
                    disabled={saveReturn.isPending || evidencePending || policyNeedsReview}
                    onClick={() => saveReturn.mutate("IN_PROGRESS")}
                  >
                    {M.returnSave}
                  </Button>
                  <Button
                    disabled={
                      !canFinalize || saveReturn.isPending || evidencePending || policyNeedsReview
                    }
                    onClick={() => saveReturn.mutate("PASSED")}
                  >
                    {saveReturn.isPending ? M.inProgress : M.returnFinalize}
                  </Button>
                </div>
              )}
              {record.status === "PASSED" && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm font-semibold text-emerald-800"
                >
                  <CheckCircle2 size={18} />
                  {M.returnFinalized}
                </p>
              )}
              {(!ReturnChecklistCompletionSchema.safeParse(results).success ||
                condition !== "GOOD") &&
                record.status !== "PASSED" && (
                  <p className="text-sm text-muted">
                    {condition !== "GOOD" ? M.returnConditionRequired : M.returnChecklistRequired}
                  </p>
                )}
              {feeTotal > (record.returnContext?.depositAmount ?? 0) && (
                <p role="alert" className="text-sm text-danger">
                  {M.returnFeeLimit}
                </p>
              )}
            </>
          )}
          {startReturn.isError && (
            <p role="alert" className="text-sm text-danger">
              {M.returnStartError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
