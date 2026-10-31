import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CUSTOMER_MOBILE_UI as U } from "./customer-ui.messages";

export interface CustomerNavDrawerProps {
  visible: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (key: "home" | "catalog" | "rentals" | "transactions" | "support") => void;
  onOpenNotifications: () => void;
  owner: string;
  name: string;
  email?: string;
  onLogout: () => void;
}

export function CustomerNavDrawer({
  visible,
  onClose,
  currentTab,
  onSelectTab,
  onOpenNotifications,
  name,
  email,
  onLogout,
}: CustomerNavDrawerProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 flex-row bg-black/60">
        {/* Drawer Panel */}
        <SafeAreaView
          edges={["top", "bottom", "left"]}
          className="w-4/5 max-w-[320px] bg-[#0B2F24] shadow-2xl flex-1 justify-between"
        >
          {/* Header */}
          <View className="border-b border-[#184E40] px-5 py-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#184E40]">
                  <Text className="text-base font-black text-[#52D1A6]">⊞</Text>
                </View>
                <Text className="text-xl font-black text-white">storeX</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng menu"
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-[#184E40] active:opacity-70"
              >
                <Text className="text-sm font-bold text-white">✕</Text>
              </Pressable>
            </View>

            <View className="mt-4">
              <Text className="text-xs font-semibold text-[#8FAFA5]">Tài khoản khách hàng</Text>
              <Text numberOfLines={1} className="mt-0.5 text-base font-bold text-white">
                {name}
              </Text>
              {email ? (
                <Text numberOfLines={1} className="text-xs text-[#8FAFA5]">
                  {email}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Navigation Items (Matching uploaded screenshot) */}
          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            <View className="gap-2.5">
              {U.tabs.map((tab) => {
                const isActive = currentTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="button"
                    accessibilityLabel={tab.label}
                    onPress={() => {
                      onSelectTab(tab.key);
                      onClose();
                    }}
                    className={`flex-row items-center rounded-2xl px-4 py-3.5 active:opacity-80 ${
                      isActive ? "bg-[#184E40] shadow-sm" : "bg-transparent"
                    }`}
                  >
                    {/* Left Active Accent Pill Bar */}
                    {isActive ? (
                      <View className="mr-3 h-5 w-1.5 rounded-full bg-[#52D1A6]" />
                    ) : (
                      <View className="mr-3 w-1.5" />
                    )}

                    {/* Icon */}
                    <Text
                      className={`mr-3 text-xl ${isActive ? "text-[#52D1A6]" : "text-[#8FAFA5]"}`}
                    >
                      {tab.icon}
                    </Text>

                    {/* Label */}
                    <Text
                      className={`text-base font-bold ${
                        isActive ? "text-white" : "text-[#A3C3B9]"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Quick Actions / Shortcuts */}
            <View className="mt-6 border-t border-[#184E40] pt-4 gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thông báo"
                onPress={() => {
                  onOpenNotifications();
                  onClose();
                }}
                className="flex-row items-center rounded-xl px-4 py-3 active:bg-[#184E40]/50"
              >
                <Text className="mr-3 text-lg text-[#8FAFA5]">🔔</Text>
                <Text className="text-sm font-semibold text-[#A3C3B9]">Thông báo hệ thống</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Footer with Logout */}
          <View className="border-t border-[#184E40] p-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đăng xuất"
              onPress={() => {
                onClose();
                onLogout();
              }}
              className="flex-row items-center justify-center rounded-xl bg-rose-950/40 border border-rose-800/40 py-3 active:bg-rose-900/40"
            >
              <Text className="text-sm font-bold text-rose-300">↪ Đăng xuất</Text>
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Backdrop clickable to close */}
        <Pressable className="flex-1" onPress={onClose} />
      </View>
    </Modal>
  );
}
