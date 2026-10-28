"use client";
import type { ReturnRequestDetailDto } from "@metastorage/contracts";
import { Button } from "@/components/ui/button";
import { F3 } from "./integration.messages";
import { f3Input } from "./integration-utils";
import { ReturnEvidenceUpload } from "./return-evidence-upload";
import { useRefundEditor } from "./use-refund-editor";

export function ReturnRefundForm({
  detail,
  stale,
}: {
  detail: ReturnRequestDetailDto;
  stale: boolean;
}) {
  const editor = useRefundEditor(detail);
  const blocked =
    stale || !editor.ready || editor.mutation.refreshError || editor.uncertain || editor.recorded;
  return (
    <form
      noValidate
      className="space-y-4 border-t border-slate-200 pt-4"
      onSubmit={editor.form.handleSubmit(editor.submit)}
    >
      <h3 className="font-bold">{F3.refund}</h3>
      <p className="text-sm text-slate-600">{F3.refundHelp}</p>
      {editor.restored && (
        <p role="status" className="rounded bg-amber-50 p-3 text-amber-950">
          {F3.pendingTransfer}
        </p>
      )}
      <fieldset disabled={blocked || editor.mutation.isPending} className="space-y-4">
        <label className="grid gap-2 font-semibold text-sm">
          {F3.depositTransfer}
          <input
            className={f3Input}
            inputMode="numeric"
            pattern="[0-9]+"
            required
            aria-invalid={Boolean(editor.form.formState.errors.depositRefundAmount)}
            {...editor.form.register("depositRefundAmount")}
          />
          {editor.form.formState.errors.depositRefundAmount && (
            <span role="alert" className="text-xs font-normal text-danger">
              {editor.form.formState.errors.depositRefundAmount.message}
            </span>
          )}
        </label>
        <label className="grid gap-2 font-semibold text-sm">
          {F3.rentTransfer}
          <input
            className={f3Input}
            inputMode="numeric"
            pattern="[0-9]+"
            required
            aria-invalid={Boolean(editor.form.formState.errors.rentRefundAmount)}
            {...editor.form.register("rentRefundAmount")}
          />
          {editor.form.formState.errors.rentRefundAmount && (
            <span role="alert" className="text-xs font-normal text-danger">
              {editor.form.formState.errors.rentRefundAmount.message}
            </span>
          )}
        </label>
        <label className="grid gap-2 font-semibold text-sm">
          {F3.reference}
          <input
            className={f3Input}
            maxLength={128}
            required
            aria-invalid={Boolean(editor.form.formState.errors.reference)}
            {...editor.form.register("reference")}
          />
          {editor.form.formState.errors.reference && (
            <span role="alert" className="text-xs font-normal text-danger">
              {editor.form.formState.errors.reference.message}
            </span>
          )}
        </label>
        <fieldset className="space-y-2">
          <legend className="font-semibold text-sm">{F3.savedProofs}</legend>
          {detail.evidence
            .filter((photo) => photo.purpose === "REFUND")
            .map((photo) => (
              <label key={photo.id} className="flex min-h-11 items-center gap-3 break-all text-sm">
                <input
                  type="checkbox"
                  checked={editor.evidence.includes(photo.id)}
                  onChange={(event) =>
                    editor.setEvidence(
                      event.target.checked
                        ? [...editor.evidence, photo.id]
                        : editor.evidence.filter((id) => id !== photo.id),
                    )
                  }
                />
                {photo.filename}
              </label>
            ))}
        </fieldset>
        <ReturnEvidenceUpload
          requestId={detail.request.id}
          version={detail.request.version}
          purpose="REFUND"
          selected={editor.evidence}
          onSelect={editor.setEvidence}
        />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" required {...editor.form.register("confirmed")} />
          {F3.confirmTransfer}
        </label>
        <Button
          loading={editor.mutation.isPending}
          disabled={
            editor.mutation.isPending || !editor.evidence.length || !editor.form.watch("confirmed")
          }
        >
          {F3.refund}
        </Button>
      </fieldset>
      {editor.message && (
        <p role="status" className="text-sm text-slate-800">
          {editor.message}
        </p>
      )}
      {(editor.uncertain || editor.mutation.refreshError) && (
        <div role="alert">
          <p>{editor.mutation.isSuccess ? F3.refreshFailed : F3.unknownOutcome}</p>
          <Button variant="outline" onClick={() => void editor.recover()}>
            {F3.refresh}
          </Button>
        </div>
      )}
    </form>
  );
}
