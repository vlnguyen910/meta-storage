"use client";

import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./button";

export function LoadingState({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div
      className="mx-auto my-8 flex min-h-[260px] w-full max-w-[620px] flex-col items-center justify-center rounded-card border border-dashed border-slate-300 bg-white p-10 text-center"
      role="status"
    >
      <LoaderCircle className="size-10 animate-spin text-primary" />
      <p className="text-muted">{label}</p>
    </div>
  );
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
