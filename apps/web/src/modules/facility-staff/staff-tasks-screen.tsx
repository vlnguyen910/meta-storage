"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { DebtPanel } from "@/features/rentals/debt-panel";
import { DEBT_MESSAGES as M } from "@/features/rentals/debts.messages";
import { cn } from "@/lib/utils";
import { StaffWorkList } from "./staff-work-list";

export function StaffTasksScreen() {
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <StaffTasksContent />
    </Suspense>
  );
}

function StaffTasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const isDebts = currentTab === "debts";

  function handleTabChange(nextTab: "work" | "debts") {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "debts") {
      params.set("tab", "debts");
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleTabChange("work")}
          aria-pressed={!isDebts}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            !isDebts
              ? "bg-primary text-white hover:bg-primary hover:text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
          )}
        >
          {M.work}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("debts")}
          aria-pressed={isDebts}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            isDebts
              ? "bg-primary text-white hover:bg-primary hover:text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
          )}
        >
          {M.title}
        </button>
      </div>
      {isDebts ? <DebtPanel /> : <StaffWorkList />}
    </div>
  );
}
