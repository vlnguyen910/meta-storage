"use client";

import { UserRole } from "@metastorage/database/schema/user-enums";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, RotateCcw, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { TooltipSimple } from "@/components/ui/tooltip";
import { isMockMode } from "@/config/api-mode";
import { navigationByRole } from "@/config/navigation";
import { roleHome, routes } from "@/config/routes";
import { CustomerAppointmentsRealtime } from "@/features/appointments/customer-appointments-realtime";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { useAuthStore } from "@/features/auth/auth-store";
import { FacilityShell } from "@/features/facility-flow/facility-shell";
import { LifecycleInbox } from "@/features/returns/lifecycle-inbox";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { resetMockDatabase } from "@/mocks/database";
import { APP_SHELL_MESSAGES as M } from "./app-shell.messages";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { runWithGlobalLoading, startNavigationLoading } = useGlobalLoading();

  useEffect(() => {
    if (pathname) setDrawerOpen(false);
  }, [pathname]);

  const role = session?.user.role;
  if (!session || !role) return null;

  const navigation = navigationByRole[role];

  async function logout() {
    try {
      await runWithGlobalLoading(async () => {
        await api.auth.logout();
        clearSession();
        queryClient.clear();
        startNavigationLoading();
        router.replace(routes.login);
      });
    } catch {
      showToast(AUTH_MESSAGES.logoutFailed, "error");
    }
  }

  function handleConfirmResetDemo() {
    setResetDialogOpen(false);
    resetMockDatabase();
    window.location.reload();
  }

  if (
    session.user.role === UserRole.FACILITY_MANAGER ||
    session.user.role === UserRole.FACILITY_STAFF
  ) {
    return <FacilityShell onLogout={logout}>{children}</FacilityShell>;
  }

  const isNoScroll =
    pathname === routes.customer.dashboard ||
    pathname === routes.customer.facilities ||
    pathname === routes.customer.rentals ||
    pathname === routes.customer.transactions ||
    pathname === routes.customer.support;

  const navigationList = (
    <nav aria-label="Điều hướng" className="grid gap-1">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== roleHome[role] && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setDrawerOpen(false)}
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

  const userFooter = (
    <div className="shrink-0 border-t border-slate-200 p-4">
      {isMockMode && (
        <button
          className="mb-2 flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          type="button"
          onClick={() => setResetDialogOpen(true)}
        >
          <RotateCcw size={16} />
          {M.resetDemoButton}
        </button>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary font-bold">
          {session.user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-slate-800">{session.user.name}</strong>
        </div>
        <TooltipSimple content={M.logout} side="right">
          <button
            type="button"
            onClick={logout}
            aria-label={M.logout}
            className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-primary-soft hover:text-primary disabled:opacity-50 cursor-pointer"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </TooltipSimple>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "min-h-screen bg-canvas text-ink",
        isNoScroll && "h-screen flex flex-col overflow-hidden min-h-0",
      )}
    >
      {role === UserRole.STORAGE_CUSTOMER && <CustomerAppointmentsRealtime />}
      <header className="sticky top-0 z-30 flex min-h-16 shrink-0 flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 lg:px-7">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg border border-slate-200 lg:hidden cursor-pointer"
          aria-label={M.openMenu}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link
          href={roleHome[role]}
          className="inline-flex min-h-11 items-center gap-2 font-bold text-primary"
        >
          <BrandLogo />
          <span>{AUTH_MESSAGES.brandName}</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {role === UserRole.STORAGE_CUSTOMER && !isMockMode && (
            <LifecycleInbox key={session.user.id} />
          )}
          <span className="grid size-8 place-items-center rounded-full bg-[#003b2f] text-white">
            <User size={18} aria-hidden="true" />
          </span>
          <div className="hidden border-l border-slate-200 pl-3 md:block">
            <strong className="block text-xs text-slate-800">{session.user.name}</strong>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 hidden w-60 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{navigationList}</div>
        {userFooter}
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="left-0 right-auto flex max-w-72 flex-col justify-between p-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 text-left font-bold text-primary">
                <BrandLogo />
                <span>{AUTH_MESSAGES.brandName}</span>
              </SheetTitle>
            </SheetHeader>
            {navigationList}
          </div>
          {userFooter}
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "min-w-0 lg:ml-60",
          isNoScroll && "flex-1 overflow-hidden min-h-0 flex flex-col",
        )}
      >
        <main
          className={cn(
            "mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:p-8",
            isNoScroll && "flex-1 overflow-hidden min-h-0 w-full p-4 sm:p-6 lg:p-6 flex flex-col",
          )}
        >
          {children}
        </main>
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{M.resetDemoTitle}</AlertDialogTitle>
            <AlertDialogDescription>{M.resetDemoDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                {M.cancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="danger" onClick={handleConfirmResetDemo}>
                {M.resetDemoConfirm}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
