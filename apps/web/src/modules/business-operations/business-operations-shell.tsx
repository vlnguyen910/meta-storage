"use client";

import { Globe2, LogOut, Menu, Warehouse, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { businessOperationsNavigation } from "@/config/navigation/business-operations.navigation";
import { businessOperationsRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { useLogout } from "@/features/auth/use-logout";
import { cn } from "@/lib/cn";
import { OPERATIONS_SHELL_MESSAGES as M } from "./operations.messages";
import type { BusinessOperationsShellProps } from "./operations.types";

export function BusinessOperationsShell({ children }: Readonly<BusinessOperationsShellProps>) {
  const pathname = usePathname();
  const logout = useLogout();
  const user = useAuthStore((state) => state.session?.user);
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pathname) drawer.current?.close();
  }, [pathname]);
  const navigation = (
    <nav aria-label={M.navigation} className="grid gap-1">
      {businessOperationsNavigation.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== businessOperationsRoutes.dashboard &&
            pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-600 outline-offset-2 hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
              active && "bg-primary text-white hover:bg-primary-dark hover:text-white",
            )}
          >
            <Icon size={19} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-screen bg-canvas text-ink [--radius-card:4px] [--color-outline-variant:#bfcac4]">
      <a
        href="#operations-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {M.skip}
      </a>
      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 lg:px-7">
        <button
          ref={trigger}
          type="button"
          className="grid size-11 place-items-center rounded-lg border border-slate-200 lg:hidden"
          aria-label={M.open}
          onClick={() => drawer.current?.showModal()}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link
          href={businessOperationsRoutes.dashboard}
          className="inline-flex min-h-11 items-center gap-2 font-bold text-primary"
        >
          <Warehouse size={25} aria-hidden="true" />
          {M.brand}
        </Link>
        <span className="hidden items-center gap-2 border-l border-slate-200 pl-5 text-sm font-semibold text-primary md:inline-flex">
          <Globe2 size={16} aria-hidden="true" />
          {M.global}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary sm:inline-block">
            {M.demo}
          </span>
          <div className="hidden border-l border-slate-200 pl-4 text-right md:block">
            <p className="m-0 text-sm font-semibold">{user?.name}</p>
            <p className="m-0 text-xs text-slate-600">{M.role}</p>
          </div>
          <button
            type="button"
            aria-label={M.logout}
            title={M.logout}
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <LogOut size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      {logout.isError && (
        <p role="alert" className="m-0 bg-red-50 p-3 text-center text-sm text-red-700">
          {M.logoutFailed}
        </p>
      )}
      <aside className="fixed bottom-0 left-0 top-16 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <p className="mb-5 mt-2 px-3 text-xs font-semibold text-slate-600">{M.role}</p>
        {navigation}
        <p className="mb-0 mt-auto border-t border-slate-200 px-3 pt-4 text-xs text-slate-600">
          {M.note}
        </p>
      </aside>
      <dialog
        ref={drawer}
        onClose={() => trigger.current?.focus()}
        aria-label={M.navigation}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-r border-slate-200 bg-white p-4 text-ink backdrop:bg-slate-950/40"
      >
        <div className="mb-5 flex items-center justify-between">
          <strong className="text-primary">{M.brand}</strong>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-slate-200"
            aria-label={M.close}
            onClick={() => drawer.current?.close()}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        {navigation}
      </dialog>
      <div className="min-w-0 lg:ml-60">
        <main id="operations-content" className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
