import { Platform, Pressable, Text, TextInput, View } from "react-native";
import type { MobileButtonProps, MobileCardProps, MobileFieldProps } from "./mobile-ui.types";

export function Card({ children, title }: MobileCardProps) {
  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {title ? (
        <Text accessibilityRole="header" className="mb-3 text-lg font-bold text-[#131B2E]">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
export function Button({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  secondary,
  danger,
  hint,
}: MobileButtonProps) {
  return (
    <View className="mb-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        className={`min-h-12 justify-center rounded-xl border px-4 py-3 ${disabled ? "border-slate-200 bg-[#E8EEEA]" : danger ? "border-red-700 bg-red-50" : secondary ? "border-slate-200 bg-white" : "border-[#125345] bg-[#125345]"}`}
      >
        <Text
          className={`text-center text-[15px] font-semibold ${disabled ? "text-[#65756C]" : danger ? "text-red-800" : secondary ? "text-[#125345]" : "text-white"}`}
        >
          {label}
        </Text>
      </Pressable>
      {hint ? <Text className="mt-1 text-sm leading-5 text-[#52635A]">{hint}</Text> : null}
    </View>
  );
}
export function Field({ label, error, hint, ref, ...props }: MobileFieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 font-semibold text-[#131B2E]">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor="#66756C"
        {...props}
        className={`min-h-12 rounded-xl border bg-white px-3 py-3 text-[16px] text-[#131B2E] ${error ? "border-red-700" : "border-slate-200"}`}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="mt-1 text-sm text-red-700">
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-1 text-sm leading-5 text-[#52635A]">{hint}</Text>
      ) : null}
    </View>
  );
}
export function Notice({ children, error = false }: { children: string; error?: boolean }) {
  return (
    <View
      className={`mb-4 rounded-xl border p-3 ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-[#E8F3EF]"}`}
    >
      <Text
        accessibilityLiveRegion="polite"
        className={`text-sm leading-5 ${error ? "text-red-800" : "text-[#125345]"}`}
      >
        {children}
      </Text>
    </View>
  );
}
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row flex-wrap justify-between gap-2 border-b border-[#E8EEEA] pb-2">
      <Text className="text-sm text-[#52635A]">{label}</Text>
      <Text className="min-w-0 flex-1 text-right text-sm font-semibold text-[#131B2E]">
        {value}
      </Text>
    </View>
  );
}
export function Heading({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      aria-level={Platform.OS === "web" ? 1 : undefined}
      className="mb-4 text-2xl font-bold leading-8 text-[#131B2E]"
    >
      {children}
    </Text>
  );
}
export const money = (amount: number | string) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(amount))} đ`;
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
