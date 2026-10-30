import { Pressable, Text, View } from "react-native";
import { WORKSPACE_UI as M } from "./workspace-ui.messages";
import type {
  StatusPillProps,
  WorkspaceHeaderProps,
  WorkspaceTabsProps,
} from "./workspace-ui.types";

export function WorkspaceHeader({
  name,
  subtitle,
  onBack,
  onLogout,
  onHome,
  onNotifications,
}: WorkspaceHeaderProps) {
  return (
    <View className="border-b border-slate-200 bg-white px-4 py-3">
      <View className="mx-auto w-full max-w-3xl flex-row items-center gap-3">
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.back}
            onPress={onBack}
            className="min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-50"
          >
            <Text className="text-2xl text-emerald-900">←</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole={onHome ? "button" : undefined}
            accessibilityLabel={M.home}
            onPress={onHome}
            className="h-11 w-11 items-center justify-center rounded-xl bg-emerald-900"
          >
            <Text className="text-xl font-bold text-white">M</Text>
          </Pressable>
        )}
        <View className="min-w-0 flex-1">
          <Text className="text-[10px] font-bold tracking-widest text-emerald-800">{M.brand}</Text>
          <Text numberOfLines={1} className="mt-0.5 text-base font-bold text-slate-900">
            {name}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-xs text-slate-500">
            {subtitle}
          </Text>
        </View>
        {onNotifications && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.notifications}
            onPress={onNotifications}
            className="min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-50"
          >
            <Text className="text-xl text-emerald-900">🔔</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.logout}
          onPress={onLogout}
          className="min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-50"
        >
          <Text className="text-xl text-slate-600">↪</Text>
        </Pressable>
      </View>
    </View>
  );
}
export function WorkspaceTabs({ tabs, selected, onSelect }: WorkspaceTabsProps) {
  return (
    <View
      accessibilityLabel={M.navigation}
      className="border-t border-slate-200 bg-white px-1 pt-2"
    >
      <View className="mx-auto w-full max-w-3xl flex-row">
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: selected === tab.key }}
            onPress={() => onSelect(tab.key)}
            className="min-h-16 min-w-0 flex-1 items-center justify-center gap-1 pb-2"
          >
            <View
              className={`h-7 min-w-12 items-center justify-center rounded-full ${selected === tab.key ? "bg-emerald-100" : "bg-transparent"}`}
            >
              <Text
                className={`text-lg ${selected === tab.key ? "text-emerald-900" : "text-slate-500"}`}
              >
                {tab.icon}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              className={`text-[11px] ${selected === tab.key ? "font-bold text-emerald-900" : "text-slate-500"}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const colors = {
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-sky-50 text-sky-800",
    red: "bg-rose-50 text-rose-800",
    neutral: "bg-slate-100 text-slate-600",
  };
  return (
    <Text
      className={`self-start overflow-hidden rounded-full px-3 py-1 text-xs font-semibold ${colors[tone]}`}
    >
      {label}
    </Text>
  );
}
