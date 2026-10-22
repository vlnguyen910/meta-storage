"use client";

import type { ReturnInspectionDetailDto, ReturnRequestDetailDto } from "@metastorage/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Upload } from "lucide-react";
import { useState } from "react";
import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import { Card } from "@/components/ui/display";
import { api } from "@/lib/api";
import { returnKeys, useCompleteReturnInspection, useSaveReturnInspection } from "./hooks";
import { facilityDateTime, facilityTimeToIso } from "./integration-utils";
import { ReturnPrivatePhoto } from "./return-private-photo";
import { RETURNS_MESSAGES as M, returnChecklistGroupLabel } from "./returns.messages";

type ItemState = { reviewed: boolean; issue: boolean; note: string; photoIds: string[] };

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("file-read"));
      resolve(result.split(",", 2)[1] ?? "");
    };
    reader.onerror = () => reject(new Error("file-read"));
    reader.readAsDataURL(file);
  });
}

export function ReturnInspectionWorkspace({
  requestId,
  facilityId,
  inspection,
  timezone,
}: {
  requestId: string;
  facilityId: string;
  inspection: ReturnInspectionDetailDto;
  timezone: string;
}) {
  const { runWithGlobalLoading } = useGlobalLoading();
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      inspection.definition.map((item) => {
        const result = inspection.results.find((entry) => entry.code === item.code);
        return [
          item.code,
          {
            reviewed: Boolean(result),
            issue: result?.issue ?? false,
            note: result?.note ?? "",
            photoIds: result?.photoIds ?? [],
          },
        ];
      }),
    ),
  );
  const [propertyDisposition, setPropertyDisposition] = useState(inspection.propertyDisposition);
  const [propertyReceiver, setPropertyReceiver] = useState(inspection.propertyReceiver ?? "");
  const [propertyHandledAt, setPropertyHandledAt] = useState(
    inspection.propertyHandledAt ? facilityDateTime(inspection.propertyHandledAt, timezone) : "",
  );
  const [propertyEvidencePhotoIds, setPropertyEvidencePhotoIds] = useState(
    inspection.propertyEvidencePhotoIds,
  );
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const queryClient = useQueryClient();
  const save = useSaveReturnInspection(requestId);
  const complete = useCompleteReturnInspection(requestId, facilityId);

  const photoIds = new Set([
    ...inspection.photos.map((photo) => photo.id),
    ...Object.values(items).flatMap((item) => item.photoIds),
  ]);
  const reviewedCount = inspection.definition.filter((item) => items[item.code]?.reviewed).length;
  const allReviewed = reviewedCount === inspection.definition.length;
  const propertyIssue = inspection.definition.some(
    (item) =>
      item.group === "REMAINING_PROPERTY" && items[item.code]?.reviewed && items[item.code]?.issue,
  );
  const issueInvalid = inspection.definition.some((item) => {
    const value = items[item.code];
    return value?.reviewed && value.issue && (!value.note.trim() || value.photoIds.length === 0);
  });
  const inspectionSaved = inspection.results.length === inspection.definition.length;
  const propertyInvalid =
    propertyIssue &&
    (propertyDisposition === "NONE" ||
      !propertyHandledAt ||
      propertyEvidencePhotoIds.length === 0 ||
      (propertyDisposition === "STORED" && !propertyReceiver.trim()));
  const canSave = allReviewed && !issueInvalid && !propertyInvalid && !save.isPending && !uploading;
  const canComplete =
    inspectionSaved &&
    allReviewed &&
    !dirty &&
    !issueInvalid &&
    !propertyInvalid &&
    !save.isPending &&
    !uploading &&
    !complete.isPending;

  async function upload(code: string, file?: File) {
    if (!file || photoIds.size >= 5) return;
    if (
      file.size > 4 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setPhotoError(true);
      return;
    }
    setUploading(true);
    setPhotoError(false);
    try {
      const uploaded = await runWithGlobalLoading(async () =>
        api.returns.uploadInspectionPhoto(requestId, inspection.id, {
          expectedVersion: inspection.version,
          filename: file.name.slice(0, 120),
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          dataBase64: await readBase64(file),
        }),
      );
      setItems((current) => {
        const item = current[code] ?? { reviewed: false, issue: false, note: "", photoIds: [] };
        return { ...current, [code]: { ...item, photoIds: [...item.photoIds, uploaded.id] } };
      });
      setDirty(true);
      await queryClient.invalidateQueries({ queryKey: returnKeys.request(requestId) });
      await queryClient.fetchQuery<ReturnRequestDetailDto>({
        queryKey: returnKeys.request(requestId),
        queryFn: () => api.returns.get(requestId),
      });
    } catch {
      setPhotoError(true);
    } finally {
      setUploading(false);
    }
  }

  function updateItem(code: string, changes: Partial<ItemState>) {
    setItems((current) => ({
      ...current,
      [code]: {
        ...(current[code] ?? { reviewed: false, issue: false, note: "", photoIds: [] }),
        ...changes,
      },
    }));
    setDirty(true);
  }

  function saveDraft() {
    if (!canSave) return;
    save.mutate(
      {
        inspectionId: inspection.id,
        input: {
          expectedVersion: inspection.version,
          results: inspection.definition.map((item) => ({
            code: item.code,
            issue: items[item.code]?.issue ?? false,
            note: items[item.code]?.note ?? "",
            photoIds: items[item.code]?.photoIds ?? [],
          })),
          propertyDisposition: propertyDisposition as "NONE" | "RESOLVED" | "STORED",
          propertyReceiver:
            propertyDisposition === "STORED" ? propertyReceiver.trim() || null : null,
          propertyHandledAt:
            propertyDisposition === "NONE" || !propertyHandledAt
              ? null
              : facilityTimeToIso(propertyHandledAt, timezone),
          propertyEvidencePhotoIds,
        },
      },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <div id="inspection-checklist">
      <Card className="grid gap-5 border-t-4 border-t-primary">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
              {M.inspectionStep}
            </p>
            <h2 className="m-0 text-xl font-bold">
              {M.inspectionChecklist} · {M.attemptLabel(inspection.attempt)}
            </h2>
            <p className="mb-0 mt-2 text-sm text-slate-700">{M.inspectionHint}</p>
          </div>
          <div className="rounded-lg bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
            {M.progressLabel}: {reviewedCount}/{inspection.definition.length}
          </div>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={M.progressLabel}
          aria-valuemin={0}
          aria-valuemax={inspection.definition.length}
          aria-valuenow={reviewedCount}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{
              width: `${inspection.definition.length ? (reviewedCount / inspection.definition.length) * 100 : 0}%`,
            }}
          />
        </div>

        {inspection.definition.map((item, index) => {
          const value = items[item.code] ?? {
            reviewed: false,
            issue: false,
            note: "",
            photoIds: [],
          };
          const itemPhotos = value.photoIds.map((id) => ({
            id,
            filename:
              inspection.photos.find((photo) => photo.id === id)?.filename ?? M.uploadedPhoto,
          }));
          return (
            <section
              key={item.code}
              className={`grid gap-4 rounded-xl border p-4 transition-colors ${
                value.reviewed
                  ? value.issue
                    ? "border-amber-300 bg-amber-50/60"
                    : "border-emerald-200 bg-emerald-50/40"
                  : "border-line bg-slate-50/70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <small className="font-semibold text-primary">
                    {returnChecklistGroupLabel(item.group)} · {M.itemNumber(index + 1)}
                  </small>
                  <h3 className="m-0 mt-1 text-base font-semibold">{item.label}</h3>
                </div>
                {item.serious && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    <CircleAlert size={14} aria-hidden="true" />
                    {M.seriousItem}
                  </span>
                )}
              </div>

              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold">{M.reviewThisItem}</legend>
                <label
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 transition-colors ${
                    value.reviewed && !value.issue
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-line bg-white hover:border-emerald-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`inspection-${item.code}`}
                    checked={value.reviewed && !value.issue}
                    onChange={() => updateItem(item.code, { reviewed: true, issue: false })}
                  />
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {M.passed}
                </label>
                <label
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 transition-colors ${
                    value.reviewed && value.issue
                      ? "border-amber-500 bg-amber-50 text-amber-950"
                      : "border-line bg-white hover:border-amber-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`inspection-${item.code}`}
                    checked={value.reviewed && value.issue}
                    onChange={() => updateItem(item.code, { reviewed: true, issue: true })}
                  />
                  <CircleAlert size={17} aria-hidden="true" />
                  {M.issue}
                </label>
              </fieldset>

              {value.issue && (
                <div className="grid gap-3 rounded-lg border border-amber-200 bg-white p-3">
                  <p className="m-0 text-sm text-amber-950">{M.issueInstruction}</p>
                  <label className="grid gap-1 font-semibold">
                    {M.note}
                    <textarea
                      value={value.note}
                      onChange={(event) => updateItem(item.code, { note: event.target.value })}
                      maxLength={4000}
                      rows={3}
                      aria-required="true"
                      className="rounded-lg border border-line p-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    />
                  </label>
                  {value.photoIds.map((id) => (
                    <ReturnPrivatePhoto
                      key={id}
                      requestId={requestId}
                      inspectionId={inspection.id}
                      photoId={id}
                      filename={inspection.photos.find((p) => p.id === id)?.filename ?? M.addPhoto}
                    />
                  ))}
                  <label className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 font-semibold text-amber-950 transition-colors hover:bg-amber-50 focus-within:outline focus-within:outline-2 focus-within:outline-primary">
                    <Upload size={17} aria-hidden="true" />
                    {uploading ? M.uploadingPhoto : M.addPhoto}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading || photoIds.size >= 5}
                      onChange={(event) => {
                        void upload(item.code, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {itemPhotos.length > 0 && (
                    <ul className="m-0 flex flex-wrap gap-2 p-0">
                      {itemPhotos.map((photo) => (
                        <li
                          key={photo.id}
                          className="list-none rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-800"
                        >
                          {photo.filename}
                        </li>
                      ))}
                    </ul>
                  )}
                  {value.note.trim() && value.photoIds.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      {M.issueEvidenceReady}
                    </span>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {propertyIssue && (
          <section className="grid gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div>
              <h3 className="m-0 text-base font-semibold">{M.propertyDisposition}</h3>
              <p className="mb-0 mt-1 text-sm text-amber-950">{M.propertyInstruction}</p>
            </div>
            <label className="grid gap-1 font-semibold">
              {M.propertyDisposition}
              <select
                value={propertyDisposition}
                onChange={(event) => {
                  setPropertyDisposition(event.target.value);
                  setDirty(true);
                }}
                className="min-h-11 rounded-lg border border-line bg-white px-3 font-normal"
              >
                <option value="NONE">{M.propertyNone}</option>
                <option value="RESOLVED">{M.propertyResolved}</option>
                <option value="STORED">{M.propertyStored}</option>
              </select>
            </label>
            {propertyDisposition === "STORED" && (
              <label className="grid gap-1 font-semibold">
                {M.propertyReceiver}
                <input
                  value={propertyReceiver}
                  onChange={(event) => {
                    setPropertyReceiver(event.target.value);
                    setDirty(true);
                  }}
                  className="min-h-11 rounded-lg border border-line bg-white px-3 font-normal"
                />
              </label>
            )}
            {propertyDisposition !== "NONE" && (
              <label className="grid gap-1 font-semibold">
                {M.propertyHandledAt}
                <input
                  type="datetime-local"
                  value={propertyHandledAt}
                  onChange={(event) => {
                    setPropertyHandledAt(event.target.value);
                    setDirty(true);
                  }}
                  className="min-h-11 rounded-lg border border-line bg-white px-3 font-normal"
                />
              </label>
            )}
            <fieldset className="grid gap-2">
              <legend className="font-semibold">{M.propertyEvidence}</legend>
              {inspection.photos.map((photo) => (
                <label key={photo.id} className="flex min-h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={propertyEvidencePhotoIds.includes(photo.id)}
                    onChange={(event) => {
                      setPropertyEvidencePhotoIds((current) =>
                        event.target.checked
                          ? [...current, photo.id]
                          : current.filter((id) => id !== photo.id),
                      );
                      setDirty(true);
                    }}
                  />
                  {photo.filename}
                </label>
              ))}
              {propertyEvidencePhotoIds.length === 0 && (
                <small className="text-slate-700">{M.selectPropertyEvidence}</small>
              )}
            </fieldset>
          </section>
        )}

        {photoError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
            {M.photoError}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
            {M.stale}
          </p>
        )}
        {complete.isError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
            {M.inspectionRequired}
          </p>
        )}
        {!allReviewed && (
          <p className="m-0 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
            {M.allItemsRequired}
          </p>
        )}
        {inspection.status === "DRAFT" && (
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={saveDraft}
              disabled={!canSave}
              className="min-h-11 rounded-lg border border-line bg-white px-5 font-semibold transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {save.isPending ? M.saving : M.saveInspection}
            </button>
            <button
              type="button"
              disabled={!canComplete}
              onClick={() => {
                if (window.confirm(M.completeConfirm)) {
                  complete.mutate({
                    inspectionId: inspection.id,
                    input: { expectedVersion: inspection.version },
                  });
                }
              }}
              className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {complete.isPending ? M.saving : M.completeInspection}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
