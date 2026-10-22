"use client";
import { F3 } from "@/features/returns/integration.messages";
import { SystemSettingFields } from "@/features/returns/system-setting-fields";

export function OperationsFeesView() {
  return (
    <div className="space-y-5">
      <p className="rounded border border-[#BFCAC4] bg-white p-4 text-sm text-slate-700">
        {F3.financeHelp}
      </p>
      <SystemSettingFields keys={["OVERDUE_FEE_RATE"]} />
    </div>
  );
}
