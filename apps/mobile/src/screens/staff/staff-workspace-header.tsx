import { ArrowLeft, Bell, LogOut, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { WorkspaceHeaderProps } from "../../common/workspace-ui.types";
import { Icon } from "../../components/ui/icon";
import { Button } from "../../components/ui/mobile-ui";
import { WORKSPACE_UI as W } from "../../components/ui/workspace-ui.messages";
import { STAFF_API_UI as M } from "../../features/staff-api/staff-api.messages";
import { StaffSheet } from "./staff-sheet";

export function StaffWorkspaceHeader({
  name,
  subtitle,
  onBack,
  onLogout,
  onNotifications,
}: WorkspaceHeaderProps) {
  const [account, setAccount] = useState(false);
  const initial =
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part.charAt(0))
      .join("")
      .toLocaleUpperCase("vi") || "M";
  return (
    <>
      <View className="border-b border-line bg-surface px-4 py-2.5">
        <View className="mx-auto w-full max-w-xl flex-row items-center gap-2.5">
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={W.back}
              onPress={onBack}
              className="min-h-touch min-w-touch items-center justify-center rounded-control active:bg-primary-soft"
            >
              <Icon as={ArrowLeft} className="text-primary" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.account}
            accessibilityState={{ expanded: account }}
            onPress={() => setAccount(true)}
            className="h-10 w-10 items-center justify-center rounded-xl border border-success-line bg-customer-mint"
          >
            <Text className="font-body-bold text-[14px] text-primary">{initial}</Text>
          </Pressable>
          <View className="min-w-0 flex-1 py-0.5">
            <Text className="font-body-semibold text-[9px] uppercase tracking-[1px] text-primary">
              {M.role}
            </Text>
            <Text numberOfLines={1} className="font-body-bold text-[14px] leading-5 text-ink">
              {name}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon as={MapPin} size={11} className="text-muted" />
              <Text numberOfLines={1} className="font-body text-[10px] leading-4 text-muted">
                {subtitle}
              </Text>
            </View>
          </View>
          {onNotifications && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={W.notifications}
              onPress={onNotifications}
              className="min-h-touch min-w-touch items-center justify-center rounded-full bg-customer-canvas active:bg-primary-soft"
            >
              <Icon as={Bell} className="text-primary" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={W.logout}
            onPress={onLogout}
            className="min-h-touch min-w-touch items-center justify-center rounded-full bg-customer-canvas active:bg-primary-soft"
          >
            <Icon as={LogOut} className="text-primary" />
          </Pressable>
        </View>
      </View>
      {account && (
        <StaffSheet title={M.account} onClose={() => setAccount(false)}>
          <Text className="text-lg font-body-bold text-ink">{name}</Text>
          <Text className="mb-1 mt-2 font-body text-sm text-muted">{subtitle}</Text>
          <Text className="mb-6 font-body-semibold text-xs text-primary">{M.role}</Text>
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
