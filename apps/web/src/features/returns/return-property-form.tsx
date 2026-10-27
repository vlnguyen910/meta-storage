"use client";
import type { ReturnInspectionDetailDto, ReturnRequestDetailDto } from "@metastorage/contracts";
import { ReturnPropertySchema } from "@metastorage/contracts";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import {
  f3Input,
  facilityDateTime,
  facilityTimeToIso,
  integrationError,
  readFileBase64,
} from "./integration-utils";
import { ReturnPrivatePhoto } from "./return-private-photo";
import { RETURNS_MESSAGES, returnStatusLabel } from "./returns.messages";
import { useReturnWrite } from "./use-return-write";

export function ReturnPropertyForm({
  detail,
  inspection,
}: {
  detail: ReturnRequestDetailDto;
  inspection: ReturnInspectionDetailDto;
}) {
  const { request } = detail;
  const form = useForm<{
    disposition: string;
    receiver: string;
    handledAt: string;
    evidence: string[];
  }>({
    defaultValues: {
      disposition: inspection.propertyDisposition,
      receiver: inspection.propertyReceiver ?? "",
      handledAt: inspection.propertyHandledAt
        ? facilityDateTime(inspection.propertyHandledAt, request.timezone)
        : "",
      evidence: inspection.propertyEvidencePhotoIds,
    },
  });
  const mutation = useReturnWrite(
    request.id,
    async (values: {
      disposition: string;
      receiver: string;
      handledAt: string;
      evidence: string[];
    }) => {
      const parsed = ReturnPropertySchema.safeParse({
        expectedVersion: inspection.version,
        propertyDisposition: values.disposition,
        propertyReceiver: values.disposition === "STORED" ? values.receiver.trim() || null : null,
        propertyHandledAt: values.handledAt
          ? facilityTimeToIso(values.handledAt, request.timezone)
          : null,
        propertyEvidencePhotoIds: values.evidence,
      });
      if (!parsed.success) {
        form.setError("root", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.returnActions.property(request.id, inspection.id, parsed.data);
    },
  );
  const latest = detail.inspections[0];
  const upload = useReturnWrite(request.id, async (file: File) => {
    if (
      !latest ||
      latest.photos.length >= 5 ||
      file.size >= 3 * 1024 * 1024 ||
      !file.type.match(/^image\/(jpeg|png|webp)$/)
    ) {
      form.setError("root", { message: F3.badPhoto });
      throw new Error("validation");
    }
    const result = await api.returns.uploadInspectionPhoto(request.id, latest.id, {
      expectedVersion: latest.version,
      filename: file.name.slice(0, 120),
      mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
      dataBase64: await readFileBase64(file),
    });
    form.setValue("evidence", [...form.getValues("evidence"), result.id]);
    return result;
  });
  return (
    <form
      className="mt-4 space-y-4 border-t border-slate-200 pt-4"
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors();
        mutation.mutate(values);
      })}
    >
      <h3 className="font-bold">{F3.property}</h3>
      <p className="text-sm text-slate-600">
        {F3.propertyHelp} ({request.timezone})
      </p>
      <label className="grid gap-2 text-sm font-semibold">
        {F3.disposition}
        <select className={f3Input} {...form.register("disposition")}>
          <option value="NONE">{F3.none}</option>
          <option value="RESOLVED">{F3.resolved}</option>
          <option value="STORED">{F3.stored}</option>
        </select>
      </label>
      {form.watch("disposition") === "STORED" && (
        <label className="grid gap-2 text-sm font-semibold">
          {F3.receiver}
          <input className={f3Input} maxLength={300} required {...form.register("receiver")} />
        </label>
      )}
      {form.watch("disposition") !== "NONE" && (
        <>
          <label className="grid gap-2 text-sm font-semibold">
            {F3.handledAt}
            <input
              type="datetime-local"
              className={f3Input}
              required
              {...form.register("handledAt")}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="font-semibold text-sm">{F3.evidence}</legend>
            {detail.inspections
              .flatMap((i) => i.photos)
              .map((photo) => (
                <label
                  key={photo.id}
                  className="flex min-h-11 items-center gap-3 text-sm break-all"
                >
                  <input type="checkbox" value={photo.id} {...form.register("evidence")} />
                  {photo.filename}
                </label>
              ))}
          </fieldset>
          {latest && ["PASS", "DRAFT"].includes(latest.status) && (
            <label className="grid gap-2 text-sm font-semibold">
              {F3.evidence}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={upload.isPending || latest.photos.length >= 5}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload.mutate(file);
                }}
              />
            </label>
          )}
        </>
      )}
      <Button loading={mutation.isPending} disabled={mutation.isPending || upload.isPending}>
        {F3.save}
      </Button>
      {(form.formState.errors.root || mutation.isError || upload.isError) && (
        <p role="alert" className="text-red-700">
          {form.formState.errors.root?.message ?? integrationError(mutation.error ?? upload.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-emerald-800">
          {F3.saved}
        </p>
      )}
    </form>
  );
}

export function ReturnInspectionReview({
  detail,
  staff,
}: {
  detail: ReturnRequestDetailDto;
  staff: boolean;
}) {
  return (
    <div className="space-y-4">
      {detail.inspections
        .filter((i) => i.status !== "DRAFT")
        .map((inspection) => (
          <details key={inspection.id} className="rounded border border-[#BFCAC4] bg-white p-4">
            <summary className="min-h-11 cursor-pointer font-bold">
              {RETURNS_MESSAGES.attemptLabel(inspection.attempt)} ·{" "}
              {returnStatusLabel(inspection.status)}
            </summary>
            <ul className="space-y-3 mt-3">
              {inspection.results.map((result) => (
                <li key={result.code} className="border-t border-slate-200 pt-3">
                  <strong>
                    {inspection.definition.find((d) => d.code === result.code)?.label ??
                      result.code}
                  </strong>
                  <p className={result.issue ? "text-amber-900" : "text-emerald-800"}>
                    {result.note}
                  </p>
                  {result.photoIds.map((id) => (
                    <ReturnPrivatePhoto
                      key={id}
                      requestId={detail.request.id}
                      inspectionId={inspection.id}
                      photoId={id}
                      filename={inspection.photos.find((p) => p.id === id)?.filename ?? F3.evidence}
                    />
                  ))}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-700">
              {F3.disposition}:{" "}
              {inspection.propertyDisposition === "STORED"
                ? F3.stored
                : inspection.propertyDisposition === "RESOLVED"
                  ? F3.resolved
                  : F3.none}
            </p>
            {inspection.propertyReceiver && (
              <p className="text-sm">
                {F3.receiver}: {inspection.propertyReceiver}
              </p>
            )}
            {inspection.propertyHandledAt && (
              <p className="text-sm">
                {F3.handledAt}:{" "}
                {new Date(inspection.propertyHandledAt).toLocaleString("vi-VN", {
                  timeZone: detail.request.timezone,
                })}
              </p>
            )}
            {staff &&
              ["INSPECTING", "FAILED"].includes(detail.request.status) &&
              (inspection.propertyDisposition !== "NONE" ||
                inspection.definition.some(
                  (d) =>
                    d.group === "REMAINING_PROPERTY" &&
                    inspection.results.find((r) => r.code === d.code)?.issue,
                )) && <ReturnPropertyForm detail={detail} inspection={inspection} />}
          </details>
        ))}
    </div>
  );
}
