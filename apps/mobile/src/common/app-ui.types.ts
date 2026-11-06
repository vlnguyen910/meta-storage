import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";

export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  inverse?: boolean;
}

export interface AppHeaderProps {
  onHome: () => void;
  onNotifications: () => void;
  onBack?: () => void;
}

export type CustomerTab = "home" | "rentals" | "profile";

export interface BottomTabsProps {
  selected: CustomerTab;
  onSelect: (key: CustomerTab) => void;
  labels?: Partial<Record<CustomerTab, string>>;
}

export interface SearchFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
  inverse?: boolean;
  trailing?: ReactNode;
}

export interface ActionLinkProps {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  warning?: boolean;
}
export interface SectionHeadingProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}
export interface ScreenFrameProps {
  children: ReactNode;
  className?: string;
}

export interface ListItemProps {
  label: string;
  description?: string;
  icon: LucideIcon;
  onPress: () => void;
}

export interface DetailSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}
export interface ChoiceTabsProps<T extends string> {
  readonly options: readonly { value: T; label: string; count?: number | string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
  readonly variant?: "pills" | "segmented";
}
