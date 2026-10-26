"use client";

import { LogOut, Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isMockMode } from "@/config/api-mode";
import { systemAdministratorNavigation } from "@/config/navigation/system-administrator.navigation";
import { systemAdministratorRoutes } from "@/config/routes";
import { ADMIN_MESSAGES as M } from "@/features/administration/admin.messages";
import type { AdminShellProps } from "@/features/administration/admin.types";
import { useAdminLogout } from "@/features/administration/use-admin-logout";
import { useAuthStore } from "@/features/auth/auth-store";
import { F5 } from "@/features/facility-management/management.messages";
import { F3 } from "@/features/returns/integration.messages";
import { cn } from "@/lib/cn";

export function SystemAdministratorShell({ children }: Readonly<AdminShellProps>) {
  const pathname = usePathname();
  const logout = useAdminLogout();
  const user = useAuthStore((state) => state.session?.user);
  const contextLabel = !isMockMode
    ? pathname === systemAdministratorRoutes.returnSettings
      ? F3.settings
      : pathname === systemAdministratorRoutes.facilityManagement ||
          pathname === systemAdministratorRoutes.facilityAssignments
        ? F5.title
        : null
    : null;
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pathname) drawer.current?.close();
  }, [pathname]);
  const navigation = (
    <nav aria-label={M.navigation} className="grid gap-1.5">
      {systemAdministratorNavigation.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 outline-offset-2 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary",
              active && "bg-primary text-white shadow-sm hover:bg-primary-dark",
            )}
          >
            <Icon size={19} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  const isFacilityManagement = pathname.startsWith("/system-admin/facility-management");

  return (
    <div
      className={cn(
        "min-h-screen bg-canvas text-ink [--radius-card:4px] [--color-outline-variant:#bfcac4]",
        isFacilityManagement && "h-screen flex flex-col overflow-hidden min-h-0",
      )}
    >
      <a
        href="#admin-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {M.skip}
      </a>
      <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center gap-3 border-b border-line bg-white/95 px-4 py-2 backdrop-blur-sm lg:ml-64 lg:px-8">
        <button
          ref={trigger}
          type="button"
          aria-label={M.openMenu}
          onClick={() => drawer.current?.showModal()}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-200 lg:hidden"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link
          href={systemAdministratorRoutes.dashboard}
          className="font-bold text-primary lg:hidden"
        >
          {M.brand}
        </Link>
        <nav aria-label={M.breadcrumb} className="hidden items-center gap-3 text-sm lg:flex">
          <Link
            href={systemAdministratorRoutes.dashboard}
            className="text-slate-500 hover:text-primary"
          >
            {M.role}
          </Link>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="font-semibold">
            {systemAdministratorNavigation.find((item) => item.href === pathname)?.label ?? M.role}
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {contextLabel && (
            <span className="hidden rounded-full bg-emerald-50 px-2 py-1.5 text-center text-xs font-semibold text-emerald-900 sm:inline-block">
              {contextLabel}
            </span>
          )}
          <div className="hidden border-l border-line pl-4 text-right md:block lg:hidden xl:block">
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
      <aside className="fixed bottom-0 left-0 top-0 hidden w-64 flex-col border-r border-line bg-white p-4 lg:flex">
        <Link
          href={systemAdministratorRoutes.dashboard}
          className="mb-8 flex items-center gap-3 px-2 pt-1"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
            <ShieldCheck size={23} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong className="block font-['Space_Grotesk'] text-lg leading-tight text-primary">
              {M.brand}
            </strong>
            <span className="block text-[10px] font-semibold tracking-wide text-slate-500">
              {M.role}
            </span>
          </span>
        </Link>
        {navigation}
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-line bg-canvas p-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
            {user?.name?.trim().slice(0, 1) ?? "A"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold">{user?.name ?? M.role}</p>
            <p className="m-0 truncate text-xs text-slate-500">{M.role}</p>
          </div>
        </div>
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
            aria-label={M.closeMenu}
            onClick={() => drawer.current?.close()}
            className="grid size-11 place-items-center rounded-lg border border-slate-200"
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        {navigation}
      </dialog>
      <div
        className={cn(
          "min-w-0 lg:ml-64",
          isFacilityManagement && "flex-1 overflow-hidden min-h-0 flex flex-col",
        )}
      >
        <main
          id="admin-content"
          className={cn(
            "mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:p-8",
            isFacilityManagement &&
              "flex-1 overflow-hidden min-h-0 w-full p-4 sm:p-6 lg:p-6 flex flex-col",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
