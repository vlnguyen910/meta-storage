import type { LucideIcon } from "lucide-react-native";

export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
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
}

export interface ListItemProps {
  label: string;
  description?: string;
  icon: LucideIcon;
  onPress: () => void;
}
