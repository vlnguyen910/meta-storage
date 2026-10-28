export interface WorkspaceHeaderProps {
  onHome?: () => void;
  onNotifications?: () => void;
  name: string;
  subtitle: string;
  onBack?: () => void;
  onLogout: () => void;
}
export interface WorkspaceTab {
  key: string;
  label: string;
  icon: string;
}
export interface WorkspaceTabsProps {
  tabs: readonly WorkspaceTab[];
  selected: string;
  onSelect: (key: string) => void;
}
export interface StatusPillProps {
  label: string;
  tone?: "green" | "amber" | "blue" | "neutral" | "red";
}
