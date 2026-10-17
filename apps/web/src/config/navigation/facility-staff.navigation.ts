import { ClipboardCheck, LayoutDashboard } from "lucide-react";
import { facilityStaffRoutes } from "@/config/routes";
import type { NavigationItem } from "./types";

export const facilityStaffNavigation: NavigationItem[] = [
  { href: facilityStaffRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: facilityStaffRoutes.checkIn, label: "Check-in booking", icon: ClipboardCheck },
];
