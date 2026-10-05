"use client";
import { ArrowLeft, Check, Lock } from "lucide-react";
import localFont from "next/font/local";
import Image from "next/image";
import type { ReactNode } from "react";
import type { ButtonProps } from "@/components/ui/button";
import { Button as BaseButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FLOW } from "./flow.messages";
import { FLOW_ASSETS } from "./flow-assets";

const body = localFont({
  src: [
    { path: "../../../public/fonts/storex/font-0.ttf", weight: "400" },
    { path: "../../../public/fonts/storex/font-1.ttf", weight: "500" },
    { path: "../../../public/fonts/storex/font-2.ttf", weight: "600" },
    { path: "../../../public/fonts/storex/font-3.ttf", weight: "700" },
  ],
  variable: "--font-flow-body",
  display: "swap",
});
const heading = localFont({
  src: [
    { path: "../../../public/fonts/storex/font-5.ttf", weight: "500" },
    { path: "../../../public/fonts/storex/font-6.ttf", weight: "600" },
    { path: "../../../public/fonts/storex/font-7.ttf", weight: "700" },
  ],
  variable: "--font-flow-heading",
  display: "swap",
});
export const flowFontClass = `${body.variable} ${heading.variable} [font-family:var(--font-flow-body)] text-[14px] text-[#131b2e] [--color-primary:#003b2f] [--color-primary-dark:#125345] [--color-primary-soft:#b4efda] [--color-muted:#707975] [--color-line:#bfc9c440] [--color-canvas:#faf8ff] [--color-surface:#fff]`;
export const titleClass = "[font-family:var(--font-flow-heading)] font-semibold tracking-[-0.01em]";
export const inputClass =
  "w-full min-h-11 rounded border border-transparent bg-[#f2f3ff] px-3 py-2 text-sm outline-none focus:border-[#306858] focus:ring-2 focus:ring-[#b4efda] disabled:opacity-50";
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]",
        !className.match(/(?:^|\s)bg-/) && "bg-white",
        className,
      )}
    >
      {children}
    </section>
  );
}
export function Pill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold",
        tone === "green"
          ? "bg-[#b4efda] text-[#135041]"
          : tone === "amber"
            ? "bg-[#ffdcc3] text-[#6e3900]"
            : tone === "red"
              ? "bg-[#ffdad6] text-[#93000a]"
              : "bg-[#eaedff] text-[#404945]",
      )}
    >
      {children}
    </span>
  );
}
export function FlowHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="-mx-4 bg-[#f2f3ff] px-4 py-5 sm:-mx-8 sm:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#306858]">
            {FLOW.flowTitle}
          </p>
          <h1
            className={cn(
              titleClass,
              "mt-1 text-[26px] leading-[34px] sm:text-[32px] sm:leading-10",
            )}
          >
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-[#404945]">{description}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}
export function Steps({ active, completed = [] }: { active: number; completed?: number[] }) {
  return (
    <ol className="grid grid-cols-2 gap-3 rounded-lg bg-white p-4 shadow-sm lg:grid-cols-4">
      {FLOW.stepNames.map((name, i) => (
        <li
          key={name}
          aria-current={i === active ? "step" : undefined}
          className="flex items-center gap-3"
        >
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg font-bold",
              completed.includes(i)
                ? "bg-[#b4efda] text-[#135041]"
                : i === active
                  ? "bg-[#003b2f] text-white"
                  : "bg-[#eaedff] text-[#707975]",
            )}
          >
            {completed.includes(i) ? <Check size={20} /> : String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <p className="text-[11px] text-[#707975]">
              {completed.includes(i)
                ? FLOW.done
                : i === active
                  ? FLOW.current
                  : i < active
                    ? FLOW.pendingStep
                    : FLOW.next}
            </p>
            <p className={cn(titleClass, "text-sm")}>{name}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <h2 className={cn(titleClass, "flex items-center gap-2 text-lg leading-[26px]")}>
      {icon}
      {children}
    </h2>
  );
}
export function DataPair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-[#707975]">{label}</p>
      <div className="mt-1 break-words font-medium">{children}</div>
    </div>
  );
}
export function UnitPlaceholder() {
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[#f2f3ff]">
      <Image
        src={FLOW_ASSETS.corridor}
        alt="Ảnh minh họa không gian kho"
        fill
        unoptimized
        sizes="80px"
        className="object-cover"
      />
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[8px] text-white">
        Ảnh minh họa
      </span>
    </div>
  );
}
export function FlowButton({ className, variant, style, ...props }: ButtonProps) {
  return (
    <BaseButton
      variant={variant}
      className={cn("rounded text-sm font-semibold shadow-sm", className)}
      style={{
        borderRadius: 4,
        fontFamily: "var(--font-flow-heading)",
        fontWeight: 600,
        ...(variant === "secondary" ? { backgroundColor: "#eaedff", color: "#131b2e" } : {}),
        ...style,
      }}
      {...props}
    />
  );
}
export function BackLabel() {
  return (
    <>
      <ArrowLeft size={18} />
      {FLOW.back}
    </>
  );
}
export function LockedLabel() {
  return (
    <>
      <Lock size={16} />
      {FLOW.locked}
    </>
  );
}

export function FlowHelp() {
  return (
    <details className="rounded-lg border border-[#bfc9c4] bg-white p-4">
      <summary className="cursor-pointer font-semibold text-[#003b2f]">{FLOW.help}</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#404945]">
        {FLOW.helpSteps.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
    </details>
  );
}
