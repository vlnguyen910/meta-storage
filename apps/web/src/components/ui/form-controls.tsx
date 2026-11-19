import {
  cloneElement,
  forwardRef,
  type InputHTMLAttributes,
  isValidElement,
  type ReactElement,
  useLayoutEffect,
  useRef,
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

const formatVndDigits = (value: number | undefined) =>
  value === undefined || Number.isNaN(value) ? "" : new Intl.NumberFormat("vi-VN").format(value);

type VndInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
};

/** Whole-VND amount input: shows "." thousands separators and a "đ" suffix. */
export const VndInput = forwardRef<HTMLInputElement, VndInputProps>(function VndInput(
  { value, onValueChange, className, ...props },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  const caretDigits = useRef<number | null>(null);
  const text = formatVndDigits(value);
  useLayoutEffect(() => {
    const input = inner.current;
    if (!input || caretDigits.current === null) return;
    let seen = 0;
    let position = 0;
    while (position < text.length && seen < caretDigits.current) {
      if (/\d/.test(text[position] ?? "")) seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
    caretDigits.current = null;
  });
  return (
    <div className="relative">
      <Input
        {...props}
        ref={(node) => {
          inner.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        className={cn("pr-9", className)}
        onChange={(event) => {
          const raw = event.target.value;
          const caret = event.target.selectionStart ?? raw.length;
          caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
          const digits = raw.replace(/\D/g, "");
          onValueChange(digits ? Number(digits) : undefined);
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted"
      >
        đ
      </span>
    </div>
  );
});
