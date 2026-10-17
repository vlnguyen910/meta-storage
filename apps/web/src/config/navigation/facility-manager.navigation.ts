import { ClipboardCheck, LayoutDashboard } from "lucide-react";
import { facilityManagerRoutes } from "@/config/routes";
import type { NavigationItem } from "./types";

export const facilityManagerNavigation: NavigationItem[] = [
  { href: facilityManagerRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: facilityManagerRoutes.checkIn, label: "Check-in booking", icon: ClipboardCheck },
];
