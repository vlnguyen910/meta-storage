"use client";

import { cloneElement, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { F5 } from "./management.messages";
import type {
  ManagementDialogProps,
  ManagementFieldProps,
  PageControlsProps,
} from "./management.types";

export function ManagementField({ label, error, children }: ManagementFieldProps) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ManagementDialog({
  title,
  onClose,
  children,
  pending,
  wide,
}: ManagementDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className={cn(
        "fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-5 text-ink shadow-xl backdrop:bg-slate-950/40 sm:p-6",
        wide ? "max-w-3xl" : "max-w-xl",
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="border! border-slate-200 text-sm"
          onClick={onClose}
          disabled={pending}
        >
          {F5.close}
        </Button>
      </div>
      {children}
    </dialog>
  );
}

export function PageControls({
  label,
  offset,
  count,
  total,
  onChange,
  pending,
}: PageControlsProps) {
  return (
    <nav
      aria-label={F5.paginationFor(label)}
      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
    >
      <span aria-live="polite">{F5.page(offset, count, total)}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending || offset === 0}
          onClick={() => onChange(Math.max(0, offset - 20))}
        >
          {F5.previous}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || offset + count >= total}
          onClick={() => onChange(offset + 20)}
        >
          {F5.next}
        </Button>
      </div>
    </nav>
  );
}

export const textareaClass =
  "min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 text-ink focus:outline-2 focus:outline-primary";
export const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
