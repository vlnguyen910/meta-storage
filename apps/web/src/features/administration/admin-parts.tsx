"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { accessLabel } from "./admin.helpers";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import type {
  AdminBadgeProps,
  AdminDrawerProps,
  AdminSnapshotProps,
  AdminTableProps,
} from "./admin.types";

export const adminCard =
  "min-w-0 bg-surface-container-lowest border border-outline-variant rounded-card p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]";

export function AdminBadge({ label, warning }: Readonly<AdminBadgeProps>) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-semibold",
        warning ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900",
      )}
    >
      {label}
    </span>
  );
}

export function AdminTable({ title, headings, children }: Readonly<AdminTableProps>) {
  return (
    <section
      aria-label={title}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus the horizontally scrollable table.
      tabIndex={0}
      className="min-w-0 overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-card shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <table
        className={cn(
          "w-full border-collapse text-left text-sm [&_td]:px-5 [&_td]:py-4 [&_tr]:border-b [&_tr]:border-slate-100",
          headings.length > 3 && "min-w-[760px]",
        )}
      >
        <caption className="sr-only">{title}</caption>
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            {headings.map((heading) => (
              <th scope="col" className="px-5 py-4 font-semibold" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

export function AdminDrawer({ title, children, onClose }: Readonly<AdminDrawerProps>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[520px] max-w-full overflow-y-auto border-l border-slate-200 bg-white p-5 text-ink shadow-xl backdrop:bg-slate-950/40"
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <h2 className="m-0 text-xl font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={M.close}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function AdminSnapshotView({ title, snapshot, facilities }: Readonly<AdminSnapshotProps>) {
  return (
    <section className="rounded-card border border-outline-variant bg-slate-50 p-4">
      <h3 className="mt-0 text-sm font-bold">{title}</h3>
      <dl className="grid gap-2 text-sm">
        <dt className="text-slate-600">{M.roleFilter}</dt>
        <dd className="m-0">{ADMIN_ROLE_LABELS[snapshot.role]}</dd>
        <dt className="text-slate-600">{M.statusFilter}</dt>
        <dd className="m-0">{snapshot.status === "ACTIVE" ? M.active : M.inactive}</dd>
        <dt className="text-slate-600">{M.assignedFacilities}</dt>
        <dd className="m-0">{accessLabel(snapshot, facilities)}</dd>
      </dl>
    </section>
  );
}
