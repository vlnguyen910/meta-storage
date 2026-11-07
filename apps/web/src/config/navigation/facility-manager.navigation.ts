import { ClipboardList, LayoutDashboard, UsersRound, Warehouse } from "lucide-react";
import { facilityManagerRoutes } from "@/config/routes";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { F5 } from "@/features/facility-management/management.messages";
import type { NavigationItem } from "./types";

export const facilityManagerNavigation: NavigationItem[] = [
  { href: "/facility-manager/rentals", label: FLOW.managerRentals, icon: UsersRound },
  { href: "/facility-manager/support", label: FLOW.managerSupport, icon: ClipboardList },
  { href: facilityManagerRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: facilityManagerRoutes.storageUnits, label: F5.inventory, icon: Warehouse },
  { href: facilityManagerRoutes.tasks, label: FLOW.managerCoordination, icon: ClipboardList },
  { href: facilityManagerRoutes.staff, label: F5.staffDirectory, icon: UsersRound },
];
