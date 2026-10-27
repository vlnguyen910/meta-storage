import { Archive, Building2, CreditCard, HelpCircle, LayoutDashboard } from "lucide-react";
import { customerRoutes } from "@/config/routes";
import type { NavigationItem } from "./types";

export const customerNavigation: NavigationItem[] = [
  { href: customerRoutes.dashboard, label: "Tổng quan", icon: LayoutDashboard },
  { href: customerRoutes.facilities, label: "Tìm kho", icon: Building2 },
  { href: customerRoutes.rentals, label: "Kho của tôi", icon: Archive },
  { href: customerRoutes.transactions, label: "Lịch sử giao dịch", icon: CreditCard },
  { href: customerRoutes.support, label: "Yêu cầu hỗ trợ", icon: HelpCircle },
];
