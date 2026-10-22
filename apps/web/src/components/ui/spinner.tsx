import { cn } from "@/lib/cn";
import type { SpinnerProps, SpinnerSize } from "./spinner.types";

export type { SpinnerProps, SpinnerSize, SpinnerVariant } from "./spinner.types";

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
  xl: "size-12",
};

export function Spinner({ variant = "brand", size = "md", className = "", label }: SpinnerProps) {
  const sizeClass = sizeClasses[size];

  if (variant === "button") {
    return (
      <span
        aria-hidden={label ? undefined : "true"}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center",
          sizeClass,
          className,
        )}
        role={label ? "status" : undefined}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-current opacity-25"
        />
        <span
          aria-hidden="true"
          className="size-full animate-spin rounded-full border-2 border-transparent border-t-current"
        />
        {label ? <span className="sr-only">{label}</span> : null}
      </span>
    );
  }

  if (variant === "brand") {
    return (
      <span
        aria-hidden={label ? undefined : "true"}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center",
          sizeClass,
          className,
        )}
        role={label ? "status" : undefined}
      >
        {/* Outer orbital ring */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-primary border-r-primary animate-spin"
        />
        {/* Inner reverse-orbital ring */}
        <span
          aria-hidden="true"
          className="absolute inset-[15%] rounded-full border-[1.5px] border-teal-500/25 border-b-emerald-600 animate-spin-reverse"
        />
        {/* Center glowing brand core */}
        <span
          aria-hidden="true"
          className="size-[20%] rounded-full bg-primary animate-pulse-subtle shadow-xs"
        />
        {label ? <span className="sr-only">{label}</span> : null}
      </span>
    );
  }

  return (
    <span
      aria-hidden={label ? undefined : "true"}
      className={cn(
        "inline-block shrink-0 rounded-full border-2 border-slate-200 border-t-primary animate-spin",
        sizeClass,
        className,
      )}
      role={label ? "status" : undefined}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
