"use client";

import { ArrowUpRight, Bell, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { NOTIFICATIONS as M } from "./notifications.messages";
import type { NotificationPopoverProps } from "./notifications.types";

export function NotificationPopover({ href, hasUpdates, children }: NotificationPopoverProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const id = useId();
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (pathname) close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={container} className="relative shrink-0 text-slate-900 [--color-muted:#475569]">
      <button
        ref={trigger}
        type="button"
        aria-label={M.open}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "relative grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          open
            ? "bg-primary-soft text-primary ring-1 ring-primary/10 hover:bg-primary-soft"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        )}
      >
        <Bell size={20} aria-hidden="true" fill={open ? "currentColor" : "none"} />
        {hasUpdates && (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-primary"
          />
        )}
      </button>
      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Delegate native child links, which also emit clicks on keyboard activation.
        <div
          id={id}
          role="dialog"
          aria-labelledby={`${id}-title`}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a[href]")) close();
          }}
          className="absolute right-0 top-[calc(100%+0.75rem)] z-[60] flex max-h-[min(38rem,calc(100dvh-6.5rem))] w-[25rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_48px_rgba(15,23,42,0.18)] max-[560px]:fixed max-[560px]:left-3 max-[560px]:right-3 max-[560px]:top-20 max-[560px]:w-auto"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
            <div>
              <h2 id={`${id}-title`} className="m-0 text-xl font-extrabold tracking-tight">
                {M.title}
              </h2>
              <p className="m-0 mt-1 text-xs text-slate-500">{M.previewLimit}</p>
            </div>
            <button
              ref={closeButton}
              type="button"
              aria-label={M.close}
              onClick={() => close(true)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="shrink-0 px-5 pb-3">
            <span className="inline-flex rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary">
              {M.latest}
            </span>
          </div>
          <section
            aria-label={M.list}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the notification list.
            tabIndex={0}
            className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary [scrollbar-gutter:stable]"
          >
            {children(open)}
          </section>
          <Link
            href={href}
            onClick={() => close()}
            className="flex min-h-14 shrink-0 items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 text-sm font-bold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary"
          >
            {M.viewAll}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
