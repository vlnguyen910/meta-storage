"use client";
import type { InspectionRecord } from "@metastorage/contracts";
import { HANDOVER_CHECKLIST_ITEMS } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Printer,
  ShieldCheck,
  Trash2,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FLOW } from "./flow.messages";
import { InspectionChecklist } from "./inspection-checklist";
import type { useCheckInFlow } from "./use-check-in-flow";
import { flowError, readResults, useHandover, useInspectionEditor } from "./use-check-in-flow";

type Evidence = InspectionRecord["evidence"][number];

export function InspectionPhotoCard({
  photo,
  onRemove,
  disabled,
}: {
  photo: Evidence;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <>
      <div className="group relative overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50 shadow-2xs">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <a href={photo.url} target="_blank" rel="noreferrer" download={photo.filename}>
            <Image
              unoptimized
              width={480}
              height={360}
              src={photo.url}
              alt={photo.filename || FLOW.evidencePhoto}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </a>
          {onRemove && (
            <button
              type="button"
              aria-label={`${FLOW.removePhoto}: ${photo.filename || FLOW.evidencePhoto}`}
              disabled={disabled}
              onClick={() => setConfirmDeleteOpen(true)}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded bg-white/95 text-rose-600 shadow-xs transition-opacity hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <div className="p-1">
          <p className="truncate text-[9.5px] font-semibold text-slate-800">
            {photo.filename || FLOW.evidencePhoto}
          </p>
          <p className="text-[8.5px] text-slate-400">{formatDateTime(photo.createdAt)}</p>
        </div>
      </div>

      {onRemove && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{FLOW.deletePhotoTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {FLOW.deletePhotoConfirm(photo.filename || FLOW.evidencePhoto)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline">
                  {FLOW.cancel}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setConfirmDeleteOpen(false);
                    onRemove(photo.id);
                  }}
                >
                  {FLOW.removePhoto}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export function InspectionScreen({
  record,
  result,
  view,
  onNavigate,
  onBack,
  readOnly = false,
}: {
  readOnly?: boolean;
  record: InspectionRecord;
  result: NonNullable<ReturnType<typeof useCheckInFlow>["result"]>;
  view: string;
  onNavigate: (view: string) => void;
  onBack: () => void;
}) {
  const editor = useInspectionEditor(record, onNavigate);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const handover = view === "handover" && record.status === "PASSED";
  const review = view === "review";
  const historical =
    record.storageUnitId !== result.assignedUnit?.physicalUnitId ||
    record.reservationId !== result.booking.reservationId;

  function back() {
    if (!editor.dirty) onBack();
    else setConfirmLeaveOpen(true);
  }

  if (readOnly) {
    return (
      <Card className="border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-900">{FLOW.readonlyRecord}</h2>
          <div className="flex items-center gap-1.5">
            {historical && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800 text-[10px]"
              >
                {FLOW.historicalRecord}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                record.status === "FAILED"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : record.status === "PASSED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-700",
              )}
            >
              {FLOW.inspectionStatusLabels[record.status]}
            </Badge>
          </div>
        </div>

        <p className="font-mono text-slate-600">
          {FLOW.recordId}: {formatReference(record.id, "BB")} · {record.unitCode}
        </p>

        <InspectionChecklist items={HANDOVER_CHECKLIST_ITEMS} results={editor.values.results} />

        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
          <p className="text-[10px] font-semibold uppercase text-slate-400">{FLOW.notesTitle}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{record.notes || FLOW.noNotes}</p>
        </div>

        <p className="text-[11px] text-slate-400">
          {formatDateTime(record.inspectDoneAt ?? record.inspectedAt)}
        </p>

        {record.evidence.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {record.evidence.map((photo) => (
              <InspectionPhotoCard key={photo.id} photo={photo} />
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top Summary Bar for Inspection / Review */}
      {!handover && (
        <Card className="border-slate-200 bg-white p-2.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Customer & Unit */}
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                <Warehouse size={16} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 text-sm">{result.booking.contactName}</h2>
                  <Badge
                    variant="outline"
                    className="border-slate-200 font-mono text-[10px] px-1.5 py-0 text-slate-600"
                  >
                    {result.booking.bookingCode}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{FLOW.assigned}:</span>{" "}
                  <strong className="font-mono text-emerald-900">{record.unitCode}</strong>
                  {result.booking.unitTypeSizeLabel && ` · ${result.booking.unitTypeSizeLabel}`}
                </p>
              </div>
            </div>

            {/* Checklist Progress Inline */}
            {!review && (
              <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">
                    {FLOW.progress}
                  </p>
                  <p className="text-xs font-bold text-slate-800">
                    {editor.count} / {editor.items.length} {FLOW.checklistPass}
                  </p>
                </div>
                <div className="grid size-7 place-items-center rounded-full bg-emerald-100 font-bold text-[11px] text-emerald-900">
                  {Math.round((editor.count / editor.items.length) * 100)}%
                </div>
              </div>
            )}

            {/* Record ID & Status */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">{FLOW.recordId}</span>
                <span className="font-mono font-medium text-slate-700 text-[11px]">
                  {formatReference(record.id, "BB")}
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5",
                  editor.locked
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : editor.dirty
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                {editor.locked
                  ? FLOW.inspectionStatusLabels[record.status]
                  : editor.dirty
                    ? FLOW.unsaved
                    : FLOW.saved}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {handover ? (
        <HandoverContent record={record} result={result} onBack={back} />
      ) : review ? (
        /* Review & Lock View */
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-stretch">
          {/* Left Column: Summary of Checklist & Notes */}
          <Card className="flex flex-1 flex-col border-slate-200 bg-white shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ClipboardCheck size={15} className="text-primary" />
                <span>{FLOW.conditionReport}</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {FLOW.syncTime}: {formatDateTime(record.inspectedAt)}
              </span>
            </CardHeader>
            <CardContent className="p-3.5 space-y-3 text-xs flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <InspectionChecklist
                  items={HANDOVER_CHECKLIST_ITEMS}
                  results={editor.values.results}
                />
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {FLOW.notesTitle}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-800">
                    {editor.values.notes || FLOW.noNotes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Lock Warning & Confirmation Action */}
          <div className="flex flex-col gap-3">
            <Card className="border-amber-200 bg-amber-50/60 p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                  <Lock size={16} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-amber-950">{FLOW.lockWarningTitle}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">{FLOW.lockWarning}</p>
                </div>
              </div>
            </Card>

            <Card className="flex flex-1 flex-col justify-between border-slate-200 bg-white p-4 shadow-2xs">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 font-medium cursor-pointer rounded-lg border border-slate-200 bg-slate-50/60 p-3 hover:bg-slate-100/50 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmLock}
                  onChange={(e) => setConfirmLock(e.target.checked)}
                  className="mt-0.5 size-4 accent-emerald-700"
                />
                <span className="leading-relaxed">{FLOW.confirmLock}</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <Button
                  variant="outline"
                  onClick={() => onNavigate("inspect")}
                  disabled={editor.busy}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  {FLOW.backEdit}
                </Button>
                <Button
                  loading={editor.busy}
                  disabled={!editor.canComplete || editor.dirty || editor.locked || !confirmLock}
                  onClick={editor.complete}
                  icon={<Lock size={14} />}
                  className="h-9 px-4 text-xs font-bold"
                >
                  {FLOW.complete}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Inspect Editing View */
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] items-stretch">
          {/* Left Column: Checklist & Notes & General Condition */}
          <div className="flex flex-col gap-2.5">
            <Card className="border-slate-200 bg-white shadow-2xs">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ClipboardCheck size={14} className="text-primary" />
                  <span>{FLOW.checklistTitle}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold border-slate-200">
                  {editor.count} / {editor.items.length} {FLOW.checklistPass}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 space-y-2.5">
                <InspectionChecklist
                  items={HANDOVER_CHECKLIST_ITEMS}
                  results={editor.values.results}
                  disabled={editor.busy || editor.locked}
                  onChange={editor.setResult}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    <span className="block mb-1">{FLOW.conditionReport}</span>
                    <select
                      value={editor.values.condition ?? ""}
                      onChange={(event) =>
                        editor.setCondition(
                          (event.target.value || null) as InspectionRecord["condition"],
                        )
                      }
                      disabled={editor.busy || editor.locked}
                      className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary font-normal"
                    >
                      <option value="">— Chọn hiện trạng —</option>
                      <option value="GOOD">Tốt</option>
                      <option value="MINOR_DAMAGE">Hư hỏng nhẹ</option>
                      <option value="MAJOR_DAMAGE">Hư hỏng nghiêm trọng</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    <span className="block mb-1">{FLOW.notesLabel}</span>
                    <textarea
                      value={editor.values.notes}
                      onChange={(event) => editor.setNotes(event.target.value)}
                      aria-label={FLOW.notesLabel}
                      rows={1}
                      maxLength={4000}
                      placeholder={FLOW.notesPlaceholder}
                      disabled={editor.busy || editor.locked}
                      className="min-h-8.5 w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary font-normal"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Action Bar */}
            <Card className="border-slate-200 bg-white p-2 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={back}
                  disabled={editor.busy}
                  className="h-8.5 px-3 text-xs font-semibold"
                >
                  {FLOW.backVerify}
                </Button>
                <div
                  role="status"
                  aria-live="polite"
                  className="text-[11px] text-slate-500 font-medium"
                >
                  {editor.busy ? FLOW.saving : editor.dirty ? FLOW.unsaved : FLOW.saved}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    loading={editor.busy}
                    disabled={editor.locked}
                    onClick={() => void editor.save()}
                    className="h-8.5 px-3 text-xs font-semibold"
                  >
                    {FLOW.save}
                  </Button>
                  <Button
                    loading={editor.busy}
                    disabled={!editor.canComplete || editor.locked}
                    onClick={() => void editor.save("review")}
                    className="h-8.5 px-3.5 text-xs font-bold"
                  >
                    {FLOW.review}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Evidence Photos + Principles */}
          <div className="flex flex-col gap-2.5">
            {/* Photos Card */}
            <Card className="border-slate-200 bg-white shadow-2xs">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Camera size={14} className="text-slate-500" />
                  <span>{FLOW.evidence}</span>
                  <span className="text-slate-400 font-normal">({record.evidence.length}/8)</span>
                </div>
                <Button
                  variant="outline"
                  disabled={editor.busy || editor.locked || record.evidence.length >= 8}
                  onClick={() => fileRef.current?.click()}
                  icon={<Camera size={13} />}
                  className="h-7 px-2.5 text-[11px] font-semibold"
                >
                  {FLOW.upload}
                </Button>
              </CardHeader>
              <CardContent className="p-2.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  aria-label={FLOW.upload}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void editor.upload(file);
                    event.target.value = "";
                  }}
                />
                {record.evidence.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-3 text-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                  >
                    <Camera size={18} className="text-slate-400" />
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      Bấm để tải ảnh hiện trạng ô kho
                    </p>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {record.evidence.map((photo) => (
                      <InspectionPhotoCard
                        key={photo.id}
                        photo={photo}
                        onRemove={editor.locked ? undefined : editor.remove}
                        disabled={editor.busy}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Principles section - keeping bg-[#003b2f] and h2 for E2E compliance */}
            <section className="flex-1 rounded-xl border border-emerald-950/20 bg-[#003b2f] p-3 text-white shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#b4efda]">
                {FLOW.principles}
              </p>
              <h2 className="mt-0.5 text-xs font-bold text-white">{FLOW.principlesTitle}</h2>
              <div className="mt-2 space-y-1.5 text-[11px]">
                {FLOW.principleItems.map(([itemTitle, text]) => (
                  <div key={itemTitle}>
                    <h3 className="font-semibold text-emerald-100 text-[11px]">{itemTitle}</h3>
                    <p className="text-[10px] leading-relaxed text-[#b4efda]/90">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {editor.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          {editor.error}
        </p>
      )}

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{FLOW.confirmLeaveTitle}</AlertDialogTitle>
            <AlertDialogDescription>{FLOW.confirmLeave}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                {FLOW.cancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirmLeaveOpen(false);
                  onBack();
                }}
              >
                {FLOW.confirmLeaveAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HandoverContent({
  record,
  result,
  onBack,
}: {
  record: InspectionRecord;
  result: NonNullable<ReturnType<typeof useCheckInFlow>["result"]>;
  onBack: () => void;
}) {
  const handover = useHandover(record);
  const handedOver = result.booking.status === "CHECKED_IN";

  return (
    <div className="space-y-3">
      {/* Top Banner */}
      <Card className="border-emerald-200/80 bg-emerald-50/60 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <ShieldCheck size={16} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-emerald-950">
                {handedOver ? FLOW.handoverCompletedTitle : FLOW.handoverReadyTitle}
              </h2>
              <p className="text-[11px] text-emerald-900/80">
                {handedOver ? FLOW.handoverSuccess : FLOW.handoverReadyHint}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-300 font-mono text-[10px] bg-white text-emerald-900"
            >
              {record.unitCode}
            </Badge>
            <Badge
              className={cn(
                "text-[10px] font-bold px-2 py-0.5",
                handedOver
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-100 text-emerald-900 border border-emerald-300",
              )}
            >
              {handedOver ? FLOW.done : FLOW.inspectionStatusLabels.PASSED}
            </Badge>
          </div>
        </div>
      </Card>

      {/* 2 Columns Grid */}
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch">
        {/* Left Column: Customer & Handover Confirmation Card */}
        <div className="flex flex-col gap-2.5">
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Warehouse size={14} className="text-emerald-800" />
                <span>{FLOW.handoverCustomerInfo}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {result.booking.bookingCode}
              </span>
            </CardHeader>
            <CardContent className="p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50/80 p-2.5 border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    {FLOW.customer}
                  </span>
                  <span className="font-bold text-slate-900 mt-0.5 block truncate">
                    {result.booking.contactName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    {FLOW.assigned}
                  </span>
                  <span className="font-mono font-bold text-emerald-900 mt-0.5 block">
                    {record.unitCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    {FLOW.phone}
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {result.booking.contactPhone}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    {FLOW.email}
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block truncate">
                    {result.booking.contactEmail}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    {FLOW.period}
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {FLOW.months(result.booking.requestedMonths)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    {FLOW.rentalEnd}
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {formatDateTime(result.booking.rentalEndAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Box */}
          <Card className="flex flex-1 flex-col justify-between border-slate-200 bg-white p-3 shadow-2xs">
            {!handedOver ? (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-950">
                  <h3 className="font-bold text-amber-900">{FLOW.confirmHandover}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80">
                    {FLOW.handoverPending}
                  </p>
                </div>

                <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 font-medium cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={handover.received}
                    onChange={(event) => handover.setReceived(event.target.checked)}
                    disabled={handover.mutation.isPending}
                    className="mt-0.5 size-4 accent-emerald-700"
                  />
                  <span className="leading-relaxed">{FLOW.customerReceived}</span>
                </label>

                {handover.mutation.isError && (
                  <p role="alert" className="text-xs text-rose-600 font-medium">
                    {flowError(handover.mutation.error)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <CheckCircle2 size={32} className="text-emerald-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-900">{FLOW.handoverSuccess}</h3>
                <p className="mt-1 text-xs text-slate-500">{FLOW.rentalActive}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 mt-2.5 print:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="h-9 px-4 text-xs font-semibold"
              >
                {FLOW.backToMyWork}
              </Button>
              {!handedOver && (
                <Button
                  disabled={!handover.received || result.booking.status !== "CONFIRMED"}
                  loading={handover.mutation.isPending}
                  onClick={() => handover.mutation.mutate()}
                  icon={<CheckCircle2 size={14} />}
                  className="h-9 px-4 text-xs font-bold"
                >
                  {FLOW.handover}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Locked Inspection Report */}
        <Card className="flex flex-1 flex-col border-slate-200 bg-white shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ClipboardCheck size={14} className="text-emerald-800" />
              <span>{FLOW.handoverInspection}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              icon={<Printer size={13} />}
              onClick={() => window.print()}
              className="h-7 px-2.5 text-[11px] font-semibold print:hidden"
            >
              {FLOW.printRecord}
            </Button>
          </CardHeader>

          <CardContent className="p-3 space-y-2.5 text-xs flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{FLOW.inspectionCompletedAt}:</span>
                <span className="font-medium text-slate-700">
                  {formatDateTime(record.inspectDoneAt)}
                </span>
              </div>

              <InspectionChecklist
                items={HANDOVER_CHECKLIST_ITEMS}
                results={readResults(record.checklist)}
              />

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                  {FLOW.inspectionNotes}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-800">
                  {record.notes || FLOW.noNotes}
                </p>
              </div>

              {record.evidence.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    {FLOW.inspectionEvidence} ({record.evidence.length})
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {record.evidence.map((photo) => (
                      <InspectionPhotoCard key={photo.id} photo={photo} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
