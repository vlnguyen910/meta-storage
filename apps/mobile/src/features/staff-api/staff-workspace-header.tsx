import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "../../components/ui/mobile-ui";
import { WORKSPACE_UI as W } from "../../components/ui/workspace-ui.messages";
import type { WorkspaceHeaderProps } from "../../components/ui/workspace-ui.types";
import { STAFF_API_UI as M } from "./staff-api.messages";
import { StaffSheet } from "./staff-sheet";

export function StaffWorkspaceHeader({
  name,
  subtitle,
  onHome,
  onBack,
  onLogout,
  onNotifications,
}: WorkspaceHeaderProps) {
  const [account, setAccount] = useState(false);
  const initial = name.trim().split(/\s+/).at(-1)?.slice(0, 1).toUpperCase() || "M";
  return (
    <>
      <View className="border-b border-slate-200 bg-white px-4 py-2.5">
        <View className="mx-auto w-full max-w-3xl flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={onBack ? W.back : W.home}
            onPress={onBack ?? onHome}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <View
              className={`h-9 w-9 items-center justify-center rounded-xl ${onBack ? "bg-slate-50" : "bg-emerald-900"}`}
            >
              <Text className={`text-lg font-bold ${onBack ? "text-emerald-900" : "text-white"}`}>
                {onBack ? "←" : "M"}
              </Text>
            </View>
          </Pressable>
          <View className="min-w-0 flex-1 py-1">
            <Text numberOfLines={2} className="text-base font-bold leading-5 text-slate-900">
              {name}
            </Text>
            <Text numberOfLines={1} className="mt-1 text-xs leading-4 text-slate-500">
              {subtitle}
            </Text>
          </View>
          {onNotifications && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={W.notifications}
              onPress={onNotifications}
              className="min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-50"
            >
              <Text className="text-lg">🔔</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.account}
            accessibilityState={{ expanded: account }}
            onPress={() => setAccount(true)}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
              <Text className="text-sm font-bold text-emerald-900">{initial}</Text>
            </View>
          </Pressable>
        </View>
      </View>
      {account && (
        <StaffSheet title={M.account} onClose={() => setAccount(false)}>
          <Text className="text-lg font-bold text-slate-900">{name}</Text>
          <Text className="mb-1 mt-2 text-sm text-slate-600">{subtitle}</Text>
          <Text className="mb-6 text-xs font-semibold text-emerald-800">{M.role}</Text>
          <Button
            label={W.logout}
            danger
            onPress={() => {
              setAccount(false);
              onLogout();
            }}
          />
        </StaffSheet>
      )}
    </>
  );
}
