"use client";

import { UserRole } from "@metastorage/contracts";
import { APP_NAME } from "@metastorage/shared";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, RotateCcw, Warehouse, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import { useToast } from "@/components/ui/toast";
import { isMockMode } from "@/config/api-mode";
import { navigationByRole } from "@/config/navigation";
import { roleHome, routes } from "@/config/routes";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { useAuthStore } from "@/features/auth/auth-store";
import { FacilityShell } from "@/features/facility-flow/facility-shell";
import { LifecycleInbox } from "@/features/returns/lifecycle-inbox";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { resetMockDatabase } from "@/mocks/database";

const roleLabels: Record<UserRole, string> = {
  [UserRole.STORAGE_CUSTOMER]: "Khách thuê kho",
  [UserRole.FACILITY_STAFF]: "Nhân viên cơ sở",
  [UserRole.FACILITY_MANAGER]: "Quản lý cơ sở",
  [UserRole.BUSINESS_OPERATIONS_MANAGER]: "Quản lý vận hành",
  [UserRole.SYSTEM_ADMINISTRATOR]: "Quản trị hệ thống",
};

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { runWithGlobalLoading, startNavigationLoading } = useGlobalLoading();
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

  function resetDemo() {
    if (window.confirm("Khôi phục toàn bộ dữ liệu demo về trạng thái ban đầu?")) {
      resetMockDatabase();
      window.location.reload();
    }
  }

  if (
    session.user.role === UserRole.FACILITY_MANAGER ||
    session.user.role === UserRole.FACILITY_STAFF
  ) {
    return <FacilityShell onLogout={logout}>{children}</FacilityShell>;
  }

  const isNoScroll = pathname.startsWith("/customer");

  return (
    <div
      className={cn("min-h-screen", isNoScroll && "h-screen flex flex-col overflow-hidden min-h-0")}
    >
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#113e33] p-4 text-[#dcece7] transition-transform duration-200 max-[800px]:-translate-x-[105%]",
          open && "max-[800px]:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Link
            href={roleHome[role]}
            className="inline-flex items-center gap-2.5 text-[1.35rem] font-extrabold tracking-[-0.04em] text-white"
          >
            <span className="grid size-[38px] place-items-center rounded-[11px] bg-primary text-white">
              <Warehouse size={22} />
            </span>
            <span>{APP_NAME}</span>
          </Link>
          <button
            type="button"
            className="hidden cursor-pointer border-0 bg-transparent p-2 text-inherit max-[800px]:block"
            onClick={() => setOpen(false)}
            aria-label="Đóng menu"
          >
            <X />
          </button>
        </div>
        <div className="my-6 flex items-center gap-3 rounded-[13px] bg-white/[0.07] p-3">
          <span className="grid size-10 place-items-center rounded-full bg-white font-extrabold text-primary">
            {session.user.name.slice(0, 1)}
          </span>
          <div>
            <strong className="block text-sm text-white">{session.user.name}</strong>
            <small className="mt-1 block text-[0.7rem] text-[#a9c8c0]">{roleLabels[role]}</small>
          </div>
        </div>
        <nav className="grid gap-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== roleHome[role] && pathname.startsWith(item.href));
            return (
              <Link
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 text-sm font-semibold text-[#bad2cc] hover:bg-white/10 hover:text-white",
                  active && "bg-white/10 text-white shadow-[inset_3px_0_#a7dbcd]",
                )}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-1">
          {isMockMode ? (
            <button
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 text-sm font-semibold text-[#bad2cc] hover:bg-white/10 hover:text-white"
              type="button"
              onClick={resetDemo}
            >
              <RotateCcw size={18} />
              Khôi phục dữ liệu demo
            </button>
          ) : null}
          <button
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 text-sm font-semibold text-[#bad2cc] hover:bg-white/10 hover:text-white"
            type="button"
            onClick={logout}
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 hidden cursor-pointer border-0 bg-slate-900/55 max-[800px]:block"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
        />
      ) : null}
      <div
        className={cn(
          "ml-[272px] min-h-screen max-[800px]:ml-0",
          isNoScroll && "flex-1 overflow-hidden min-h-0 flex flex-col",
        )}
      >
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-line bg-white px-8 max-[800px]:px-[18px]">
          <button
            type="button"
            className="hidden cursor-pointer border-0 bg-transparent p-2 text-inherit max-[800px]:grid max-[800px]:place-items-center"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu />
          </button>
          <div className="flex gap-1">
            <span className="text-muted">Xin chào,</span>
            <strong>{session.user.name}</strong>
          </div>
          <span className="ml-auto rounded-full bg-primary-soft px-3 py-2 text-xs font-bold text-primary max-[560px]:hidden">
            {roleLabels[role]}
          </span>
          {role === UserRole.STORAGE_CUSTOMER && !isMockMode && (
            <div className="ml-auto sm:ml-0">
              <LifecycleInbox key={session.user.id} />
            </div>
          )}
        </header>
        <main
          className={cn(
            "mx-auto max-w-[1440px] p-9 max-[800px]:p-[25px_18px] max-[560px]:px-3.5",
            isNoScroll && "flex-1 overflow-hidden min-h-0 w-full p-4 sm:p-6 lg:p-6 flex flex-col",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
