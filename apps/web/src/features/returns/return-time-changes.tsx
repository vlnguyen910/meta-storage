"use client";
import type { ReturnRequestDetailDto } from "@metastorage/contracts";
import { DecideReturnTimeSchema, ProposeReturnTimeSchema } from "@metastorage/contracts";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import {
  f3Input,
  f3Panel,
  facilityDateTime,
  facilityTimeToIso,
  integrationError,
} from "./integration-utils";
import { ReturnEvidenceUpload } from "./return-evidence-upload";
import { ReturnPrivatePhoto } from "./return-private-photo";
import { useReturnWrite } from "./use-return-write";

export function ReturnTimeChanges({
  detail,
  staff,
}: {
  detail: ReturnRequestDetailDto;
  staff: boolean;
}) {
  const { request } = detail;
  const [selected, setSelected] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const form = useForm<{ actualReturnAt: string; reason: string }>({
    defaultValues: {
      actualReturnAt: detail.actualReturnAt
        ? facilityDateTime(detail.actualReturnAt, request.timezone)
        : "",
      reason: "",
    },
  });
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const propose = useReturnWrite(
    request.id,
    async (values: { actualReturnAt: string; reason: string }) => {
      const payload = {
        actualReturnAt: facilityTimeToIso(values.actualReturnAt, request.timezone),
        reason: values.reason.trim(),
        evidencePhotoIds: selected,
      };
      const serialized = JSON.stringify(payload);
      if (attempt.current?.payload !== serialized)
        attempt.current = { payload: serialized, key: crypto.randomUUID() };
      const input = ProposeReturnTimeSchema.safeParse({
        ...payload,
        expectedVersion: request.version,
        idempotencyKey: attempt.current.key,
      });
      if (!input.success) {
        form.setError("root", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.returnActions.proposeTime(request.id, input.data);
    },
  );
  return (
    <section className={f3Panel}>
      <h2 className="text-lg font-bold">{F3.timeChanges}</h2>
      <p className="text-sm text-slate-600">
        {F3.timeHint} ({request.timezone})
      </p>
      {detail.actualReturnAt && (
        <p>
          {F3.oldTime}:{" "}
          <strong>
            {new Date(detail.actualReturnAt).toLocaleString("vi-VN", {
              timeZone: request.timezone,
            })}
          </strong>
        </p>
      )}
      <ul className="space-y-3">
        {!detail.timeChanges.length && <li>{F3.noTimeChanges}</li>}
        {detail.timeChanges.map((change) => (
          <li key={change.id} className="rounded border border-slate-200 p-4 space-y-3">
            <strong>{F3.status[change.status as keyof typeof F3.status] ?? change.status}</strong>
            <p>
              {change.previousAt
                ? new Date(change.previousAt).toLocaleString("vi-VN", {
                    timeZone: request.timezone,
                  })
                : "—"}{" "}
              →{" "}
              {new Date(change.proposedAt).toLocaleString("vi-VN", { timeZone: request.timezone })}
            </p>
            <p>{change.reason}</p>
            {change.decisionReason && <p>{change.decisionReason}</p>}
            {change.evidencePhotoIds.map((id) => {
              const evidence = detail.evidence.find((p) => p.id === id);
              const inspection = detail.inspections.find((i) => i.photos.some((p) => p.id === id));
              return (
                <ReturnPrivatePhoto
                  key={id}
                  requestId={request.id}
                  inspectionId={inspection?.id}
                  photoId={id}
                  filename={evidence?.filename ?? F3.evidence}
                />
              );
            })}
            {!staff && change.status === "PENDING" && (
              <TimeDecision
                key={change.id}
                requestId={request.id}
                changeId={change.id}
                version={request.version}
              />
            )}
          </li>
        ))}
      </ul>
      {staff && detail.actualReturnAt && request.status !== "CANCELLED" && (
        <details className="border-t border-slate-200 pt-3">
          <summary className="min-h-11 cursor-pointer font-semibold text-primary">
            {F3.propose}
          </summary>
          <form
            className="space-y-4 border-t border-slate-200 pt-4"
            onSubmit={form.handleSubmit(async (values) => {
              setSent(false);
              form.clearErrors();
              try {
                await propose.mutateAsync(values);
                setSent(true);
                setSelected([]);
                attempt.current = null;
                form.reset({ actualReturnAt: values.actualReturnAt, reason: "" });
              } catch {
                /* Mutation error remains visible; draft and idempotency key are preserved. */
              }
            })}
          >
            <label className="grid gap-2 text-sm font-semibold">
              {F3.proposedTime}
              <input
                className={f3Input}
                type="datetime-local"
                {...form.register("actualReturnAt", { required: true })}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              {F3.reason}
              <textarea
                className={f3Input}
                maxLength={4000}
                {...form.register("reason", { required: true })}
                required
              />
            </label>
            <ReturnEvidenceUpload
              requestId={request.id}
              version={request.version}
              purpose="TIME_CORRECTION"
              selected={selected}
              onSelect={setSelected}
            />
            <Button loading={propose.isPending} disabled={propose.isPending || !selected.length}>
              {F3.propose}
            </Button>
            {(form.formState.errors.root || propose.isError) && (
              <p role="alert" className="text-red-700">
                {form.formState.errors.root?.message ?? integrationError(propose.error)}
              </p>
            )}
            {sent && (
              <p role="status" className="text-emerald-800">
                {F3.saved}
              </p>
            )}
          </form>
        </details>
      )}
    </section>
  );
}

function TimeDecision({
  requestId,
  changeId,
  version,
}: {
  requestId: string;
  changeId: string;
  version: number;
}) {
  const form = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const [decision, setDecision] = useState<boolean | null>(null);
  const mutation = useReturnWrite(requestId, async (values: { reason: string }) => {
    const parsed = DecideReturnTimeSchema.safeParse({
      expectedVersion: version,
      approve: decision,
      reason: values.reason,
    });
    if (!parsed.success) {
      form.setError("root", { message: F3.invalid });
      throw new Error("validation");
    }
    return api.returnActions.decideTime(requestId, changeId, parsed.data);
  });
  return (
    <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <p className="text-sm text-amber-900">{F3.timeWarning}</p>
      <label className="grid gap-2 font-semibold text-sm">
        {F3.decisionReason}
        <textarea
          className={f3Input}
          maxLength={4000}
          required
          {...form.register("reason", { required: true })}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={decision === true ? "primary" : "outline"}
          aria-pressed={decision === true}
          onClick={() => setDecision(true)}
        >
          {F3.approve}
        </Button>
        <Button
          type="button"
          variant={decision === false ? "danger" : "outline"}
          aria-pressed={decision === false}
          onClick={() => setDecision(false)}
        >
          {F3.reject}
        </Button>
      </div>
      {decision !== null && (
        <Button loading={mutation.isPending} disabled={mutation.isPending}>
          {decision ? F3.approve : F3.reject}
        </Button>
      )}
      {(mutation.isError || form.formState.errors.root) && (
        <p role="alert" className="text-red-700">
          {form.formState.errors.root?.message ?? integrationError(mutation.error)}
        </p>
      )}
    </form>
  );
}
