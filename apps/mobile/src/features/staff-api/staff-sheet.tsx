import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STAFF_API_UI as M } from "./staff-api.messages";

export function StaffSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-[#0f172a66]">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.closeSheet}
          onPress={onClose}
          className="absolute inset-0"
        />
        <View
          accessibilityViewIsModal
          className="max-h-[90%] w-full self-center rounded-t-3xl bg-white sm:max-w-xl"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-slate-200" />
          </View>
          <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-2">
            <Text accessibilityRole="header" className="text-xl font-bold text-slate-900">
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={M.closeSheet}
              onPress={onClose}
              className="min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-50"
            >
              <Text className="text-2xl text-slate-600">×</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-3">
            {children}
          </ScrollView>
          {footer && <View className="border-t border-slate-100 px-5 pt-4">{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}
