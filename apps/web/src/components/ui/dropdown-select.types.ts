import type { ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: ReactNode;
}

export interface DropdownSelectProps {
  id?: string;
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
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  ariaInvalid?: boolean | "true" | "false";
  ariaDescribedby?: string;
  placement?: "auto" | "top" | "bottom";
  align?: "start" | "end";
}
