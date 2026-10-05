"use client";
import { UserRole } from "@metastorage/contracts";
import {
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  User,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useState } from "react";
import { useAuthStore } from "@/features/auth/auth-store";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { cn } from "@/lib/cn";
import { FLOW } from "./flow.messages";
import { flowFontClass } from "./flow-ui";

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
  const overview = useSearchParams().get("view") === "overview";
  const assignment = useMyFacilityAssignments();
  const facility = assignment.data?.find((a) => a.isActive) ?? assignment.data?.[0];
  const root = user?.role === UserRole.FACILITY_MANAGER ? "/facility-manager" : "/staff";
  const role = user?.role === UserRole.FACILITY_MANAGER ? FLOW.manager : FLOW.staff;
  const isManager = user?.role === UserRole.FACILITY_MANAGER;
  const navigation = [
    { label: FLOW.overview, href: `${root}/dashboard?view=overview`, icon: LayoutGrid },
    {
      label: isManager ? FLOW.managerDispatch : FLOW.staffTasks,
      href: `${root}/dashboard`,
      icon: ClipboardCheck,
    },
    ...(!isManager
      ? [{ label: FLOW.inspection, href: `${root}/check-in`, icon: ClipboardCheck }]
      : []),
  ];
  return (
    <div className={cn(flowFontClass, "min-h-screen bg-[#faf8ff]")}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between bg-[#003b2f] text-white transition-transform max-[900px]:-translate-x-full print:hidden",
          open && "max-[900px]:translate-x-0",
        )}
      >
        <div>
          <Link
            href={`${root}/dashboard`}
            className="flex h-16 items-center gap-2 border-b border-white/10 px-4"
          >
            <span className="grid size-9 place-items-center rounded bg-[#125345]">
              <Warehouse size={22} />
            </span>
            <div>
              <strong className="block text-sm uppercase tracking-wider">{FLOW.brand}</strong>
              <span className="text-[11px] uppercase text-[#89c5b3]">{FLOW.subtitle}</span>
            </div>
          </Link>
          <div className="p-4">
            <div className="rounded bg-[#125345] p-3">
              <p className="text-[11px] font-semibold text-[#b4efda]">{FLOW.facility}</p>
              <p className="mt-1 text-xs font-medium">
                {facility?.facilityName ?? FLOW.noFacility}
              </p>
            </div>
          </div>
          <nav className="grid gap-1 px-4">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#bfc9c4]">
              {FLOW.business}
            </p>
            {navigation.map(({ label, href, icon: Icon }, i) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-2 text-sm text-[#bfc9c4] hover:bg-[#125345] hover:text-white",
                  ((i === 0 && pathname.endsWith("/dashboard") && overview) ||
                    (i === 1 && pathname.endsWith("/dashboard") && !overview) ||
                    (i === 2 && pathname.endsWith("/check-in"))) &&
                    "bg-[#125345] font-semibold text-white",
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
            <p className="px-2 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-[#bfc9c4]">
              {FLOW.extension}
            </p>
            {[
              { label: FLOW.units, icon: DoorOpen },
              { label: FLOW.history, icon: History },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 rounded px-2 py-2 text-[#bfc9c4]">
                <Icon size={20} />
                <div>
                  <span>{label}</span>
                  <span className="block text-[10px] text-[#89c5b3]">{FLOW.unavailable}</span>
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded bg-[#125345] p-2">
            <span className="grid size-8 place-items-center rounded-full bg-[#003b2f]">
              <User size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-xs">{user?.name}</strong>
              <span className="text-[11px] text-[#89c5b3]">{role}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label={FLOW.logout}
              className="rounded p-2 hover:bg-[#003b2f]"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          type="button"
          aria-label={FLOW.closeMenu}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 min-[901px]:hidden"
        />
      )}
      <div className="ml-72 max-[900px]:ml-0 print:ml-0">
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
              {pathname.endsWith("/dashboard")
                ? overview
                  ? FLOW.overview
                  : isManager
                    ? FLOW.managerDispatch
                    : FLOW.staffTasks
                : isManager
                  ? FLOW.monitor
                  : FLOW.inspection}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-[#003b2f] text-white">
              <User size={18} />
            </span>
            <div className="hidden lg:block">
              <strong className="block text-[11px]">{user?.name}</strong>
              <span className="text-[11px] text-[#404945]">{role}</span>
            </div>
          </div>
        </header>
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
