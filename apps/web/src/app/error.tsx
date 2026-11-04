"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ERROR_BOUNDARY_MESSAGES } from "./error.messages";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-sm border border-rose-100">
        <AlertTriangle className="size-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {ERROR_BOUNDARY_MESSAGES.title}
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">{ERROR_BOUNDARY_MESSAGES.description}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-400">
          {ERROR_BOUNDARY_MESSAGES.digestLabel}: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" onClick={reset} icon={<RotateCcw className="size-4" />}>
          {ERROR_BOUNDARY_MESSAGES.retryAction}
        </Button>
        <Link href="/">
          <Button variant="outline" icon={<Home className="size-4" />}>
            {ERROR_BOUNDARY_MESSAGES.homeAction}
          </Button>
        </Link>
      </div>
    </div>
  );
}
