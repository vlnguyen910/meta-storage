"use client";

import { cloneElement, useId, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPagination } from "@/components/ui/list-pagination";
import { cn } from "@/lib/utils";
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
  const trigger = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onOpenAutoFocus={() => {
          trigger.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (trigger.current instanceof HTMLElement && trigger.current.isConnected) {
            event.preventDefault();
            trigger.current.focus({ preventScroll: true });
          }
        }}
        className={cn(
          "max-h-[calc(100dvh-2rem)] overflow-y-auto gap-4 rounded-card border border-slate-200 bg-white p-5 text-ink shadow-2xl sm:p-6",
          wide ? "max-w-[calc(100vw-2rem)] sm:max-w-3xl" : "max-w-[calc(100vw-2rem)] sm:max-w-xl",
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
  count: _count,
  total,
  onChange,
  pending,
}: PageControlsProps) {
  const pageSize = 20;
  const page = Math.floor(offset / pageSize) + 1;
  return (
    <ListPagination
      label={label}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(p) => onChange((p - 1) * pageSize)}
      pending={pending}
      unitLabel="mục"
    />
  );
}

export const textareaClass =
  "min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 text-ink focus:outline-2 focus:outline-primary";
export const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
