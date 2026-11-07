import { X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Text, View } from "react-native";
import type { CustomerLayoutProps } from "../../../common/customer-home.types";
import {
  AppHeader,
  BottomTabs,
  Button,
  Heading,
  IconButton,
  Notice,
  ScreenFrame,
} from "../../../components/ui";
import { CUSTOMER_HOME as M } from "../customer-home.messages";

export function CustomerLayout({
  children,
  title,
  onBack,
  onHome,
  onStorage,
  onProfile,
  selectedTab = "home",
  user,
  onLogout,
  pending,
  error,
  onUnavailable,
  notice,
  onDismissNotice,
  showTabs = !title,
}: CustomerLayoutProps) {
  const [account, setAccount] = useState(false);
  return (
    <ScreenFrame className={selectedTab === "profile" ? "bg-surface" : "bg-customer-canvas"}>
      <View className={`flex-1 ${selectedTab === "profile" ? "bg-surface" : "bg-customer-canvas"}`}>
        {title ? (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <IconButton icon={X} label={M.close} onPress={onBack ?? onHome} />
            <Text
              accessibilityRole="header"
              aria-level={Platform.OS === "web" ? 1 : undefined}
              className="shrink font-body-bold text-[20px] leading-7 text-primary"
            >
              {title}
            </Text>
          </View>
        ) : (
          <AppHeader onHome={onHome} onNotifications={onUnavailable} />
        )}
        {notice ? (
          <View className="flex-row items-start gap-2 px-4 pt-2">
            <View className="flex-1">
              <Notice>{M.unavailable}</Notice>
            </View>
            <IconButton icon={X} label={M.close} onPress={onDismissNotice} />
          </View>
        ) : null}
        {children}
        {showTabs ? (
          <BottomTabs
            selected={selectedTab}
            labels={{ home: M.title, profile: M.account }}
            onSelect={(tab) =>
              tab === "profile"
                ? onProfile
                  ? onProfile()
                  : setAccount(true)
                : tab === "rentals"
                  ? onStorage()
                  : onHome()
            }
          />
        ) : null}
      </View>
      <Modal
        visible={account}
        transparent
        animationType="fade"
        onRequestClose={() => setAccount(false)}
      >
        <View className="flex-1 justify-center bg-ink/40 p-6">
          <View
            accessibilityViewIsModal
            className="mx-auto w-full max-w-md rounded-card bg-surface p-6"
          >
            <Heading>{M.account}</Heading>
            <Text className="mb-2 font-body-semibold text-body text-ink">{user.name}</Text>
            {user.email ? (
              <Text className="mb-6 font-body text-label text-muted">{user.email}</Text>
            ) : null}
            {error ? <Notice error>{error}</Notice> : null}
            <Button label={M.logout} loading={pending} onPress={onLogout} />
            <Button
              label={M.close}
              variant="ghost"
              disabled={pending}
              onPress={() => setAccount(false)}
            />
          </View>
        </View>
      </Modal>
    </ScreenFrame>
  );
}
