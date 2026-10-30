import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface OperationalHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}
export interface OperationalSectionProps {
  title: string;
  icon: LucideIcon;
  count?: number;
  description?: string;
  action?: ReactNode;
}
export interface OperationalBadgeProps {
  value: string;
  label?: string;
  tone?: "green" | "blue" | "amber" | "red" | "gray";
}
