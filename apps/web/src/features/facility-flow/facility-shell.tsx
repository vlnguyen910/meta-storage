"use client";
import { UserRole } from "@metastorage/contracts";
import {
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  User,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useState } from "react";
import { isMockMode } from "@/config/api-mode";
import { facilityManagerRoutes, facilityStaffRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { F5 } from "@/features/facility-management/management.messages";
import { NOTIFICATIONS } from "@/features/notifications/notifications.messages";
import { LifecycleInbox } from "@/features/returns/lifecycle-inbox";
import { RETURNS_MESSAGES as RETURNS } from "@/features/returns/returns.messages";
import { cn } from "@/lib/cn";
import { FLOW } from "./flow.messages";
import { flowFontClass } from "./flow-ui";
import { StaffTaskNotifications } from "./staff-task-notifications";

function FacilityShellContent({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.session?.user);
  const pathname = usePathname();
  const currentView = useSearchParams().get("view");
  const overview = currentView !== "tasks" && currentView !== "check-in";
  const assignment = useMyFacilityAssignments();
  const facility = assignment.data?.find((a) => a.isActive) ?? assignment.data?.[0];
  const root = user?.role === UserRole.FACILITY_MANAGER ? "/facility-manager" : "/staff";
  const role = user?.role === UserRole.FACILITY_MANAGER ? FLOW.manager : FLOW.staff;
  const isManager = user?.role === UserRole.FACILITY_MANAGER;
  const activeNavigationPath = pathname.endsWith("/dashboard")
    ? currentView === "staff"
      ? facilityManagerRoutes.staff
      : currentView === "check-in"
        ? facilityManagerRoutes.tasks
        : `${root}/dashboard?view=overview`
    : pathname;
  const isNavigationActive = (href: string) =>
    activeNavigationPath === href || activeNavigationPath.startsWith(`${href}/`);
  const navigation = [
    { label: FLOW.overview, href: `${root}/dashboard?view=overview`, icon: LayoutGrid },
    { label: FLOW.managerCoordination, href: facilityManagerRoutes.tasks, icon: ClipboardCheck },
    { label: FLOW.managerRentals, href: `${root}/rentals`, icon: UsersRound },
    { label: FLOW.managerSupport, href: `${root}/support`, icon: ClipboardList },
    { label: F5.inventory, href: facilityManagerRoutes.storageUnits, icon: DoorOpen },
    { label: F5.staffDirectory, href: facilityManagerRoutes.staff, icon: UsersRound },
  ];

  return (
    <div className={cn(flowFontClass, "min-h-screen bg-[#faf8ff]")}>
      {isManager && (
        <aside
          className={cn(
            isManager
              ? "fixed inset-y-0 left-0 z-50 flex w-60 flex-col justify-between border-r border-slate-200 bg-white text-ink transition-transform max-[900px]:-translate-x-full print:hidden"
              : "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between bg-[#003b2f] text-white transition-transform max-[900px]:-translate-x-full print:hidden",
            open && "max-[900px]:translate-x-0",
          )}
        >
          <div>
            <Link
              href={`${root}/dashboard`}
              className={cn(
                "flex h-16 items-center gap-2 border-b px-4",
                isManager ? "border-slate-200" : "border-white/10",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-lg",
                  isManager ? "bg-primary text-white" : "bg-[#125345]",
                )}
              >
                <Warehouse size={22} aria-hidden="true" />
              </span>
              <div>
                <strong
                  className={cn(
                    "block text-sm uppercase tracking-wider",
                    isManager && "text-primary",
                  )}
                >
                  {FLOW.brand}
                </strong>
                <span
                  className={cn(
                    "text-[11px] uppercase",
                    isManager ? "text-slate-500" : "text-[#89c5b3]",
                  )}
                >
                  {FLOW.subtitle}
                </span>
              </div>
            </Link>
            <div className="p-4">
              <div
                className={cn(
                  "rounded-xl p-3",
                  isManager ? "border border-slate-200 bg-primary-soft" : "bg-[#125345]",
                )}
              >
                <p
                  className={cn(
                    "text-[11px] font-semibold",
                    isManager ? "text-primary" : "text-[#b4efda]",
                  )}
                >
                  {FLOW.facility}
                </p>
                <p className={cn("mt-1 text-xs font-medium", isManager && "text-ink")}>
                  {facility?.facilityName ?? FLOW.noFacility}
                </p>
              </div>
            </div>
            <nav className="grid gap-1 px-4">
              <p
                className={cn(
                  "px-2 py-1 text-[11px] font-bold uppercase tracking-wider",
                  isManager ? "text-slate-500" : "text-[#bfc9c4]",
                )}
              >
                {FLOW.business}
              </p>
              {navigation.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isNavigationActive(href) ? "page" : undefined}
                  className={cn(
                    isManager
                      ? "flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-600 outline-offset-2 hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                      : "flex items-center gap-2 rounded px-2 py-2 text-sm text-[#bfc9c4] hover:bg-[#125345] hover:text-white",
                    isNavigationActive(href) &&
                      (isManager
                        ? "bg-primary text-white hover:bg-primary-dark hover:text-white"
                        : "bg-[#125345] font-semibold text-white"),
                  )}
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </Link>
              ))}
              <p
                className={cn(
                  "px-2 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider",
                  isManager ? "text-slate-500" : "text-[#bfc9c4]",
                )}
              >
                {FLOW.extension}
              </p>
              {[{ label: FLOW.history, icon: History }].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-2",
                    isManager ? "text-slate-600" : "text-[#bfc9c4]",
                  )}
                >
                  <Icon size={20} />
                  <div>
                    <span>{label}</span>
                    <span
                      className={cn(
                        "block text-[10px]",
                        isManager ? "text-slate-500" : "text-[#89c5b3]",
                      )}
                    >
                      {FLOW.unavailable}
                    </span>
                  </div>
                </div>
              ))}
            </nav>
          </div>
          <div className={cn("border-t p-4", isManager ? "border-slate-200" : "border-white/10")}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-2",
                isManager ? "bg-slate-50" : "bg-[#125345]",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full",
                  isManager ? "bg-primary-soft text-primary" : "bg-[#003b2f]",
                )}
              >
                <User size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs">{user?.name}</strong>
                <span
                  className={cn("text-[11px]", isManager ? "text-slate-500" : "text-[#89c5b3]")}
                >
                  {role}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label={FLOW.logout}
                className={cn(
                  "rounded-lg p-2",
                  isManager
                    ? "text-slate-600 hover:bg-primary-soft hover:text-primary"
                    : "hover:bg-[#003b2f]",
                )}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>
      )}
      {isManager && open && (
        <button
          type="button"
          aria-label={FLOW.closeMenu}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 min-[901px]:hidden"
        />
      )}
      <div className={cn(isManager ? "ml-60" : "ml-0", "max-[900px]:ml-0 print:ml-0")}>
        {isManager ? (
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-[#faf8ff]/90 px-4 shadow-sm backdrop-blur-xl print:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label={open ? FLOW.closeMenu : FLOW.openMenu}
                onClick={() => setOpen(!open)}
                className="rounded p-2 min-[901px]:hidden"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
              <Warehouse size={18} className="text-[#003b2f]" />
              <span className="hidden text-xs text-[#404945] sm:inline">{FLOW.operations}</span>
              <ChevronRight size={14} />
              <span className="truncate text-xs font-medium">
                {pathname.endsWith("/notifications")
                  ? NOTIFICATIONS.title
                  : pathname.endsWith("/rentals")
                    ? FLOW.managerRentals
                    : pathname.endsWith("/support")
                      ? FLOW.managerSupport
                      : pathname.endsWith("/reports")
                        ? FLOW.managerReports
                        : pathname.endsWith("/storage-units")
                          ? F5.inventory
                          : pathname.endsWith("/staff")
                            ? F5.staffDirectory
                            : pathname.endsWith("/tasks") ||
                                pathname.startsWith(`${facilityManagerRoutes.tasks}/`)
                              ? FLOW.managerCoordination
                              : pathname.endsWith("/dashboard")
                                ? overview
                                  ? FLOW.overview
                                  : FLOW.managerDispatch
                                : pathname.startsWith(`${root}/returns`)
                                  ? RETURNS.facilityReturnsCrumb
                                  : FLOW.monitor}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!isMockMode && <LifecycleInbox key={user?.id} />}
              <span className="grid size-8 place-items-center rounded-full bg-[#003b2f] text-white">
                <User size={18} />
              </span>
              <div className="hidden lg:block">
                <strong className="block text-[11px]">{user?.name}</strong>
                <span className="text-[11px] text-[#404945]">{role}</span>
              </div>
            </div>
          </header>
        ) : (
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl print:hidden sm:px-6">
            <div className="mx-auto flex max-w-[1504px] items-center gap-3">
              <Link href={facilityStaffRoutes.tasks} className="flex shrink-0 items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-primary text-white">
                  <Warehouse size={21} aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-sm uppercase tracking-wide text-primary">
                    {FLOW.brand}
                  </strong>
                  <span className="block text-[10px] uppercase text-slate-500">
                    {FLOW.subtitle}
                  </span>
                </span>
              </Link>
              <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
                {user?.role === UserRole.FACILITY_STAFF && <StaffTaskNotifications key={user.id} />}
                <div className="hidden min-w-0 text-right md:block">
                  <strong className="block truncate text-sm font-semibold text-slate-800">
                    {user?.name}
                  </strong>
                  <span className="block max-w-64 truncate text-xs text-slate-500">
                    {facility?.facilityName ?? FLOW.noFacility}
                  </span>
                </div>
                <span
                  className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary"
                  aria-hidden="true"
                >
                  <User size={18} />
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label={FLOW.logout}
                  title={FLOW.logout}
                  className="grid size-9 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <LogOut size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-[1504px] space-y-6 px-4 pb-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

export function FacilityShell(props: { children: ReactNode; onLogout: () => Promise<void> }) {
  return (
    <Suspense fallback={null}>
      <FacilityShellContent {...props} />
    </Suspense>
  );
}
