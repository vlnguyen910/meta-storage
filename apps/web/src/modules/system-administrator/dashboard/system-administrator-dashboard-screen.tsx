import { ADMIN_MESSAGES as M } from "@/features/administration/admin.messages";
import { AdminSummary } from "@/features/administration/admin-summary";

export function SystemAdministratorDashboardScreen() {
  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <h1 className="m-0 font-['Space_Grotesk'] text-2xl font-bold tracking-tight sm:text-[32px]">
          {M.titles.dashboard}
        </h1>
        <p className="mb-0 mt-1 text-sm leading-6 text-slate-600">{M.descriptions.dashboard}</p>
      </header>
      <AdminSummary />
    </div>
  );
}
