import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { AUTH_MESSAGES } from "./auth.messages";
import type { useAuthFlow } from "./use-auth-flow";

interface ForgotPasswordViewProps {
  auth: ReturnType<typeof useAuthFlow>;
}

export function ForgotPasswordView({ auth }: ForgotPasswordViewProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <View className="w-full">
      {/* Security Badge */}
      <View className="mb-3.5 self-start rounded-full border border-[#cce7df] bg-[#e8f3ef] px-3.5 py-1">
        <Text className="text-xs font-semibold text-[#125345]">🔄 {AUTH_MESSAGES.forgotBadge}</Text>
      </View>

      {/* Main Title & Subtitle */}
      <Text className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {AUTH_MESSAGES.forgotPasswordTitle}
      </Text>
      <Text className="mb-6 text-xs leading-5 text-slate-600">
        {AUTH_MESSAGES.forgotPasswordSubtitle}
      </Text>

      {/* Card Form */}
      <View
        className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        style={{ borderRadius: 16 }}
      >
        {/* Status / Alert */}
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

        <View className="gap-3">
          {/* Label Row */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-slate-900">
              {AUTH_MESSAGES.forgotEmailLabel} <Text className="text-rose-600">*</Text>
            </Text>
            <Text className="text-xs text-slate-400">{AUTH_MESSAGES.requiredLabel}</Text>
          </View>

          {/* Input with Email Icon on Right */}
          <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              className="h-12 flex-1 text-sm text-slate-900"
              keyboardType="email-address"
              onChangeText={(val) => auth.updateField("email", val)}
              placeholder={AUTH_MESSAGES.forgotEmailPlaceholder}
              placeholderTextColor="#94a3b8"
              value={auth.values.email}
            />
            <Text className="ml-2 text-base text-slate-400">✉</Text>
          </View>

          {/* Helper Notice */}
          <View className="flex-row items-center gap-1.5 pt-0.5">
            <Text className="text-xs text-slate-500">ⓘ</Text>
            <Text className="text-xs text-slate-500">{AUTH_MESSAGES.forgotEmailNotice}</Text>
          </View>

          {/* Submit Button */}
          <Pressable
            accessibilityRole="button"
            className="mt-3 h-12 flex-row items-center justify-center rounded-xl bg-[#125345] active:bg-[#0d3f34]"
            disabled={auth.isSubmitting}
            onPress={() => void auth.submitForgotPassword()}
            style={{ borderRadius: 12 }}
          >
            {auth.isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-sm font-bold text-white">
                {AUTH_MESSAGES.forgotPasswordSubmitBtn} →
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Accordion: Hỗ trợ khi không nhận được email? */}
      <View
        className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ borderRadius: 14 }}
      >
        <Pressable
          className="flex-row items-center justify-between p-4"
          onPress={() => setIsHelpOpen((prev) => !prev)}
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Text className="text-sm text-slate-600">❓</Text>
            <Text className="text-xs font-bold text-slate-800">
              {AUTH_MESSAGES.forgotHelpAccordionTitle}
            </Text>
          </View>
          <Text className="text-xs font-bold text-slate-400">{isHelpOpen ? "▲" : "▼"}</Text>
        </Pressable>

        {isHelpOpen ? (
          <View className="border-t border-slate-100 bg-slate-50 p-4 gap-2.5">
            <Text className="text-xs leading-5 text-slate-600">
              {AUTH_MESSAGES.forgotHelpStep1}
            </Text>
            <Text className="text-xs leading-5 text-slate-600">
              {AUTH_MESSAGES.forgotHelpStep2}
            </Text>
            <Text className="text-xs leading-5 text-slate-600">
              {AUTH_MESSAGES.forgotHelpStep3}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Back to Login Link */}
      <View className="mt-8 items-center">
        <Pressable
          className="flex-row items-center gap-1.5 py-2"
          onPress={() => auth.setMode("login")}
        >
          <Text className="text-xs font-semibold text-[#125345]">
            ← {AUTH_MESSAGES.backToLoginBtn}
          </Text>
        </Pressable>
      </View>

      {/* Footer Specs & Security Badges matching Figma M-A04 */}
      <View className="mt-14 border-t border-slate-200/80 pt-6">
        <View className="flex-row items-center justify-center gap-2">
          <View className="flex-row items-center gap-1">
            <Text className="text-xs">🛡</Text>
            <Text className="text-xs text-slate-500">ISO 27001</Text>
          </View>
          <Text className="text-slate-300">•</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs">🔥</Text>
            <Text className="text-xs text-slate-500">{AUTH_MESSAGES.pcccSecurity}</Text>
          </View>
          <Text className="text-slate-300">•</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs">🎥</Text>
            <Text className="text-xs text-slate-500">{AUTH_MESSAGES.cctvSecurity}</Text>
          </View>
        </View>

        <Text className="mt-2 text-center text-[10px] text-slate-400">
          {AUTH_MESSAGES.copyrightTech}
        </Text>
        <Text className="mt-1 text-center text-[10px] text-slate-400">
          {AUTH_MESSAGES.screenCodeM_A04}
        </Text>
      </View>
    </View>
  );
}
