import { X } from "lucide-react-native";
import { Modal, Platform, ScrollView, Text, View } from "react-native";
import type { DetailSheetProps } from "../../common/app-ui.types";
import { IconButton } from "./app-ui";
import { ScreenFrame } from "./screen-frame";
export function DetailSheet({ visible, title, closeLabel, onClose, children }: DetailSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenFrame className="bg-customer-canvas">
        <View className="mx-auto w-full max-w-3xl flex-row items-center gap-3 px-4 py-3">
          <Text
            accessibilityRole="header"
            aria-level={Platform.OS === "web" ? 1 : undefined}
            className="flex-1 font-body-bold text-[20px] leading-7 text-primary"
          >
            {title}
          </Text>
          <IconButton icon={X} label={closeLabel} onPress={onClose} />
        </View>
        <ScrollView
          accessibilityLabel={title}
          tabIndex={Platform.OS === "web" ? 0 : undefined}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-4 pb-5"
        >
          <View className="mx-auto w-full max-w-3xl">{children}</View>
        </ScrollView>
      </ScreenFrame>
    </Modal>
  );
}
