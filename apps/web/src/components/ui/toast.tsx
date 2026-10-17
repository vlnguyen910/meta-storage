"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { TOAST_MESSAGES } from "./toast.messages";
import type { ToastContextValue, ToastItem, ToastTone } from "./toast.types";

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-5 bottom-5 z-[100] grid gap-2.5" aria-live="polite">
        {items.map((item) => (
          <div
            className={cn(
              "grid w-[min(390px,calc(100vw-40px))] grid-cols-[22px_1fr_24px] items-center gap-2 rounded-xl border border-line border-l-4 border-l-accent bg-white p-3.5 shadow-card",
              item.tone === "error" && "border-l-danger",
            )}
            key={item.id}
          >
            {item.tone === "success" ? (
              <CheckCircle2 className="text-accent" />
            ) : (
              <CircleAlert className="text-danger" />
            )}
            <span>{item.message}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              className="cursor-pointer border-0 bg-transparent"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error(TOAST_MESSAGES.providerRequired);
  return context;
}
