"use client";
import type { ReturnRequestDetailDto } from "@metastorage/contracts";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { F3 } from "./integration.messages";
import { f3Input } from "./integration-utils";
import { SettlementPreview } from "./return-money-summary";
import { useSettlementEditor } from "./use-settlement-editor";

export function ReturnSettlementForm({
  detail,
  stale,
}: {
  detail: ReturnRequestDetailDto;
  stale: boolean;
}) {
  const editor = useSettlementEditor(detail);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (editor.confirming && !stale) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor.confirming, stale]);
  const blocked = stale || editor.uncertain || editor.mutation.refreshError || editor.saved;
  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={editor.form.handleSubmit(() => editor.loadPreview())}>
        <fieldset disabled={blocked || editor.mutation.isPending} className="space-y-4">
          <label className="grid gap-2 font-semibold text-sm">
            {F3.damage} (VND)
            <input
              className={f3Input}
              inputMode="numeric"
              pattern="[0-9]+"
              required
              {...editor.form.register("damageAmount")}
            />
          </label>
          <label className="grid gap-2 font-semibold text-sm">
            {F3.rentRefund} (VND)
            <input
              className={f3Input}
              inputMode="numeric"
              pattern="[0-9]+"
              required
              {...editor.form.register("unusedRentRefundAmount")}
            />
          </label>
          <label className="grid gap-2 font-semibold text-sm">
            {F3.reason}
            <textarea
              className={f3Input}
              maxLength={4000}
              required
              {...editor.form.register("reason")}
            />
          </label>
          <Button loading={editor.loading} disabled={editor.loading}>
            {F3.preview}
          </Button>
        </fieldset>
      </form>
      {editor.message && (
        <p role="alert" className="text-red-700">
          {editor.message}
        </p>
      )}
      {editor.saved && (
        <p role="status" className="text-emerald-800">
          {F3.saved}
        </p>
      )}
      {editor.preview && <SettlementPreview preview={editor.preview} />}
      {editor.preview && (
        <button
          ref={trigger}
          type="button"
          disabled={
            blocked || editor.loading || !editor.preview.canClose || !editor.preview.calculation
          }
          onClick={() => void editor.loadPreview(true)}
          className="min-h-11 rounded bg-primary px-4 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
        >
          {F3.previewRefresh}
        </button>
      )}
      {(editor.uncertain || editor.mutation.refreshError) && (
        <div role="status">
          <p>{editor.saved ? F3.refreshFailed : F3.unknownOutcome}</p>
          <Button variant="outline" onClick={() => void editor.recover()}>
            {F3.refresh}
          </Button>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-label={F3.finalConfirm}
        onCancel={() => editor.setConfirming(false)}
        onClose={() => {
          editor.setConfirming(false);
          trigger.current?.focus();
        }}
        className="m-auto w-[min(640px,94vw)] max-h-[90dvh] overflow-y-auto rounded border border-[#BFCAC4] bg-white p-5 backdrop:bg-slate-950/40"
      >
        <h3 className="mb-4 text-lg font-bold">{F3.finalConfirm}</h3>
        {editor.confirming && editor.preview && <SettlementPreview preview={editor.preview} />}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            loading={editor.mutation.isPending}
            disabled={blocked || editor.mutation.isPending}
            onClick={() => void editor.approve()}
          >
            {F3.finalConfirm}
          </Button>
          <Button
            variant="outline"
            disabled={editor.mutation.isPending}
            onClick={() => editor.setConfirming(false)}
          >
            {F3.close}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
