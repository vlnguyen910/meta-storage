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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDebts(false)}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-bold transition-all shadow-2xs cursor-pointer",
              !debts
                ? "bg-primary text-white hover:bg-primary-dark"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {M.work}
          </button>
          <button
            type="button"
            onClick={() => setDebts(true)}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-bold transition-all shadow-2xs cursor-pointer",
              debts
                ? "bg-primary text-white hover:bg-primary-dark"
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
