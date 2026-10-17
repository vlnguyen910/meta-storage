import { cn } from "@/lib/cn";
import type { ButtonProps, ButtonVariant } from "./button.types";

export type { ButtonProps } from "./button.types";

const baseClasses =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 px-[18px] font-bold transition duration-150 hover:not-disabled:-translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring/45 disabled:cursor-not-allowed disabled:opacity-[0.55]";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-[0_6px_18px_rgb(22_95_77_/_20%)] hover:bg-primary-dark",
  secondary: "bg-secondary text-white hover:bg-slate-600",
  outline: "border border-slate-300 bg-white text-ink hover:border-primary hover:text-primary",
  ghost: "bg-transparent text-secondary hover:bg-slate-100",
  danger: "bg-danger text-white hover:bg-red-600",
};

export function buttonClassName(variant: ButtonVariant = "primary", className?: string): string {
  return cn(baseClasses, variantClasses[variant], className);
}

export function Button({
  variant = "primary",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName(variant, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="size-[18px] animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
