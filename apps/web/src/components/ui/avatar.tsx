import { forwardRef, type HTMLAttributes, type ImgHTMLAttributes, useState } from "react";
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

export const AvatarImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function AvatarImage({ className, alt = "", onError, ...props }, ref) {
    const [hasError, setHasError] = useState(false);
    if (hasError) return null;
    return (
      // biome-ignore lint/performance/noImgElement: avatar image component
      <img
        ref={ref}
        alt={alt}
        className={cn("aspect-square size-full object-cover", className)}
        onError={(e) => {
          setHasError(true);
          onError?.(e);
        }}
        {...props}
      />
    );
  },
);

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
