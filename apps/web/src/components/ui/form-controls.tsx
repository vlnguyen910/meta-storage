import { ChevronDown } from "lucide-react";
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
  function Select({ className = "", children, disabled, id, ...props }, ref) {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          className={cn(
            "min-h-11 h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 text-xs sm:text-sm font-medium text-slate-800 shadow-xs outline-none transition-colors hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
        />
      </div>
    );
  },
);
