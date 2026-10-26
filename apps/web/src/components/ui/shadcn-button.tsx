import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const shadcnButtonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white shadow-sm hover:bg-primary-dark",
        outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ShadcnButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof shadcnButtonVariants>;

export function ShadcnButton({ className, variant, ...props }: ShadcnButtonProps) {
  return <button className={cn(shadcnButtonVariants({ variant }), className)} {...props} />;
}
