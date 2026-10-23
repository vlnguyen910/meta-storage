import { ClipboardCheck, ClipboardList, LayoutDashboard } from "lucide-react";
import { facilityStaffRoutes } from "@/config/routes";
import { F5 } from "@/features/facility-management/management.messages";
import type { NavigationItem } from "./types";

export const facilityStaffNavigation: NavigationItem[] = [
  { href: facilityStaffRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: facilityStaffRoutes.checkIn, label: "Check-in booking", icon: ClipboardCheck },
  { href: facilityStaffRoutes.tasks, label: F5.tasks, icon: ClipboardList },
];
