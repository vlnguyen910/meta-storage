"use client";

import { AlertTriangle, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { LOADING_MESSAGES } from "./loading.messages";
import type {
  DelayedFullScreenLoadingProps,
  EmptyStateProps,
  ErrorStateProps,
  FullScreenLoadingProps,
  LoadingStateProps,
  LoadingVariant,
} from "./states.types";

export type {
  DelayedFullScreenLoadingProps,
  EmptyStateProps,
  ErrorStateProps,
  FullScreenLoadingProps,
  LoadingStateProps,
  LoadingVariant,
} from "./states.types";

const DASHBOARD_METRIC_KEYS = ["revenue", "bookings", "capacity", "refunds"] as const;
const DASHBOARD_CHART_KEYS = ["primary-chart", "secondary-chart"] as const;
const TABLE_ROW_KEYS = ["row-1", "row-2", "row-3", "row-4", "row-5"] as const;
const FORM_FIELD_KEYS = ["field-1", "field-2", "field-3", "field-4"] as const;
const CONTENT_ROW_KEYS = ["content-1", "content-2", "content-3"] as const;

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-lg bg-slate-200/70",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent",
        className,
      )}
    />
  );
}

function LoadingSkeleton({ variant }: { variant: LoadingVariant }) {
  if (variant === "dashboard") {
    return (
      <div aria-hidden="true" className="grid w-full gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_METRIC_KEYS.map((key) => (
            <div
              key={key}
              className="flex flex-col justify-between rounded-card border border-outline-variant/70 bg-white p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-3.5 w-24" />
                <SkeletonBlock className="size-9 rounded-xl" />
              </div>
              <div className="mt-4 space-y-2">
                <SkeletonBlock className="h-7 w-28" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {DASHBOARD_CHART_KEYS.map((key) => (
            <div
              key={key}
              className="flex flex-col rounded-card border border-outline-variant/70 bg-white p-6 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-line/80 pb-4">
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="h-3 w-48" />
                </div>
                <SkeletonBlock className="h-8 w-24 rounded-lg" />
              </div>
              <div className="mt-6 flex h-52 items-end justify-between gap-3 pt-4">
                <SkeletonBlock className="h-[45%] w-full rounded-t-md" />
                <SkeletonBlock className="h-[75%] w-full rounded-t-md" />
                <SkeletonBlock className="h-[90%] w-full rounded-t-md" />
                <SkeletonBlock className="h-[60%] w-full rounded-t-md" />
                <SkeletonBlock className="h-[80%] w-full rounded-t-md" />
                <SkeletonBlock className="h-[95%] w-full rounded-t-md" />
                <SkeletonBlock className="h-[65%] w-full rounded-t-md" />
              </div>
              <div className="mt-3 border-t border-line/60 pt-3">
                <SkeletonBlock className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div
        aria-hidden="true"
        className="w-full overflow-hidden rounded-card border border-outline-variant/70 bg-white shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/60 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-6">
            <SkeletonBlock className="size-4 rounded" />
            <SkeletonBlock className="h-3.5 w-24" />
            <SkeletonBlock className="hidden h-3.5 w-32 sm:block" />
            <SkeletonBlock className="hidden h-3.5 w-20 md:block" />
          </div>
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
        </div>
        <div className="divide-y divide-outline-variant/40">
          {TABLE_ROW_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SkeletonBlock className="size-8 rounded-lg" />
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <SkeletonBlock className="h-6 w-20 rounded-full" />
                <SkeletonBlock className="size-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div
        aria-hidden="true"
        className="w-full space-y-5 rounded-card border border-outline-variant/70 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="size-14 rounded-2xl" />
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-3.5 w-28" />
            </div>
          </div>
          <SkeletonBlock className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonBlock className="h-24 rounded-xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
        </div>
        <div className="space-y-3 pt-2">
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div
        aria-hidden="true"
        className="w-full space-y-5 rounded-card border border-outline-variant/70 bg-white p-6 shadow-xs"
      >
        <div className="space-y-2 border-b border-line pb-4">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-3.5 w-72" />
        </div>
        <div className="grid gap-4">
          {FORM_FIELD_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="pt-2">
          <SkeletonBlock className="h-11 w-36 rounded-xl bg-primary/20" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-full space-y-4 rounded-card border border-outline-variant/70 bg-white p-6 shadow-xs"
    >
      <SkeletonBlock className="h-6 w-1/2" />
      <SkeletonBlock className="h-4 w-3/4" />
      <div className="space-y-2.5 pt-2">
        {CONTENT_ROW_KEYS.map((key) => (
          <SkeletonBlock className="h-14 w-full rounded-xl" key={key} />
        ))}
      </div>
    </div>
  );
}

export function LoadingState({
  label = LOADING_MESSAGES.data,
  variant = "content",
}: LoadingStateProps) {
  return (
    <div
      className="mx-auto my-6 flex w-full flex-col items-center gap-4 text-center"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <LoadingSkeleton variant={variant} />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function FullScreenLoading({ label = LOADING_MESSAGES.page }: FullScreenLoadingProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/30 p-6 backdrop-blur-md transition-all duration-300"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative flex flex-col items-center justify-center gap-4 rounded-[24px] border border-white/80 bg-white/95 px-8 py-7 text-center shadow-[0_20px_50px_rgba(22,95,77,0.12),0_10px_25px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-black/5 min-w-[270px] max-w-xs transition-all duration-300">
        {/* Soft background ambient aura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 -left-8 size-28 rounded-full bg-emerald-400/20 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -right-8 size-28 rounded-full bg-teal-500/15 blur-2xl"
        />

        {/* Branded dual-ring spinner with glowing core */}
        <div className="relative flex size-14 items-center justify-center" aria-hidden="true">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-[2.5px] border-emerald-500/15 border-t-primary border-r-primary animate-spin" />
          {/* Inner counter-rotating ring */}
          <div className="absolute inset-2 rounded-full border-2 border-teal-500/20 border-b-emerald-600 animate-spin-reverse" />
          {/* Center glowing brand core */}
          <div className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse-subtle shadow-xs">
            <div className="size-1.5 rounded-full bg-primary" />
          </div>
        </div>

        {/* Text label with micro-progress line */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-slate-800">{label}</span>
          <div
            aria-hidden="true"
            className="relative h-1 w-24 overflow-hidden rounded-full bg-slate-100"
          >
            <div className="h-full w-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-teal-400 animate-progress-indeterminate" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DelayedFullScreenLoading({
  label = LOADING_MESSAGES.page,
  delayMs = 150,
}: DelayedFullScreenLoadingProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs]);

  return visible ? <FullScreenLoading label={label} /> : null;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="mx-auto my-8 flex min-h-[260px] w-full max-w-[620px] flex-col items-center justify-center rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
      <Inbox className="size-10 text-primary" />
      <h3 className="mt-3 mb-1 font-bold">{title}</h3>
      <p className="max-w-[460px] text-muted">{description}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="mx-auto my-8 flex min-h-[260px] w-full max-w-[620px] flex-col items-center justify-center rounded-card border border-dashed border-slate-300 bg-white p-10 text-center"
      role="alert"
    >
      <AlertTriangle className="size-10 text-danger" />
      <h3 className="mt-3 mb-1 font-bold">Không thể tải dữ liệu</h3>
      <p className="max-w-[460px] text-muted">{message}</p>
      {onRetry ? <Button onClick={onRetry}>Thử lại</Button> : null}
    </div>
  );
}
