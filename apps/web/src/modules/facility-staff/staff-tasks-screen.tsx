"use client";
import { Suspense, useState } from "react";
import { LoadingState } from "@/components/ui/states";
import { DebtPanel } from "@/features/rentals/debt-panel";
import { DEBT_MESSAGES as M } from "@/features/rentals/debts.messages";
import { cn } from "@/lib/utils";
import { StaffWorkList } from "./staff-work-list";

export function StaffTasksScreen() {
  const [debts, setDebts] = useState(false);
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDebts(false)}
            aria-pressed={!debts}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              !debts
                ? "bg-primary text-white hover:bg-primary hover:text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {M.work}
          </button>
          <button
            type="button"
            onClick={() => setDebts(true)}
            aria-pressed={debts}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              debts
                ? "bg-primary text-white hover:bg-primary hover:text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {M.title}
          </button>
        </div>
        {debts ? <DebtPanel /> : <StaffWorkList />}
      </div>
    </Suspense>
  );
}
