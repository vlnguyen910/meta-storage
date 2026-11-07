import {
  ArrowLeft,
  Bell,
  CircleHelp,
  ClipboardList,
  House,
  LogOut,
  type LucideIcon,
  ReceiptText,
  Search,
  Warehouse,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type {
  StatusPillProps,
  WorkspaceHeaderProps,
  WorkspaceTabsProps,
} from "../../common/workspace-ui.types";
import { Icon } from "./icon";
import { WORKSPACE_UI as M } from "./workspace-ui.messages";

const tabIcons: Record<string, LucideIcon> = {
  "⌂": House,
  "⌕": Search,
  "▦": Warehouse,
  "▤": ReceiptText,
  "?": CircleHelp,
};

export function WorkspaceHeader({
  name,
  subtitle,
  onBack,
  onLogout,
  onHome,
  onNotifications,
}: WorkspaceHeaderProps) {
  return (
    <View className="border-b border-line bg-surface px-4 py-3">
      <View className="mx-auto w-full max-w-3xl flex-row items-center gap-3">
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.back}
            onPress={onBack}
            className="min-h-touch min-w-touch items-center justify-center rounded-control bg-canvas active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-ring"
          >
            <Icon as={ArrowLeft} className="text-primary" />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole={onHome ? "button" : undefined}
            accessibilityLabel={M.home}
            onPress={onHome}
            className="min-h-touch min-w-touch items-center justify-center rounded-control bg-primary active:bg-primary-dark web:focus-visible:outline-2 web:focus-visible:outline-ring"
          >
            <Icon as={Warehouse} className="text-primary-foreground" />
          </Pressable>
        )}
        <View className="min-w-0 flex-1">
          <Text className="font-body-bold text-[10px] tracking-widest text-primary">{M.brand}</Text>
          <Text numberOfLines={1} className="mt-0.5 font-body-bold text-body text-ink">
            {name}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 font-body text-[12px] text-muted">
            {subtitle}
          </Text>
        </View>
        {onNotifications && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.notifications}
            onPress={onNotifications}
            className="min-h-touch min-w-touch items-center justify-center rounded-full bg-canvas active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-ring"
          >
            <Icon as={Bell} className="text-primary" />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.logout}
          onPress={onLogout}
          className="min-h-touch min-w-touch items-center justify-center rounded-full bg-canvas active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-ring"
        >
          <Icon as={LogOut} className="text-muted" />
        </Pressable>
      </View>
    </View>
  );
}
export function WorkspaceTabs({ tabs, selected, onSelect }: WorkspaceTabsProps) {
  return (
    <View accessibilityLabel={M.navigation} className="border-t border-line bg-surface px-1 pt-2">
      <View accessibilityRole="tablist" className="mx-auto w-full max-w-3xl flex-row">
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: selected === tab.key }}
            aria-selected={selected === tab.key}
            onPress={() => onSelect(tab.key)}
            className="min-h-touch min-w-0 flex-1 items-center justify-center gap-1 pb-2 active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-ring"
          >
            <View
              className={`h-7 min-w-12 items-center justify-center rounded-full ${selected === tab.key ? "bg-primary-soft" : "bg-transparent"}`}
            >
              <Icon
                as={tabIcons[tab.icon] ?? ClipboardList}
                className={selected === tab.key ? "text-primary" : "text-muted"}
              />
            </View>
            <Text
              numberOfLines={1}
              className={`text-[11px] ${selected === tab.key ? "font-body-bold text-primary" : "font-body text-muted"}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function StatusPill({ label, tone = "neutral", compact = false }: StatusPillProps) {
  const colors = {
    green: "border-success-line bg-success-soft text-success",
    amber: "border-warning-line bg-warning-soft text-warning-strong",
    blue: "border-info-line bg-info-soft text-info",
    red: "border-danger-line bg-danger-soft text-danger-strong",
    neutral: "border-outline-variant bg-neutral-soft text-customer-muted",
  };
  return (
    <Text
      className={`self-start overflow-hidden border font-body-semibold ${compact ? "rounded-[4px] px-1.5 py-0.5 text-[10px] leading-4" : "rounded-full px-3 py-1 text-[12px] leading-5"} ${colors[tone]}`}
    >
      {label}
    </Text>
  );
}
