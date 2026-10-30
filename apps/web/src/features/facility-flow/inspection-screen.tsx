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
import { useRef } from "react";
import { formatDateTime } from "@/lib/format";
import { FLOW } from "./flow.messages";
import {
  FlowButton as Button,
  DataPair,
  inputClass,
  Panel,
  Pill,
  SectionTitle,
  titleClass,
} from "./flow-ui";
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
  return (
    <div className="overflow-hidden rounded-lg bg-[#f2f3ff]">
      <div className="relative aspect-[4/3]">
        <a href={photo.url} target="_blank" rel="noreferrer" download={photo.filename}>
          <Image
            unoptimized
            width={480}
            height={360}
            src={photo.url}
            alt={FLOW.evidencePhoto}
            className="h-full w-full object-cover"
          />
        </a>
        {onRemove && (
          <button
            type="button"
            aria-label={`${FLOW.removePhoto}: ${FLOW.evidencePhoto}`}
            disabled={disabled}
            onClick={() => {
              if (window.confirm(FLOW.deletePhotoConfirm(FLOW.evidencePhoto))) onRemove(photo.id);
            }}
            className="absolute right-2 top-2 rounded bg-white p-2 text-[#93000a] shadow-sm disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-xs font-semibold">{FLOW.evidencePhoto}</p>
        <p className="mt-1 text-[11px] text-[#5c6661]">{formatDateTime(photo.createdAt)}</p>
      </div>
    </div>
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
  const handover = view === "handover" && record.status === "PASSED";
  const review = view === "review";
  const historical =
    record.storageUnitId !== result.assignedUnit?.physicalUnitId ||
    record.reservationId !== result.booking.reservationId;
  function back() {
    if (!editor.dirty || window.confirm(FLOW.confirmLeave)) onBack();
  }

  if (readOnly) {
    return (
      <Panel className="space-y-4">
        <SectionTitle>{FLOW.readonlyRecord}</SectionTitle>
        {historical && <Pill tone="amber">{FLOW.historicalRecord}</Pill>}
        <p className="break-all text-xs">
          {FLOW.recordId}: {formatReference(record.id, "BB")} · {record.unitCode}
        </p>
        <Pill
          tone={
            record.status === "FAILED" ? "red" : record.status === "PASSED" ? "green" : "neutral"
          }
        >
          {FLOW.inspectionStatusLabels[record.status]}
        </Pill>
        <InspectionChecklist items={HANDOVER_CHECKLIST_ITEMS} results={editor.values.results} />
        <p className="whitespace-pre-wrap">{record.notes || FLOW.noNotes}</p>
        <p className="text-xs">{formatDateTime(record.inspectDoneAt ?? record.inspectedAt)}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {record.evidence.map((photo) => (
            <InspectionPhotoCard key={photo.id} photo={photo} />
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {!handover && (
        <Panel className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Warehouse size={30} className="text-[#003b2f]" />
            <div>
              <p className="text-xs text-[#5c6661]">{result.booking.bookingCode}</p>
              <h2 className={`${titleClass} text-xl`}>{result.booking.contactName}</h2>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase text-[#5c6661]">{FLOW.assigned}</p>
            <strong className={`${titleClass} text-xl text-[#003b2f]`}>{record.unitCode}</strong>
            <p className="text-xs text-[#5c6661]">{result.booking.unitTypeSizeLabel}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-[#5c6661]">{FLOW.recordId}</p>
            <p className="max-w-[220px] break-all text-xs">{formatReference(record.id, "BB")}</p>
            <Pill tone={record.status === "FAILED" ? "red" : editor.locked ? "green" : "neutral"}>
              {editor.locked
                ? FLOW.inspectionStatusLabels[record.status]
                : editor.dirty
                  ? FLOW.unsaved
                  : FLOW.saved}
            </Pill>
          </div>
        </Panel>
      )}

      {handover ? (
        <HandoverContent record={record} result={result} onBack={back} />
      ) : review ? (
        <>
          <Panel className="bg-[#ffdcc3]/40">
            <div className="flex items-start gap-3">
              <Lock size={24} className="text-[#6e3900]" />
              <div>
                <h2 className={`${titleClass} text-lg text-[#6e3900]`}>{FLOW.lockWarningTitle}</h2>
                <p className="mt-2 text-sm leading-6">{FLOW.lockWarning}</p>
              </div>
            </div>
          </Panel>
          <Panel>
            <SectionTitle icon={<ClipboardCheck size={20} />}>{FLOW.conditionReport}</SectionTitle>
            <div className="mt-4">
              <InspectionChecklist
                items={HANDOVER_CHECKLIST_ITEMS}
                results={editor.values.results}
              />
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
              {editor.values.notes || FLOW.noNotes}
            </p>
            <p className="mt-3 text-xs text-[#5c6661]">
              {FLOW.syncTime}: {formatDateTime(record.inspectedAt)}
            </p>
          </Panel>
          <Panel className="flex flex-wrap justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => onNavigate("inspect")}
              disabled={editor.busy}
            >
              {FLOW.backEdit}
            </Button>
            <Button
              loading={editor.busy}
              disabled={!editor.canComplete || editor.dirty || editor.locked}
              onClick={editor.complete}
              icon={<Lock size={18} />}
            >
              {FLOW.complete}
            </Button>
          </Panel>
        </>
      ) : (
        <>
          <Panel className="flex flex-wrap items-center gap-4">
            <div className="grid size-20 place-items-center rounded-full border-[6px] border-[#b4efda] text-xl font-bold text-[#003b2f]">
              {Math.round((editor.count / editor.items.length) * 100)}%
            </div>
            <div>
              <h2 className={`${titleClass} text-xl`}>
                {editor.count} / {editor.items.length} {FLOW.progress}
              </h2>
              <p className="mt-1 text-sm text-[#404945]">{FLOW.requirement}</p>
            </div>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <div className="space-y-6">
              <Panel>
                <SectionTitle>{FLOW.checklistTitle}</SectionTitle>
                <p className="my-3 text-sm text-[#404945]">{FLOW.requirement}</p>
                <InspectionChecklist
                  items={HANDOVER_CHECKLIST_ITEMS}
                  results={editor.values.results}
                  disabled={editor.busy || editor.locked}
                  onChange={editor.setResult}
                />
              </Panel>
              <Panel>
                <SectionTitle>{FLOW.notesTitle}</SectionTitle>
                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-semibold">{FLOW.notesLabel}</span>
                  <textarea
                    value={editor.values.notes}
                    onChange={(event) => editor.setNotes(event.target.value)}
                    aria-label={FLOW.notesLabel}
                    rows={7}
                    maxLength={4000}
                    placeholder={FLOW.notesPlaceholder}
                    disabled={editor.busy || editor.locked}
                    className={inputClass}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-semibold">{FLOW.conditionReport}</span>
                  <select
                    value={editor.values.condition ?? ""}
                    onChange={(event) =>
                      editor.setCondition(
                        (event.target.value || null) as InspectionRecord["condition"],
                      )
                    }
                    disabled={editor.busy || editor.locked}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    <option value="GOOD">Tốt</option>
                    <option value="MINOR_DAMAGE">Hư hỏng nhẹ</option>
                    <option value="MAJOR_DAMAGE">Hư hỏng nghiêm trọng</option>
                  </select>
                </label>
              </Panel>
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle>
                    <Camera size={18} /> {FLOW.evidence} ({record.evidence.length})
                  </SectionTitle>
                  <Button
                    variant="secondary"
                    disabled={editor.busy || editor.locked || record.evidence.length >= 8}
                    onClick={() => fileRef.current?.click()}
                    icon={<Camera size={18} />}
                  >
                    {FLOW.upload}
                  </Button>
                </div>
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
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {record.evidence.map((photo) => (
                    <InspectionPhotoCard
                      key={photo.id}
                      photo={photo}
                      onRemove={editor.locked ? undefined : editor.remove}
                      disabled={editor.busy}
                    />
                  ))}
                </div>
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel className="bg-[#003b2f] text-white">
                <p className="text-[11px] uppercase tracking-widest text-[#b4efda]">
                  {FLOW.principles}
                </p>
                <h2 className={`${titleClass} mt-2 text-xl`}>{FLOW.principlesTitle}</h2>
                <div className="mt-6 space-y-6">
                  {FLOW.principleItems.map(([title, text]) => (
                    <div key={title}>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-2 text-xs leading-5 text-[#b4efda]">{text}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <SectionTitle>{FLOW.technical}</SectionTitle>
                <p className="mt-3 text-xs leading-5 text-[#404945]">{FLOW.technicalHint}</p>
              </Panel>
            </div>
          </div>
          {!editor.canComplete && <p className="text-sm text-[#404945]">{FLOW.reviewHint}</p>}
          <Panel className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={back} disabled={editor.busy}>
              {FLOW.backVerify}
            </Button>
            <div role="status" aria-live="polite" className="text-xs text-[#5c6661]">
              {editor.busy ? FLOW.saving : editor.dirty ? FLOW.unsaved : FLOW.saved}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={editor.busy}
                disabled={editor.locked}
                onClick={() => void editor.save()}
              >
                {FLOW.save}
              </Button>
              <Button
                loading={editor.busy}
                disabled={!editor.canComplete || editor.locked}
                onClick={() => void editor.save("review")}
              >
                {FLOW.review}
              </Button>
            </div>
          </Panel>
        </>
      )}
      {editor.error && (
        <p role="alert" className="rounded bg-[#ffdad6] p-4 text-sm text-[#93000a]">
          {editor.error}
        </p>
      )}
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
    <>
      <Panel className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-white text-emerald-800">
            <ShieldCheck aria-hidden="true" size={25} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={`${titleClass} text-xl text-emerald-950 sm:text-2xl`}>
                {handedOver ? FLOW.handoverCompletedTitle : FLOW.handoverReadyTitle}
              </h2>
              <Pill>{handedOver ? FLOW.done : FLOW.inspectionStatusLabels.PASSED}</Pill>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {handedOver ? FLOW.handoverSuccess : FLOW.handoverReadyHint}
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-emerald-800">
              <span className="break-all">
                {FLOW.bookingCode}: {result.booking.bookingCode}
              </span>
              <span className="break-all">
                {FLOW.assigned}: {record.unitCode}
              </span>
            </p>
          </div>
        </div>
      </Panel>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel className="rounded-2xl border border-slate-200/80 p-5 sm:p-6">
          <SectionTitle
            icon={<Warehouse aria-hidden="true" size={20} className="text-emerald-800" />}
          >
            {FLOW.handoverCustomerInfo}
          </SectionTitle>
          <div className="mt-5 grid gap-x-5 gap-y-6 sm:grid-cols-2">
            <DataPair label={FLOW.customer}>{result.booking.contactName}</DataPair>
            <DataPair label={FLOW.assigned}>{record.unitCode}</DataPair>
            <DataPair label={FLOW.phone}>{result.booking.contactPhone}</DataPair>
            <DataPair label={FLOW.email}>{result.booking.contactEmail}</DataPair>
            <DataPair label={FLOW.period}>{FLOW.months(result.booking.requestedMonths)}</DataPair>
            <DataPair label={FLOW.rentalEnd}>{formatDateTime(result.booking.rentalEndAt)}</DataPair>
          </div>
        </Panel>
        <Panel className="rounded-2xl border border-slate-200/80 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <SectionTitle
              icon={<ClipboardCheck aria-hidden="true" size={20} className="text-emerald-800" />}
            >
              {FLOW.handoverInspection}
            </SectionTitle>
            <Button
              className="print:hidden"
              variant="secondary"
              icon={<Printer size={16} />}
              onClick={() => window.print()}
            >
              {FLOW.printRecord}
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {FLOW.inspectionCompletedAt}: {formatDateTime(record.inspectDoneAt)}
          </p>
          <div className="mt-4">
            <InspectionChecklist
              items={HANDOVER_CHECKLIST_ITEMS}
              results={readResults(record.checklist)}
            />
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-500">{FLOW.inspectionNotes}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {record.notes || FLOW.noNotes}
            </p>
          </div>
          {record.evidence.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold">
                {FLOW.inspectionEvidence}{" "}
                <span className="ml-1 text-slate-500">({record.evidence.length})</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {record.evidence.map((photo) => (
                  <InspectionPhotoCard key={photo.id} photo={photo} />
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
      {!handedOver && (
        <Panel className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
          <SectionTitle>{FLOW.confirmHandover}</SectionTitle>
          <p className="mt-3 text-sm leading-6">{FLOW.handoverPending}</p>
          <label className="mt-5 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={handover.received}
              onChange={(event) => handover.setReceived(event.target.checked)}
              disabled={handover.mutation.isPending}
              className="mt-1 size-4"
            />
            {FLOW.customerReceived}
          </label>
          {handover.mutation.isError && (
            <p role="alert" className="mt-3 text-sm text-[#93000a]">
              {flowError(handover.mutation.error)}
            </p>
          )}
        </Panel>
      )}
      <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center print:hidden">
        <Button onClick={onBack} variant="secondary">
          {FLOW.backToMyWork}
        </Button>
        {!handedOver && (
          <Button
            disabled={!handover.received || result.booking.status !== "CONFIRMED"}
            loading={handover.mutation.isPending}
            onClick={() => handover.mutation.mutate()}
            icon={<CheckCircle2 size={18} />}
          >
            {FLOW.handover}
          </Button>
        )}
      </div>
    </>
  );
}
