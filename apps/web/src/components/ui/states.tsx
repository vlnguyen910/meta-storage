"use client";

import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { LOADING_MESSAGES } from "./loading.messages";

type LoadingVariant = "content" | "dashboard" | "table" | "detail" | "form";

type LoadingStateProps = {
  label?: string;
  variant?: LoadingVariant;
};

const DASHBOARD_METRIC_KEYS = ["revenue", "bookings", "capacity", "refunds"] as const;
const DASHBOARD_CHART_KEYS = ["primary-chart", "secondary-chart"] as const;
const TABLE_ROW_KEYS = ["row-1", "row-2", "row-3", "row-4", "row-5"] as const;
const FORM_FIELD_KEYS = ["field-1", "field-2", "field-3", "field-4"] as const;
const CONTENT_ROW_KEYS = ["content-1", "content-2", "content-3"] as const;

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200/75 ${className}`} />
  );
}

function LoadingSkeleton({ variant }: { variant: LoadingVariant }) {
  if (variant === "dashboard") {
    return (
      <div aria-hidden="true" className="grid w-full gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_METRIC_KEYS.map((key) => (
            <SkeletonBlock className="h-24" key={key} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {DASHBOARD_CHART_KEYS.map((key) => (
            <SkeletonBlock className="h-64" key={key} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div aria-hidden="true" className="grid w-full gap-3">
        <SkeletonBlock className="h-12" />
        {TABLE_ROW_KEYS.map((key) => (
          <SkeletonBlock className="h-14" key={key} />
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div aria-hidden="true" className="grid w-full gap-4">
        <SkeletonBlock className="h-12 w-2/3" />
        <SkeletonBlock className="h-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div aria-hidden="true" className="grid w-full gap-4">
        <SkeletonBlock className="h-10 w-2/3" />
        {FORM_FIELD_KEYS.map((key) => (
          <SkeletonBlock className="h-12" key={key} />
        ))}
        <SkeletonBlock className="h-11 w-36" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="grid w-full gap-3">
      <SkeletonBlock className="h-10 w-2/3" />
      <SkeletonBlock className="h-12" />
      {CONTENT_ROW_KEYS.map((key) => (
        <SkeletonBlock className="h-16" key={key} />
      ))}
    </div>
  );
}

export function LoadingState({
  label = LOADING_MESSAGES.data,
  variant = "content",
}: LoadingStateProps) {
  return (
    <div
      className="mx-auto my-6 flex w-full flex-col items-center gap-4 rounded-card border border-outline-variant bg-white p-5 text-center shadow-soft sm:p-6"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <LoadingSkeleton variant={variant} />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function FullScreenLoading({ label = LOADING_MESSAGES.page }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/25 p-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-6 py-4 text-sm font-semibold text-primary shadow-soft backdrop-blur-md">
        <LoaderCircle
          className="size-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function DelayedFullScreenLoading({
  label = LOADING_MESSAGES.page,
  delayMs = 150,
}: {
  label?: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs]);

  return visible ? <FullScreenLoading label={label} /> : null;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto my-8 flex min-h-[260px] w-full max-w-[620px] flex-col items-center justify-center rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
      <Inbox className="size-10 text-primary" />
      <h3 className="mt-3 mb-1 font-bold">{title}</h3>
      <p className="max-w-[460px] text-muted">{description}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
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
