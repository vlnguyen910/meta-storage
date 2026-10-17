import { Archive, Building2, CalendarCheck2, LayoutDashboard } from "lucide-react";
import { customerRoutes } from "@/config/routes";
import type { NavigationItem } from "./types";

export const customerNavigation: NavigationItem[] = [
  { href: customerRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: customerRoutes.facilities, label: "Tìm kho", icon: Building2 },
  { href: customerRoutes.reservations, label: "Reservation", icon: CalendarCheck2 },
  { href: customerRoutes.rentals, label: "My Storage", icon: Archive },
];
