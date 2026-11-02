import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Avatar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Avatar(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full bg-slate-100",
        className,
      )}
      {...props}
    />
  );
});

export const AvatarFallback = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AvatarFallback({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex size-full items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary select-none",
          className,
        )}
        {...props}
      />
    );
  },
);
