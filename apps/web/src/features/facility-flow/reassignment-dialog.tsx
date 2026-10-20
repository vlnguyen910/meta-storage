"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { FLOW } from "./flow.messages";
import { FlowButton, titleClass } from "./flow-ui";
import type { ReassignmentDialogProps } from "./reassignment-dialog.types";

export function ReassignmentDialog({
  change,
  pending,
  error,
  onCancel,
  onConfirm,
}: ReassignmentDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="reassignment-title"
      aria-describedby="reassignment-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl bg-white p-6 text-[#131b2e] shadow-2xl backdrop:bg-black/45"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-[#ffdcc3] p-2 text-[#6e3900]">
          <AlertTriangle size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="reassignment-title" className={`${titleClass} text-xl`}>
            {FLOW.reassignTitle}
          </h2>
          <p className="mt-1 text-sm text-[#404945]">
            {change.bookingCode} · {change.customerName}
          </p>
        </div>
      </div>
      <div className="my-5 grid items-center gap-3 rounded-lg bg-[#f2f3ff] p-4 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="text-xs text-[#404945]">{FLOW.reassignFrom}</p>
          <p className="mt-1 break-all text-base font-semibold">
            {change.previousUnitCode ?? FLOW.unassigned}
          </p>
        </div>
        <ArrowRight size={20} aria-hidden="true" className="text-[#306858] max-sm:rotate-90" />
        <div>
          <p className="text-xs text-[#404945]">{FLOW.reassignTo}</p>
          <p className="mt-1 break-all text-base font-semibold text-[#003b2f]">{change.unitCode}</p>
        </div>
      </div>
      <p id="reassignment-description" className="text-sm leading-6 text-[#404945]">
        {FLOW.reassignDescription}
      </p>
      {change.reason && (
        <div className="mt-4">
          <p className="text-xs text-[#404945]">{FLOW.notesAssign}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{change.reason}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#ffdad6] p-3 text-sm text-[#93000a]">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#bfc9c4] pt-4">
        <button
          ref={cancel}
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="min-h-11 rounded px-4 py-2 font-semibold text-[#131b2e] outline-offset-2 hover:bg-[#f2f3ff] focus-visible:outline-2 focus-visible:outline-[#306858] disabled:opacity-50"
        >
          {FLOW.reassignCancel}
        </button>
        <FlowButton onClick={onConfirm} loading={pending} icon={<ArrowRight size={18} />}>
          {FLOW.reassignConfirm}
        </FlowButton>
      </div>
    </dialog>
  );
}
