import { ADMIN_MESSAGES as M } from "@/features/administration/admin.messages";
import { AdminSummary } from "@/features/administration/admin-summary";

export function SystemAdministratorDashboardScreen() {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      <header className="shrink-0">
        <h1 className="m-0 font-['Space_Grotesk'] text-2xl font-bold tracking-tight sm:text-[28px]">
          {M.titles.dashboard}
        </h1>
        <p className="mb-0 mt-0.5 text-xs text-slate-500">{M.descriptions.dashboard}</p>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        <AdminSummary />
      </div>
    </div>
  );
}
