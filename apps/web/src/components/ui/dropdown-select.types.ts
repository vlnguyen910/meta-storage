import type { ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: ReactNode;
}

export interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  icon?: ReactNode;
  maxVisibleItems?: number;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  placement?: "auto" | "top" | "bottom";
}
