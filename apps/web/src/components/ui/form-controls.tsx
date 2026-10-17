import {
  cloneElement,
  forwardRef,
  type InputHTMLAttributes,
  isValidElement,
  type ReactElement,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import type { FieldShellProps } from "./form-controls.types";

export function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const messageId = `${fieldId}-message`;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: fieldId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })
    : children;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={fieldId}>
        <span className="text-sm font-bold">{label}</span>
      </label>
      {control}
      {error ? (
        <span className="text-[0.82rem] text-danger" id={messageId}>
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span className="text-xs text-muted" id={messageId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "min-h-[46px] w-full rounded-[11px] border border-slate-300 bg-white px-3 text-ink outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "min-h-[46px] w-full rounded-[11px] border border-slate-300 bg-white px-3 text-ink outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
