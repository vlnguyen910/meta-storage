import { Building2, History, LayoutDashboard, ListChecks, UsersRound } from "lucide-react";
import { systemAdministratorRoutes } from "@/config/routes";
import { ADMIN_MESSAGES as M } from "@/features/administration/admin.messages";
import type { NavigationItem } from "./types";

export const systemAdministratorNavigation: NavigationItem[] = [
  { href: systemAdministratorRoutes.dashboard, label: M.titles.dashboard, icon: LayoutDashboard },
  { href: systemAdministratorRoutes.users, label: M.titles.users, icon: UsersRound },
  {
    href: systemAdministratorRoutes.facilityAssignments,
    label: M.titles.assignments,
    icon: Building2,
  },
  { href: systemAdministratorRoutes.loginHistory, label: M.titles["login-history"], icon: History },
  {
    href: systemAdministratorRoutes.activityLogs,
    label: M.titles["activity-logs"],
    icon: ListChecks,
  },
];
