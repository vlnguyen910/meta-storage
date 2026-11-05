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
import { useCustomerLinks } from "../use-customer-home";

export function CustomerLayout({
  children,
  title,
  onBack,
  onHome,
  user,
  onLogout,
  pending,
  error,
}: CustomerLayoutProps) {
  const [account, setAccount] = useState(false);
  const links = useCustomerLinks();
  return (
    <ScreenFrame>
      <View className="flex-1 bg-customer-canvas">
        {title ? (
          <View className="flex-row items-center gap-3 border-b border-line bg-surface px-4 py-3">
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
          <AppHeader
            onHome={onHome}
            onNotifications={() => void links.openWeb("/customer/notifications")}
          />
        )}
        {links.error ? (
          <View className="px-4 pt-3">
            <Notice error>{links.error}</Notice>
          </View>
        ) : null}
        {children}
        {!title ? (
          <BottomTabs
            selected="home"
            labels={{ home: M.title, profile: M.account }}
            onSelect={(tab) =>
              tab === "profile"
                ? setAccount(true)
                : tab === "rentals"
                  ? void links.openWeb("/customer/storage")
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
