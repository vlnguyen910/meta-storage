import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AUTH_MESSAGES } from "./auth.messages";

export interface GoogleButtonProps {
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  onPress: () => void;
}

export function GoogleButton({
  isLoading = false,
  disabled = false,
  label = AUTH_MESSAGES.googleLogin,
  onPress,
}: GoogleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || isLoading}
      onPress={onPress}
      className="h-12 w-full flex-row items-center justify-center rounded-xl border border-slate-300 bg-white px-4 shadow-xs active:bg-slate-50"
      style={{ borderRadius: 12 }}
    >
      {isLoading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color="#125345" size="small" />
          <Text className="text-xs font-semibold text-slate-600">
            {AUTH_MESSAGES.googleConnecting}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          {/* Stylized Google Emblem */}
          <View className="h-5 w-5 items-center justify-center rounded-full bg-slate-100">
            <Text className="text-xs font-black text-rose-500">G</Text>
          </View>
          <Text className="text-sm font-bold text-slate-700">{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
