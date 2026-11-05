import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { AUTH_MESSAGES } from "./auth.messages";
import type { AuthViewProps } from "./auth-screen.types";

export function LoginView({ auth, onBrowse }: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTroubleshootOpen, setIsTroubleshootOpen] = useState(false);

  return (
    <View className="w-full">
      {/* Main Title & Subtitle */}
      <Text className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {AUTH_MESSAGES.loginTitle}
      </Text>
      <Text className="mb-6 text-xs leading-5 text-slate-600">{AUTH_MESSAGES.loginSubtitle}</Text>

      {/* Primary Login Card */}
      <View
        className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        style={{ borderRadius: 16 }}
      >
        {/* Message Alert */}
        {auth.message ? (
          <View
            className={`mb-4 rounded-xl border p-3 ${
              auth.isSuccessMessage
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <Text
              className={`text-xs ${auth.isSuccessMessage ? "text-emerald-800" : "text-rose-700"}`}
            >
              {auth.message}
            </Text>
          </View>
        ) : null}

        <View className="gap-4">
          {/* Email Field */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-slate-900">
                {AUTH_MESSAGES.emailLabel} <Text className="text-rose-600">*</Text>
              </Text>
              <Text className="text-xs text-slate-400">{AUTH_MESSAGES.emailTagCustomerFS}</Text>
            </View>
            <View className="rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                className="h-11 text-sm text-slate-900"
                keyboardType="email-address"
                onChangeText={(val) => auth.updateField("email", val)}
                placeholder={AUTH_MESSAGES.emailPlaceholder}
                placeholderTextColor="#94a3b8"
                value={auth.values.email}
              />
            </View>
            <Text className="text-[11px] text-slate-500">{AUTH_MESSAGES.emailExampleHint}</Text>
            {auth.errors.email ? (
              <Text className="text-xs text-rose-600">{auth.errors.email}</Text>
            ) : null}
          </View>

          {/* Password Field */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-slate-900">
                {AUTH_MESSAGES.passwordLabel} <Text className="text-rose-600">*</Text>
              </Text>
              <Pressable onPress={() => auth.setMode("forgot-password")}>
                <Text className="text-xs font-semibold text-[#125345]">
                  {AUTH_MESSAGES.forgotPassword}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                className="h-11 flex-1 text-sm text-slate-900"
                onChangeText={(val) => auth.updateField("password", val)}
                placeholder={AUTH_MESSAGES.passwordPlaceholder}
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={auth.values.password}
              />
              <Pressable
                accessibilityRole="button"
                className="p-1"
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Text className="text-base text-slate-400">{showPassword ? "👁" : "👁‍🗨"}</Text>
              </Pressable>
            </View>
            {auth.errors.password ? (
              <Text className="text-xs text-rose-600">{auth.errors.password}</Text>
            ) : null}
          </View>

          {/* Remember Checkbox */}
          <Pressable
            className="flex-row items-center gap-2.5 pt-0.5"
            onPress={() => auth.setRemember(!auth.values.remember)}
          >
            <View
              className={`h-4 w-4 items-center justify-center rounded border ${
                auth.values.remember ? "border-[#125345] bg-[#125345]" : "border-slate-300 bg-white"
              }`}
            >
              {auth.values.remember ? (
                <Text className="text-[10px] font-bold text-white">✓</Text>
              ) : null}
            </View>
            <Text className="text-xs text-slate-700">{AUTH_MESSAGES.rememberMe}</Text>
          </Pressable>

          {/* Submit Button */}
          <Pressable
            accessibilityRole="button"
            className="mt-1 h-12 flex-row items-center justify-center rounded-xl bg-[#125345] active:bg-[#0d3f34]"
            disabled={auth.isSubmitting}
            onPress={() => void auth.submitLogin()}
            style={{ borderRadius: 12 }}
          >
            {auth.isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-sm font-bold text-white">{AUTH_MESSAGES.loginButton}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Secondary Card: Chưa có tài khoản? */}
      <View
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
        style={{ borderRadius: 16 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-bold text-slate-900">
              {AUTH_MESSAGES.dontHaveAccount}
            </Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-slate-500">
              {AUTH_MESSAGES.dontHaveAccountDesc}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            className="rounded-xl border border-[#cce7df] bg-[#e8f3ef] px-3.5 py-2.5 active:bg-[#d8ece4]"
            onPress={() => auth.setMode("register")}
            style={{ borderRadius: 10 }}
          >
            <Text className="text-xs font-bold text-[#125345]">{AUTH_MESSAGES.registerNow}</Text>
          </Pressable>
        </View>
      </View>

      {/* Continue as Guest Link */}
      {onBrowse && (
        <View className="mt-5 items-center">
          <Pressable className="flex-row items-center gap-1.5 py-1" onPress={onBrowse}>
            <Text className="text-xs font-bold text-[#125345]">
              {AUTH_MESSAGES.continueAsGuest}
            </Text>
            <Text className="text-xs font-bold text-[#125345]">›</Text>
          </Pressable>
        </View>
      )}

      <View className="my-5 border-t border-slate-200/80" />

      {/* Accordion: Hướng dẫn xử lý sự cố đăng nhập */}
      <View
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ borderRadius: 14 }}
      >
        <Pressable
          className="flex-row items-center justify-between p-4"
          onPress={() => setIsTroubleshootOpen((prev) => !prev)}
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Text className="text-sm text-slate-600">❓</Text>
            <Text className="text-xs font-bold text-slate-800">
              {AUTH_MESSAGES.troubleshootLoginTitle}
            </Text>
          </View>
          <Text className="text-xs font-bold text-slate-400">{isTroubleshootOpen ? "▲" : "▼"}</Text>
        </Pressable>

        {isTroubleshootOpen ? (
          <View className="border-t border-slate-100 bg-slate-50 p-4 gap-2.5">
            <Text className="text-xs leading-5 text-slate-600">
              {AUTH_MESSAGES.troubleshootStep1}
            </Text>
            <Text className="text-xs leading-5 text-slate-600">
              {AUTH_MESSAGES.troubleshootStep2}
            </Text>
            <Text className="text-xs leading-5 text-slate-600">
              {AUTH_MESSAGES.troubleshootStep3}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer matching Figma M-A01 */}
      <View className="mt-10 mb-4 items-center gap-1 text-center">
        <Text className="text-center text-[10px] text-slate-500">
          © 2026 storeX. {AUTH_MESSAGES.brandStorageSystem}
        </Text>
        <Text className="text-center text-[10px] text-slate-500">
          {AUTH_MESSAGES.isoInfoSecurity}
        </Text>
      </View>
    </View>
  );
}
