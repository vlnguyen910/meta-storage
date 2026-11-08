"use client";

import { Globe2, LogOut, Menu, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipSimple } from "@/components/ui/tooltip";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (pathname) setDrawerOpen(false);
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
  const isOperationsNoScroll = pathname.startsWith("/operations");

  const userFooter = (
    <div className="shrink-0 border-t border-slate-200 p-4">
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <User size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-slate-800">{user?.name}</strong>
          <span className="block truncate text-[11px] text-slate-500">{M.role}</span>
        </div>
        <TooltipSimple content={M.logout} side="right">
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
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
        "min-h-screen bg-canvas text-ink [--radius-card:4px] [--color-outline-variant:#bfcac4]",
        isOperationsNoScroll && "h-screen flex flex-col overflow-hidden min-h-0",
      )}
    >
      <a
        href="#operations-content"
        className="sr-only z-50 rounded-lg bg-white p-3 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {M.skip}
      </a>
      <header className="sticky top-0 z-30 flex min-h-16 shrink-0 flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 lg:px-7">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg border border-slate-200 lg:hidden cursor-pointer"
          aria-label={M.open}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link
          href={businessOperationsRoutes.dashboard}
          className="inline-flex min-h-11 items-center gap-2 font-bold text-primary"
        >
          <BrandLogo />
          {M.brand}
        </Link>
        <span className="hidden items-center gap-2 border-l border-slate-200 pl-5 text-sm font-semibold text-primary md:inline-flex">
          <Globe2 size={16} aria-hidden="true" />
          {M.global}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-[#003b2f] text-white">
            <User size={18} aria-hidden="true" />
          </span>
          <div className="hidden border-l border-slate-200 pl-3 md:block">
            <strong className="block text-[11px] text-slate-800">{user?.name}</strong>
            <span className="block text-[11px] text-slate-500">{M.role}</span>
          </div>
        </div>
      </header>
      {logout.isError && (
        <p role="alert" className="m-0 bg-red-50 p-3 text-center text-sm text-red-700">
          {M.logoutFailed}
        </p>
      )}
      <aside className="fixed bottom-0 left-0 top-16 hidden w-60 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 mt-1 px-3 text-xs font-semibold text-slate-500">{M.role}</p>
          {navigation}
        </div>
        {userFooter}
      </aside>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="left-0 right-auto flex max-w-72 flex-col justify-between p-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 text-left font-bold text-primary">
                <BrandLogo />
                {M.brand}
              </SheetTitle>
            </SheetHeader>
            <p className="mb-3 px-3 text-xs font-semibold text-slate-500">{M.role}</p>
            {navigation}
          </div>
          {userFooter}
        </SheetContent>
      </Sheet>
      <div
        className={cn(
          "min-w-0 lg:ml-60",
          isOperationsNoScroll && "flex-1 overflow-hidden min-h-0 flex flex-col",
        )}
      >
        <main
          id="operations-content"
          className={cn(
            "mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:p-8",
            isOperationsNoScroll &&
              "flex-1 overflow-hidden min-h-0 w-full p-4 sm:p-6 lg:p-6 flex flex-col",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
