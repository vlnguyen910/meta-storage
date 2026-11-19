"use client";

import {
  FacilityTaskStatus,
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  type HandoverChecklistItemResult,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionRecord,
  MaintenanceChecklistCompletionSchema,
  type UpdateInspectionInput,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OperationalBadge } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useOperationalSettings } from "@/features/administration/use-system-settings";
import { useAuthStore } from "@/features/auth/auth-store";
import { InspectionChecklist } from "@/features/facility-flow/inspection-checklist";
import { InspectionPhotoCard } from "@/features/facility-flow/inspection-screen";
import { managementError, useFacilityTaskDetail } from "@/features/facility-management/hooks";
import { api } from "@/lib/api";
import { readFileBase64 } from "@/lib/read-file-base64";
import { STAFF_WORK as M } from "./staff-work.messages";

type Condition = NonNullable<InspectionRecord["condition"]>;

export function StaffUnitInspectionScreen({ taskId }: { taskId: string }) {
  const { showToast } = useToast();
  const query = useFacilityTaskDetail(taskId);
  const actor = useAuthStore((state) => state.session?.user.id);
  const { data: operationalSettings } = useOperationalSettings();
  const maxUploadBytes = (operationalSettings?.CLOUDINARY_MAX_UPLOAD_MB ?? 3) * 1024 * 1024;
  const client = useQueryClient();
  const task = query.data;
  const recordQuery = useQuery({
    queryKey: ["staff-unit-inspection", taskId],
    queryFn: () => api.inspections.create({ taskId }),
    enabled:
      task?.status === FacilityTaskStatus.IN_PROGRESS ||
      task?.status === FacilityTaskStatus.COMPLETED,
  });
  const record = recordQuery.data;
  const [results, setResults] = useState<HandoverChecklistItemResult[]>([]);
  const [condition, setCondition] = useState<Condition>("GOOD");
  const [notes, setNotes] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const hydratedRecordId = useRef<string | null>(null);

  useEffect(() => {
    if (!record || hydratedRecordId.current === record.id) return;
    hydratedRecordId.current = record.id;
    setResults(
      Array.isArray(record.checklist.results)
        ? record.checklist.results.flatMap((item) => {
            const parsed = HandoverChecklistItemResultSchema.safeParse(item);
            return parsed.success ? [parsed.data] : [];
          })
        : [],
    );
    setCondition(record.condition ?? "GOOD");
    setNotes(record.notes ?? "");
  }, [record]);

  const start = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error(M.unitInspectionStartError);
      if (task.status === FacilityTaskStatus.ASSIGNED)
        await api.flow5.tasks.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS });
      return api.inspections.create({ taskId: task.id });
    },
    onSuccess: async (created) => {
      client.setQueryData(["staff-unit-inspection", taskId], created);
      await Promise.all([query.refetch(), recordQuery.refetch()]);
      showToast(M.unitInspectionStarted, "success");
    },
  });
  const save = useMutation({
    mutationFn: (input: UpdateInspectionInput) => {
      if (!record) throw new Error(M.unitInspectionSaveError);
      return api.inspections.save(record.id, input);
    },
    onSuccess: async (updated) => {
      client.setQueryData(["staff-unit-inspection", taskId], updated);
      await Promise.all([
        query.refetch(),
        recordQuery.refetch(),
        client.invalidateQueries({ queryKey: ["facility-management"] }),
      ]);
      showToast(
        updated.status === "FAILED"
          ? M.unitInspectionFailed
          : updated.status === "PASSED"
            ? M.unitInspectionPassed
            : M.returnSaved,
        "success",
      );
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!record) throw new Error(M.returnPhotoError);
      const dataBase64 = await readFileBase64(file).catch(() => {
        throw new Error(M.returnPhotoError);
      });
      return api.inspections.upload(record.id, {
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64,
      });
    },
    onSuccess: () => void recordQuery.refetch(),
  });
  const removePhoto = useMutation({
    mutationFn: (photoId: string) => {
      if (!record) throw new Error(M.returnPhotoError);
      return api.inspections.removePhoto(record.id, photoId);
    },
    onSuccess: () => void recordQuery.refetch(),
  });

  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError || !task || task.assignedStaffId !== actor)
    return <ErrorState message={M.loadError} onRetry={() => void query.refetch()} />;
  if (task.type !== "UNIT_INSPECTION" || task.referenceType !== "STORAGE_UNIT")
    return (
      <ErrorState message={M.unitInspectionContextError} onRetry={() => void query.refetch()} />
    );

  const locked = record?.status === "PASSED" || record?.status === "FAILED";
  const busy = start.isPending || save.isPending || upload.isPending || removePhoto.isPending;
  const checklistCanPass = HandoverChecklistCompletionSchema.safeParse(results).success;
  const checklistCanFail = MaintenanceChecklistCompletionSchema.safeParse(results).success;
  const canPass = Boolean(condition) && checklistCanPass;
  const canFail = Boolean(condition) && checklistCanFail;
  function setChecklistResult(code: string, result: "PASS" | "FAIL" | null) {
    setResults((previous) => {
      if (!result) return previous.filter((item) => item.itemCode !== code);
      const current = previous.find((item) => item.itemCode === code);
      return [
        ...previous.filter((item) => item.itemCode !== code),
        {
          itemCode: code,
          resultType: "PASS_FAIL",
          result,
          note: current?.note ?? null,
          photos: current?.photos ?? [],
        },
      ];
    });
  }
  function saveResult(status: "IN_PROGRESS" | "PASSED" | "FAILED") {
    if (!record) return;
    save.mutate({ status, condition, notes, checklist: { ...record.checklist, results } });
  }
  function uploadSelected(file?: File) {
    if (!file || !record) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast(M.returnPhotoFormatError, "error");
      return;
    }
    if (file.size > maxUploadBytes) {
      const maxMb = Math.round(maxUploadBytes / (1024 * 1024));
      showToast(M.returnPhotoSizeError(maxMb), "error");
      return;
    }
    const maxPhotos = record.maxEvidenceCount ?? INSPECTION_PHOTO_MAX_COUNT;
    if (record.evidence.length >= maxPhotos) {
      showToast(M.returnPhotoLimit(maxPhotos), "error");
      return;
    }
    upload.mutate(file);
  }

  return (
    <div className="space-y-5 pb-6">
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{M.unitInspectionTitle}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {task.description || M.unitInspectionDescription}
            </p>
          </div>
          <OperationalBadge value={task.status} />
        </div>
        <p className="text-xs text-slate-500">
          {M.unitInspectionUnit}: {record?.unitCode ?? task.referenceId}
        </p>
      </Card>

      {recordQuery.isError && (
        <ErrorState
          message={managementError(recordQuery.error)}
          onRetry={() => void recordQuery.refetch()}
        />
      )}
      {recordQuery.isPending && <LoadingState variant="detail" />}
      {!record && (
        <Card className="space-y-4 p-6">
          <p className="text-sm leading-6 text-slate-600">{M.unitInspectionStartHint}</p>
          <Button
            variant="primary"
            loading={start.isPending}
            disabled={start.isPending}
            onClick={() => start.mutate()}
          >
            {task.status === FacilityTaskStatus.IN_PROGRESS
              ? M.unitInspectionContinue
              : M.unitInspectionStart}
          </Button>
          {start.isError && (
            <p role="alert" className="text-sm text-danger">
              {managementError(start.error)}
            </p>
          )}
        </Card>
      )}
      {record && (
        <>
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{M.unitInspectionChecklist}</h2>
              <OperationalBadge value={record.status} />
            </div>
            <InspectionChecklist
              items={HANDOVER_CHECKLIST_ITEMS}
              results={results}
              disabled={Boolean(locked) || busy}
              onChange={setChecklistResult}
              onNoteChange={(code, note) =>
                setResults((previous) =>
                  previous.map((item) => (item.itemCode === code ? { ...item, note } : item)),
                )
              }
            />
            <label className="grid gap-2 text-sm font-semibold">
              {M.returnConditionLabel}
              <select
                value={condition}
                disabled={Boolean(locked) || busy}
                onChange={(event) => setCondition(event.target.value as Condition)}
                className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal"
              >
                <option value="GOOD">{M.good}</option>
                <option value="MINOR_DAMAGE">{M.minorDamage}</option>
                <option value="MAJOR_DAMAGE">{M.majorDamage}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              {M.inspectionNotes}
              <textarea
                value={notes}
                maxLength={4000}
                disabled={Boolean(locked) || busy}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-24 rounded-lg border border-line p-3 text-sm font-normal"
              />
            </label>
          </Card>
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{M.returnEvidence}</h2>
              <span className="text-xs text-muted">
                {record.evidence.length}/{record.maxEvidenceCount ?? INSPECTION_PHOTO_MAX_COUNT}
              </span>
            </div>
            {!locked && (
              <>
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    uploadSelected(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    record.evidence.length >=
                      (record.maxEvidenceCount ?? INSPECTION_PHOTO_MAX_COUNT)
                  }
                  onClick={() => photoInput.current?.click()}
                >
                  {M.returnAddPhoto}
                </Button>
              </>
            )}
            {record.evidence.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {record.evidence.map((photo) => (
                  <InspectionPhotoCard
                    key={photo.id}
                    photo={photo}
                    onRemove={locked ? undefined : removePhoto.mutate}
                    disabled={busy}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{M.returnNoEvidence}</p>
            )}
          </Card>
          {save.isError && (
            <p role="alert" className="text-sm text-danger">
              {managementError(save.error)}
            </p>
          )}
          {!locked ? (
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
              <Button variant="outline" disabled={busy} onClick={() => saveResult("IN_PROGRESS")}>
                {M.returnSave}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !canFail}
                onClick={() => saveResult("FAILED")}
              >
                {M.unitInspectionFail}
              </Button>
              <Button
                variant="primary"
                disabled={busy || !canPass}
                onClick={() => saveResult("PASSED")}
              >
                {M.unitInspectionPass}
              </Button>
            </div>
          ) : (
            <p role="status" className="text-sm font-semibold text-emerald-800">
              {record.status === "FAILED" ? M.unitInspectionFailed : M.unitInspectionPassed}
            </p>
          )}
        </>
      )}
    </div>
  );
}
