import { BarChart3, Building2, Coins, LayoutDashboard, Settings2, ShieldCheck } from "lucide-react";
import { businessOperationsRoutes } from "@/config/routes";
import { OPERATIONS_MESSAGES as M } from "@/features/operations/operations.messages";
import type { NavigationItem } from "./types";

export const businessOperationsNavigation: NavigationItem[] = [
  {
    href: businessOperationsRoutes.dashboard,
    label: M.navigation.dashboard,
    icon: LayoutDashboard,
  },
  { href: businessOperationsRoutes.facilities, label: M.navigation.facilities, icon: Building2 },
  { href: businessOperationsRoutes.pricing, label: M.navigation.pricing, icon: Coins },
  { href: businessOperationsRoutes.fees, label: M.navigation.fees, icon: Settings2 },
  { href: businessOperationsRoutes.rules, label: M.navigation.rules, icon: ShieldCheck },
  { href: businessOperationsRoutes.reports, label: M.navigation.reports, icon: BarChart3 },
];
