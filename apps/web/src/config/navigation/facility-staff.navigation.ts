import { ClipboardList } from "lucide-react";
import { facilityStaffRoutes } from "@/config/routes";
import { FLOW } from "@/features/facility-flow/flow.messages";
import type { NavigationItem } from "./types";

export const facilityStaffNavigation: NavigationItem[] = [
  { href: facilityStaffRoutes.tasks, label: FLOW.staffWork, icon: ClipboardList },
];
