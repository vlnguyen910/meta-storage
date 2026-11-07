import { X } from "lucide-react-native";
import { useState } from "react";
import { Image, type ImageSourcePropType, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_UI } from "./app-ui.messages";
import { Icon } from "./icon";

export function MobilePhoto({
  source,
  label,
  tall = false,
  aspectRatio,
  flush = false,
  outlined = false,
  previewable = false,
}: {
  source: ImageSourcePropType;
  label: string;
  tall?: boolean;
  aspectRatio?: number;
  flush?: boolean;
  outlined?: boolean;
  previewable?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [previewOpen, setPreviewOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <Pressable
        accessibilityRole={previewable ? "button" : undefined}
        accessibilityLabel={previewable ? `${APP_UI.previewPhoto}: ${label}` : label}
        disabled={!previewable}
        onPress={() => setPreviewOpen(true)}
        className={`w-full overflow-hidden ${outlined ? "rounded-xl border border-outline-variant bg-customer-canvas" : flush ? "" : "mb-4 rounded-[4px]"} ${aspectRatio ? "" : tall ? "h-48" : "h-44"}`}
        style={aspectRatio ? { aspectRatio } : undefined}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize((current) =>
            current.width === width && current.height === height ? current : { width, height },
          );
        }}
      >
        <Image
          accessibilityLabel={label}
          source={source}
          resizeMode="cover"
          style={{ width: size.width, height: size.height }}
        />
      </Pressable>
      {previewable && (
        <Modal
          transparent
          animationType="fade"
          statusBarTranslucent
          visible={previewOpen}
          onRequestClose={() => setPreviewOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black">
            <Image
              accessibilityLabel={label}
              source={source}
              resizeMode="contain"
              style={{ width: "100%", height: "100%" }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={APP_UI.closePhoto}
              onPress={() => setPreviewOpen(false)}
              className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-black/60"
              style={{ top: Math.max(insets.top, 16) + 8 }}
            >
              <Icon as={X} className="text-white" />
            </Pressable>
          </View>
        </Modal>
      )}
    </>
  );
}
