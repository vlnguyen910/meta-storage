"use client";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { DebtPanel } from "@/features/rentals/debt-panel";
import { DEBT_MESSAGES as M } from "@/features/rentals/debts.messages";
import { StaffWorkList } from "./staff-work-list";
export function StaffTasksScreen() {
  const [debts, setDebts] = useState(false);
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant={debts ? "outline" : "primary"} onClick={() => setDebts(false)}>
            {M.work}
          </Button>
          <Button variant={debts ? "primary" : "outline"} onClick={() => setDebts(true)}>
            {M.title}
          </Button>
        </div>
        {debts ? <DebtPanel /> : <StaffWorkList />}
      </div>
    </Suspense>
  );
}
