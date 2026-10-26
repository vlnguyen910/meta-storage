import { ClipboardCheck, ClipboardList, LayoutDashboard } from "lucide-react";
import { facilityStaffRoutes } from "@/config/routes";
import { FLOW } from "@/features/facility-flow/flow.messages";
import type { NavigationItem } from "./types";

export const facilityStaffNavigation: NavigationItem[] = [
  { href: facilityStaffRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: facilityStaffRoutes.checkIn, label: "Check-in booking", icon: ClipboardCheck },
  { href: facilityStaffRoutes.tasks, label: FLOW.staffWork, icon: ClipboardList },
];
