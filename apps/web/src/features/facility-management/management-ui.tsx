"use client";

import { cloneElement, useId } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { F5 } from "./management.messages";
import type {
  ManagementDialogProps,
  ManagementFieldProps,
  PageControlsProps,
} from "./management.types";

export function ManagementField({ label, error, children }: ManagementFieldProps) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-700">
        {label}
      </label>
      {cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-ink shadow-2xl sm:p-6",
          wide ? "max-w-2xl sm:max-w-3xl" : "max-w-lg sm:max-w-xl",
        )}
      >
        <DialogHeader className="border-b border-slate-100 pb-3 pr-6">
          <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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
