import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ScreenFrame({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-[#f8faf9]"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <StatusBar style="dark" />
      {children}
    </View>
  );
}
