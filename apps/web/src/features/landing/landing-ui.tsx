import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { landingMessages as m } from "./landing.messages";
import { LandingReveal } from "./landing-reveal";

export const landingContainer = "mx-auto w-full max-w-6xl px-5 sm:px-8";
export const landingSection = "py-14 sm:py-20";
export const actionClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function LandingAction({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(actionClass, className)}>
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function SectionHeading({
  title,
  description,
  align = "center",
}: {
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <LandingReveal className={cn("mb-9", align === "center" && "mx-auto max-w-2xl text-center")}>
      <h2 className="text-2xl font-bold leading-snug tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-7 text-muted sm:text-base">{description}</p>
      ) : null}
    </LandingReveal>
  );
}

export function StorageImage({
  index,
  className,
  priority = false,
  alt = m.illustration,
  showCaption = false,
}: {
  index: number;
  className?: string;
  priority?: boolean;
  alt?: string;
  showCaption?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-primary-soft", className)}>
      <Image
        src={`/images/metastorage/landing/${index}.png`}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
        className="object-cover"
        priority={priority}
      />
      {showCaption ? (
        <span className="absolute top-3 left-3 rounded-md bg-primary-dark px-2 py-1 text-[10px] text-white">
          {m.imageLabel}
        </span>
      ) : null}
    </div>
  );
}

export function CatalogFeedback({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="rounded-xl border border-line bg-canvas p-6 text-sm text-ink">
        <p>{m.error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-lg px-4 font-semibold text-primary underline underline-offset-4"
        >
          {m.retry}
        </button>
      </div>
    );
  if (loading)
    return (
      <p role="status" className="rounded-xl bg-canvas p-6 text-sm text-muted">
        {m.loading}
      </p>
    );
  if (empty) return <p className="rounded-xl bg-canvas p-6 text-sm text-muted">{m.noUnits}</p>;
  return null;
}
