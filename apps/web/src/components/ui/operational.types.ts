import type { ReactNode } from "react";

export interface OperationalHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}
export interface OperationalBadgeProps {
  value: string;
  label?: string;
  tone?: "green" | "blue" | "amber" | "red" | "purple" | "gray";
}
