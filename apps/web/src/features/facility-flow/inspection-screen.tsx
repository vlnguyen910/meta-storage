"use client";
import type { CheckInLookupResult, Inspection, InspectionPhoto } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Lock,
  ShieldCheck,
  Trash2,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { FLOW } from "./flow.messages";
import {
  BackLabel,
  FlowButton as Button,
  DataPair,
  inputClass,
  Panel,
  Pill,
  SectionTitle,
  titleClass,
} from "./flow-ui";
import { flowError, useHandover, useInspectionEditor } from "./use-check-in-flow";
export function InspectionPhotoCard({
  recordId,
  photo,
  onRemove,
  disabled,
}: {
  recordId: string;
  photo: InspectionPhoto;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const query = useQuery({
    queryKey: ["inspection-photo", recordId, photo.id],
    queryFn: () => api.inspections.photo(recordId, photo.id),
    retry: false,
    refetchInterval: 4 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const photoUrl =
    query.data?.url ??
    (query.data?.dataBase64
      ? `data:${query.data.mimeType};base64,${query.data.dataBase64}`
      : undefined);
  return (
    <div className="overflow-hidden rounded-lg bg-[#f2f3ff]">
      <div className="relative aspect-[4/3]">
        {photoUrl ? (
          <a href={photoUrl} target="_blank" rel="noreferrer" download={photo.filename}>
            <Image
              key={`${photoUrl}-${imageAttempt}`}
              unoptimized
              width={480}
              height={360}
              src={photoUrl}
              onError={() => setImageFailed(true)}
              onLoad={() => setImageFailed(false)}
              alt={photo.filename}
              className="h-full w-full object-cover"
            />
          </a>
        ) : (
          <div className="grid h-full place-items-center p-3 text-center text-xs text-[#707975]">
            {query.isError ? (
              <div role="alert">
                <p>{FLOW.photoLoadError}</p>
                <button className="mt-2 underline" type="button" onClick={() => query.refetch()}>
                  {FLOW.retry}
                </button>
              </div>
            ) : (
              FLOW.loading
            )}
          </div>
        )}
        {imageFailed && (
          <div
            role="alert"
            className="absolute inset-0 grid place-items-center bg-[#f2f3ff] p-3 text-center text-xs"
          >
            <div>
              <p>{FLOW.photoLoadError}</p>
              <button
                type="button"
                className="mt-2 underline"
                onClick={() => {
                  void query.refetch().finally(() => {
                    setImageFailed(false);
                    setImageAttempt((attempt) => attempt + 1);
                  });
                }}
              >
                {FLOW.retry}
              </button>
            </div>
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`${FLOW.removePhoto}: ${photo.filename}`}
            disabled={disabled}
            onClick={() => {
              if (window.confirm(FLOW.deletePhotoConfirm(photo.filename))) onRemove(photo.id);
            }}
            className="absolute right-2 top-2 rounded bg-white p-2 text-[#93000a] shadow-sm disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-xs font-semibold">{photo.filename}</p>
        <p className="mt-1 text-[11px] text-[#707975]">{formatDateTime(photo.createdAt)}</p>
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
  record: Inspection;
  result: CheckInLookupResult;
  view: string;
  onNavigate: (view: string) => void;
  onBack: () => void;
}) {
  const e = useInspectionEditor(record, onNavigate);
  const fileRef = useRef<HTMLInputElement>(null);
  const handover = view === "handover" && e.locked;
  const review = view === "review";
  function back() {
    if (!e.dirty || window.confirm(FLOW.confirmLeave)) onBack();
  }
  if (readOnly)
    return (
      <Panel className="space-y-4">
        <SectionTitle>{FLOW.readonlyRecord}</SectionTitle>
        {(record.unitAssignmentId !== result.assignedUnit?.id ||
          record.verificationId !== result.verification?.id) && (
          <Pill tone="amber">{FLOW.historicalRecord}</Pill>
        )}
        <p className="text-xs break-all">
          {FLOW.recordId}: {record.id} · {record.unitCode}
        </p>
        <Pill>{record.status === "COMPLETED" ? FLOW.locked : FLOW.statusLabels.DRAFT}</Pill>
        <p className="whitespace-pre-wrap">{record.conditionNotes}</p>
        <p className="text-xs">
          {FLOW.lockedAt}: {formatDateTime(record.completedAt)}
        </p>
        {record.completedBy && (
          <p className="text-xs">
            {FLOW.lockedBy}: {record.completedByName ?? record.completedBy}
          </p>
        )}
        {record.handedOverAt && (
          <p>
            {FLOW.handedOverAt}: {formatDateTime(record.handedOverAt ?? null)} · {FLOW.handedOverBy}
            : {record.handedOverByName ?? record.handedOverBy}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {record.photos.map((photo) => (
            <InspectionPhotoCard key={photo.id} recordId={record.id} photo={photo} />
          ))}
        </div>
      </Panel>
    );
  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Warehouse size={30} className="text-[#003b2f]" />
          <div>
            <p className="text-xs text-[#707975]">{result.booking.bookingCode}</p>
            <h2 className={`${titleClass} text-xl`}>{result.booking.contactName}</h2>
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#707975]">{FLOW.assigned}</p>
          <strong className={`${titleClass} text-xl text-[#003b2f]`}>{record.unitCode}</strong>
          <p className="text-xs text-[#707975]">{result.booking.unitTypeSizeLabel}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#707975]">{FLOW.recordId}</p>
          <p className="max-w-[220px] break-all text-xs">{record.id}</p>
          <Pill tone={e.locked ? "green" : "neutral"}>
            {e.locked ? FLOW.locked : e.dirty ? FLOW.unsaved : FLOW.saved}
          </Pill>
        </div>
      </Panel>
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <div className="space-y-6">
              <Panel>
                <SectionTitle icon={<Warehouse size={20} />}>{FLOW.baselineInfo}</SectionTitle>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DataPair label={FLOW.booking}>{result.booking.bookingCode}</DataPair>
                  <DataPair label={FLOW.size}>{result.booking.unitTypeSizeLabel}</DataPair>
                  <DataPair label={FLOW.assigned}>{record.unitCode}</DataPair>
                  <DataPair label={FLOW.syncTime}>{formatDateTime(record.updatedAt)}</DataPair>
                </div>
              </Panel>
              <Panel>
                <SectionTitle icon={<ClipboardCheck size={20} />}>
                  {FLOW.conditionReport}
                </SectionTitle>
                <div className="mt-4 rounded bg-[#f2f3ff] p-4">
                  <Pill tone={record.correctUnit ? "green" : "amber"}>
                    {record.correctUnit ? FLOW.correct : FLOW.wrong}
                  </Pill>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                    {record.conditionNotes}
                  </p>
                </div>
              </Panel>
              <Panel>
                <SectionTitle icon={<Camera size={20} />}>
                  {FLOW.evidence} ({record.photos.length})
                </SectionTitle>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {record.photos.map((photo) => (
                    <InspectionPhotoCard key={photo.id} recordId={record.id} photo={photo} />
                  ))}
                </div>
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel>
                <p className="text-[11px] uppercase text-[#707975]">{FLOW.recordStatus}</p>
                <h2 className={`${titleClass} mt-2 text-xl text-[#003b2f]`}>
                  {e.count === 3 ? FLOW.readyComplete : FLOW.incomplete}
                </h2>
                <div className="mt-4 rounded bg-[#f2f3ff] p-4">
                  <Pill tone="amber">{FLOW.notHandedOver}</Pill>
                  <p className="mt-3 text-xs leading-5">{FLOW.inspectionPending}</p>
                </div>
                <div className="mt-4 space-y-3">
                  {[FLOW.correctTitle, FLOW.notesTitle, FLOW.photosTitle].map((text, i) => (
                    <div key={text} className="flex items-center gap-2 text-xs">
                      <CheckCircle2
                        size={16}
                        className={
                          i === 0
                            ? record.correctUnit
                              ? "text-[#306858]"
                              : "text-[#93000a]"
                            : i === 1
                              ? record.conditionNotes.trim()
                                ? "text-[#306858]"
                                : "text-[#93000a]"
                              : record.photos.length
                                ? "text-[#306858]"
                                : "text-[#93000a]"
                        }
                      />
                      {text}
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel className="bg-[#b4efda]/30">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={e.confirmLock}
                    onChange={(ev) => e.setConfirmLock(ev.target.checked)}
                    className="mt-1 size-5 shrink-0 accent-[#003b2f]"
                  />
                  <span>{FLOW.confirmLock}</span>
                </label>
              </Panel>
            </div>
          </div>
          <p className="text-sm text-[#404945]">{FLOW.lockHint}</p>
          <Panel className="flex flex-wrap justify-between gap-3">
            <Button variant="secondary" onClick={() => onNavigate("inspect")} disabled={e.busy}>
              {FLOW.backEdit}
            </Button>
            <Button
              loading={e.busy}
              disabled={!e.confirmLock || e.count !== 3 || e.locked}
              onClick={e.complete}
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
              {Math.round((e.count / 3) * 100)}%
            </div>
            <div>
              <h2 className={`${titleClass} text-xl`}>
                {e.count} / 3 {FLOW.progress}
              </h2>
              <p className="mt-1 text-sm text-[#404945]">{FLOW.requirement}</p>
            </div>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <div className="space-y-6">
              <Panel>
                <SectionTitle>
                  <span className="grid size-7 place-items-center rounded bg-[#003b2f] text-sm text-white">
                    1
                  </span>
                  {FLOW.correctTitle}
                </SectionTitle>
                <p className="mt-2 text-xs text-[#707975]">{FLOW.correctHint}</p>
                <fieldset disabled={e.busy || e.locked} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">{FLOW.correctTitle}</legend>
                  {[true, false].map((v) => (
                    <label
                      key={String(v)}
                      className={`cursor-pointer rounded-lg bg-[#f2f3ff] p-4 ${e.values.correctUnit === v ? "ring-2 ring-[#003b2f]" : ""}`}
                    >
                      <input
                        type="radio"
                        name="correctUnit"
                        checked={e.values.correctUnit === v}
                        onChange={() => e.form.setValue("correctUnit", v, { shouldDirty: true })}
                        className="mr-2 accent-[#003b2f]"
                      />
                      <strong className="text-sm">{v ? FLOW.correct : FLOW.wrong}</strong>
                      <p className="mt-2 text-xs text-[#707975]">
                        {v ? record.unitCode : FLOW.mismatch}
                      </p>
                    </label>
                  ))}
                </fieldset>
                {e.values.correctUnit === false && (
                  <p role="alert" className="mt-4 rounded bg-[#ffdad6] p-3 text-sm text-[#93000a]">
                    {FLOW.mismatch}
                  </p>
                )}
              </Panel>
              <Panel>
                <SectionTitle>
                  <span className="grid size-7 place-items-center rounded bg-[#003b2f] text-sm text-white">
                    2
                  </span>
                  {FLOW.notesTitle}
                </SectionTitle>
                <p className="mt-2 text-xs text-[#707975]">{FLOW.notesHint}</p>
                <div className="my-4 flex flex-wrap gap-2">
                  {FLOW.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={e.busy || e.locked}
                      className="rounded bg-[#eaedff] px-3 py-2 text-xs font-medium text-[#306858]"
                      onClick={() =>
                        e.form.setValue(
                          "conditionNotes",
                          `${e.values.conditionNotes}${e.values.conditionNotes ? "\n" : ""}${s}.`,
                          { shouldDirty: true },
                        )
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <label>
                  <span className="mb-2 block text-xs font-semibold">{FLOW.notesLabel}</span>
                  <textarea
                    {...e.form.register("conditionNotes")}
                    aria-invalid={!!e.form.formState.errors.conditionNotes}
                    aria-describedby="condition-notes-feedback"
                    rows={7}
                    maxLength={4000}
                    placeholder={FLOW.notesPlaceholder}
                    disabled={e.busy || e.locked}
                    className={inputClass}
                  />
                </label>
                <p id="condition-notes-feedback" className="mt-2 text-right text-xs text-[#707975]">
                  {e.values.conditionNotes.length}/4000
                </p>
                {e.form.formState.errors.conditionNotes && (
                  <p role="alert" className="text-xs text-[#93000a]">
                    {e.form.formState.errors.conditionNotes.message}
                  </p>
                )}
              </Panel>
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle>
                    <span className="grid size-7 place-items-center rounded bg-[#003b2f] text-sm text-white">
                      3
                    </span>
                    {FLOW.photosTitle}
                  </SectionTitle>
                  <Button
                    variant="secondary"
                    disabled={e.busy || e.locked || record.photos.length >= 8}
                    onClick={() => fileRef.current?.click()}
                    icon={<Camera size={18} />}
                  >
                    {FLOW.upload}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-[#707975]">{FLOW.photosHint}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  aria-label={FLOW.upload}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    if (file) void e.upload(file);
                    ev.target.value = "";
                  }}
                />
                {record.photos.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {record.photos.map((photo) => (
                      <InspectionPhotoCard
                        key={photo.id}
                        recordId={record.id}
                        photo={photo}
                        onRemove={e.locked ? undefined : e.remove}
                        disabled={e.busy}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-[#bfc9c4] p-8 text-center text-xs text-[#707975]">
                    {FLOW.noPhotos}
                  </div>
                )}
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
              <Panel>
                <SectionTitle>{FLOW.telemetry}</SectionTitle>
                <p className="mt-3 text-xs leading-5 text-[#707975]">{FLOW.telemetryHint}</p>
                <Pill tone="neutral">{FLOW.unavailable}</Pill>
              </Panel>
            </div>
          </div>
          {e.count !== 3 && <p className="text-sm text-[#404945]">{FLOW.reviewHint}</p>}
          <Panel className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={back} disabled={e.busy}>
              {FLOW.backVerify}
            </Button>
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-[#707975]"
            >
              <Cloud size={16} />
              {e.busy ? FLOW.saving : e.dirty ? FLOW.unsaved : FLOW.saved}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={e.busy}
                disabled={e.locked}
                onClick={() => e.save()}
              >
                {FLOW.save}
              </Button>
              <Button
                loading={e.busy}
                disabled={e.count !== 3 || e.locked}
                onClick={() => e.save("review")}
              >
                {FLOW.review}
              </Button>
            </div>
          </Panel>
        </>
      )}
      {e.error && (
        <p role="alert" className="rounded bg-[#ffdad6] p-4 text-sm text-[#93000a]">
          {e.error}
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
  record: Inspection;
  result: CheckInLookupResult;
  onBack: () => void;
}) {
  const h = useHandover(record);
  const handedOver = !!record.handedOverAt;
  return (
    <>
      <Panel className="flex flex-wrap items-center justify-between gap-4 bg-[#b4efda]/40">
        <div className="flex gap-3">
          <ShieldCheck size={28} className="text-[#003b2f]" />
          <div>
            <h2 className={`${titleClass} text-lg`}>{FLOW.locked}</h2>
            <p className="mt-1 text-xs">
              {FLOW.lockedAt}: {formatDateTime(record.completedAt)}
            </p>
          </div>
        </div>
        <Pill>{FLOW.done}</Pill>
      </Panel>
      <Panel className="bg-[#ffdcc3]/40">
        <h2 className={`${titleClass} text-lg`}>{FLOW.handoverRules}</h2>
        <p className="mt-2 text-sm leading-6">{FLOW.handoverHint}</p>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="space-y-6">
          <Panel>
            <SectionTitle>{FLOW.reception}</SectionTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DataPair label={FLOW.customer}>{result.booking.contactName}</DataPair>
              <DataPair label={FLOW.assigned}>{record.unitCode}</DataPair>
              <DataPair label={FLOW.phone}>{result.booking.contactPhone}</DataPair>
              <DataPair label={FLOW.email}>{result.booking.contactEmail}</DataPair>
              <DataPair label={FLOW.period}>{FLOW.months(result.booking.requestedMonths)}</DataPair>
              <DataPair label={FLOW.rentalEnd}>
                {formatDateTime(result.booking.rentalEndAt)}
              </DataPair>
            </div>
          </Panel>
          <Panel>
            <div className="flex flex-wrap justify-between gap-3">
              <SectionTitle>{FLOW.receptionBaseline}</SectionTitle>
              <Button variant="secondary" onClick={() => window.print()}>
                {FLOW.printRecord}
              </Button>
            </div>
            <p className="my-4 whitespace-pre-wrap text-sm leading-6">{record.conditionNotes}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {record.photos.map((photo) => (
                <InspectionPhotoCard key={photo.id} recordId={record.id} photo={photo} />
              ))}
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel className={handedOver ? "bg-[#b4efda]/40" : "bg-[#f2f3ff]"}>
            <SectionTitle>{handedOver ? FLOW.rentalActive : FLOW.confirmHandover}</SectionTitle>
            {handedOver ? (
              <>
                <p className="mt-3">{FLOW.handoverSuccess}</p>
                <p className="mt-3 text-xs">
                  {FLOW.handedOverAt}: {formatDateTime(record.handedOverAt ?? null)}
                </p>
                <p className="mt-2 break-all text-xs">
                  {FLOW.handedOverBy}: {record.handedOverByName ?? record.handedOverBy}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6">{FLOW.handoverPending}</p>
                <label className="mt-5 flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={h.received}
                    onChange={(event) => h.setReceived(event.target.checked)}
                    disabled={h.mutation.isPending}
                    className="mt-1 size-4"
                  />
                  {FLOW.customerReceived}
                </label>
              </>
            )}
            {h.mutation.isError && (
              <p role="alert" className="mt-3 text-sm text-[#93000a]">
                {flowError(h.mutation.error)}
              </p>
            )}
          </Panel>
        </div>
      </div>
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onBack} variant="secondary">
          <BackLabel />
        </Button>
        {!handedOver && (
          <Button
            disabled={!h.received || result.booking.status !== "CONFIRMED"}
            loading={h.mutation.isPending}
            onClick={() => h.mutation.mutate()}
            icon={<CheckCircle2 size={18} />}
          >
            {FLOW.handover}
          </Button>
        )}
      </Panel>
    </>
  );
}
