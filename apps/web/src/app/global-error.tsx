"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { ERROR_BOUNDARY_MESSAGES } from "./error.messages";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled global error:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans antialiased">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle className="size-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{ERROR_BOUNDARY_MESSAGES.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{ERROR_BOUNDARY_MESSAGES.description}</p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-slate-400">
              {ERROR_BOUNDARY_MESSAGES.digestLabel}: {error.digest}
            </p>
          ) : null}
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition"
            >
              <RotateCcw className="size-4" />
              {ERROR_BOUNDARY_MESSAGES.retryAction}
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              {ERROR_BOUNDARY_MESSAGES.homeAction}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
