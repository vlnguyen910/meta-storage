import {
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { facilityManagerRoutes } from "@/config/routes";
import { F5 } from "@/features/facility-management/management.messages";
import type { NavigationItem } from "./types";

export const facilityManagerNavigation: NavigationItem[] = [
  { href: facilityManagerRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: facilityManagerRoutes.checkIn, label: "Check-in booking", icon: ClipboardCheck },
  { href: facilityManagerRoutes.storageUnits, label: F5.inventory, icon: Warehouse },
  { href: facilityManagerRoutes.tasks, label: F5.tasks, icon: ClipboardList },
  { href: facilityManagerRoutes.staff, label: F5.staffDirectory, icon: UsersRound },
];
