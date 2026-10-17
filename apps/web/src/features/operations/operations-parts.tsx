"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import type {
  OperationsDialogProps,
  OperationsMetricProps,
  OperationsTableProps,
} from "./operations.types";

export function OperationsTable({ label, headings, children }: Readonly<OperationsTableProps>) {
  return (
    <section
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this horizontally scrollable region.
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] focus-visible:outline-2 focus-visible:outline-primary"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </section>
  );
}

export function OperationsMetric({ label, value, detail }: Readonly<OperationsMetricProps>) {
  return (
    <section className="min-w-0 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <h2 className="text-sm font-semibold text-slate-600">{label}</h2>
      <p className="my-3 break-words text-2xl font-bold tabular-nums text-ink">{value}</p>
      {detail && <p className="m-0 text-xs text-slate-600">{detail}</p>}
    </section>
  );
}

export function OperationsDialog({ title, children, onClose }: Readonly<OperationsDialogProps>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="operations-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-card border border-outline-variant bg-surface-container-lowest p-6 text-ink shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] backdrop:bg-slate-950/40"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id="operations-dialog-title" className="text-xl font-bold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="min-w-11 px-2"
          aria-label={M.close}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      <p className="mb-4 text-sm text-slate-600">{M.review}</p>
      {children}
    </dialog>
  );
}
