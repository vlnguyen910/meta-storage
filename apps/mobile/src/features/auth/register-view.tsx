import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { AUTH_MESSAGES } from "./auth.messages";
import type { AuthViewProps } from "./auth-screen.types";
import { GoogleButton } from "./google-button";

export function RegisterView({ auth }: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  const password = auth.values.password;
  const confirmPassword = auth.values.confirmPassword;
  const isMatching = Boolean(password) && Boolean(confirmPassword) && password === confirmPassword;
  const isMismatch = Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword;

  return (
    <View className="w-full">
      {/* Badge Section */}
      <View className="mb-3 self-start rounded-full border border-[#cce7df] bg-[#e8f3ef] px-3 py-1">
        <Text className="text-[11px] font-bold text-[#125345]">
          ● {AUTH_MESSAGES.registerBadge}
        </Text>
      </View>

      {/* Main Title & Subtitle */}
      <Text className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {AUTH_MESSAGES.registerTitle}
      </Text>
      <Text className="mb-5 text-xs leading-5 text-slate-500">
        {AUTH_MESSAGES.registerSubtitle}
      </Text>

      {/* Registration Card */}
      <View
        className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        style={{ borderRadius: 16 }}
      >
        {/* Message Alert */}
        {auth.message ? (
          <View className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <Text className="text-xs text-rose-700">{auth.message}</Text>
          </View>
        ) : null}

        <View className="gap-4">
          {/* Field 1: Họ và tên */}
          <View className="gap-1.5">
            <Text className="text-sm font-bold text-slate-900">
              {AUTH_MESSAGES.fullNameLabel} <Text className="text-rose-600">*</Text>
            </Text>
            <View className="rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                className="h-11 text-sm text-slate-900"
                onChangeText={(val) => auth.updateField("name", val)}
                placeholder={AUTH_MESSAGES.fullNamePlaceholder}
                placeholderTextColor="#94a3b8"
                value={auth.values.name}
              />
            </View>
            {auth.errors.name ? (
              <Text className="text-xs text-rose-600">{auth.errors.name}</Text>
            ) : null}
          </View>

          {/* Field 2: Số điện thoại */}
          <View className="gap-1.5">
            <Text className="text-sm font-bold text-slate-900">
              {AUTH_MESSAGES.phoneLabel} <Text className="text-rose-600">*</Text>
            </Text>
            <View className="rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoComplete="tel"
                className="h-11 text-sm text-slate-900"
                keyboardType="phone-pad"
                onChangeText={(val) => auth.updateField("phone", val)}
                placeholder={AUTH_MESSAGES.phonePlaceholder}
                placeholderTextColor="#94a3b8"
                value={auth.values.phone}
              />
            </View>
            <Text className="text-[11px] text-slate-500">{AUTH_MESSAGES.phoneHint}</Text>
            {auth.errors.phone ? (
              <Text className="text-xs text-rose-600">{auth.errors.phone}</Text>
            ) : null}
          </View>

          {/* Field 3: Email */}
          <View className="gap-1.5">
            <Text className="text-sm font-bold text-slate-900">
              {AUTH_MESSAGES.emailLabel} <Text className="text-rose-600">*</Text>
            </Text>
            <View className="rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                className="h-11 text-sm text-slate-900"
                keyboardType="email-address"
                onChangeText={(val) => auth.updateField("email", val)}
                placeholder="name@example.com"
                placeholderTextColor="#94a3b8"
                value={auth.values.email}
              />
            </View>
            <Text className="text-[11px] text-slate-500">{AUTH_MESSAGES.emailRegisterHint}</Text>
            {auth.errors.email ? (
              <Text className="text-xs text-rose-600">{auth.errors.email}</Text>
            ) : null}
          </View>

          {/* Field 4: Mật khẩu */}
          <View className="gap-1.5">
            <Text className="text-sm font-bold text-slate-900">
              {AUTH_MESSAGES.passwordLabel} <Text className="text-rose-600">*</Text>
            </Text>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                className="h-11 flex-1 text-sm text-slate-900"
                onChangeText={(val) => auth.updateField("password", val)}
                placeholder="Nhập tối thiểu 8 ký tự"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={auth.values.password}
              />
              <Pressable
                accessibilityRole="button"
                className="p-1"
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Text className="text-sm text-slate-500">{showPassword ? "Ẩn" : "Hiện"}</Text>
              </Pressable>
            </View>
            <Text className="text-[11px] text-slate-500">{AUTH_MESSAGES.passwordRegisterHint}</Text>
            {auth.errors.password ? (
              <Text className="text-xs text-rose-600">{auth.errors.password}</Text>
            ) : null}
          </View>

          {/* Field 5: Xác nhận lại mật khẩu */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-slate-900">
                {AUTH_MESSAGES.confirmPasswordLabel} <Text className="text-rose-600">*</Text>
              </Text>
              {isMatching ? (
                <Text className="text-[11px] font-semibold text-emerald-600">
                  ✓ {AUTH_MESSAGES.passwordsMatch}
                </Text>
              ) : isMismatch ? (
                <Text className="text-[11px] font-semibold text-rose-600">
                  × {AUTH_MESSAGES.passwordsDoNotMatch}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                className="h-11 flex-1 text-sm text-slate-900"
                onChangeText={(val) => auth.updateField("confirmPassword", val)}
                placeholder={AUTH_MESSAGES.confirmPasswordPlaceholder}
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showConfirmPassword}
                value={auth.values.confirmPassword}
              />
              <Pressable
                accessibilityRole="button"
                className="p-1"
                onPress={() => setShowConfirmPassword((prev) => !prev)}
              >
                <Text className="text-sm text-slate-500">
                  {showConfirmPassword ? "Ẩn" : "Hiện"}
                </Text>
              </Pressable>
            </View>
            {auth.errors.confirmPassword ? (
              <Text className="text-xs text-rose-600">{auth.errors.confirmPassword}</Text>
            ) : null}
          </View>

          {/* Field 6: Terms Checkbox */}
          <Pressable
            className="flex-row items-start gap-2.5 pt-1"
            onPress={() => auth.setTerms(!auth.values.terms)}
          >
            <View
              className={`mt-0.5 h-4 w-4 items-center justify-center rounded border ${
                auth.values.terms ? "border-[#125345] bg-[#125345]" : "border-slate-300 bg-white"
              }`}
            >
              {auth.values.terms ? (
                <Text className="text-[10px] font-bold text-white">✓</Text>
              ) : null}
            </View>
            <Text className="flex-1 text-xs leading-4 text-slate-600">
              {AUTH_MESSAGES.termsAgreement}
            </Text>
          </Pressable>
          {auth.errors.terms ? (
            <Text className="text-xs text-rose-600">{auth.errors.terms}</Text>
          ) : null}

          {/* Primary CTA Button */}
          <Pressable
            accessibilityRole="button"
            className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-[#125345] active:bg-[#0d3f34]"
            disabled={auth.isSubmitting}
            onPress={() => void auth.submitRegister()}
            style={{ borderRadius: 12 }}
          >
            {auth.isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {AUTH_MESSAGES.registerButton}
              </Text>
            )}
          </Pressable>

          {/* OR Divider */}
          <View className="my-1 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-[11px] font-semibold text-slate-400">
              {AUTH_MESSAGES.orDivider}
            </Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          {/* Google SSO Button */}
          <GoogleButton
            isLoading={auth.isGoogleLoading}
            disabled={auth.isSubmitting}
            label={AUTH_MESSAGES.googleLogin}
            onPress={() => void auth.signInWithGoogle()}
          />

          {/* Switch to Login */}
          <View className="mt-2 items-center justify-center pt-2">
            <Pressable onPress={() => auth.setMode("login")}>
              <Text className="text-xs text-slate-600">
                {AUTH_MESSAGES.alreadyHaveAccount}{" "}
                <Text className="font-bold text-[#125345]">{AUTH_MESSAGES.loginNow}</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Accordion: Quy trình sau khi đăng ký tài khoản (3 bước) */}
      <View
        className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ borderRadius: 14 }}
      >
        <Pressable
          className="flex-row items-center justify-between p-4"
          onPress={() => setIsAccordionOpen((prev) => !prev)}
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Text className="text-sm">📈</Text>
            <Text className="text-xs font-bold text-slate-800">
              {AUTH_MESSAGES.accordionStepsTitle}
            </Text>
          </View>
          <Text className="text-xs font-bold text-slate-400">{isAccordionOpen ? "▲" : "▼"}</Text>
        </Pressable>

        {isAccordionOpen ? (
          <View className="border-t border-slate-100 bg-slate-50 p-4 gap-3">
            {/* Step 1 */}
            <View className="gap-1">
              <Text className="text-xs font-bold text-slate-900">{AUTH_MESSAGES.step1Title}</Text>
              <Text className="text-[11px] leading-4 text-slate-600">
                {AUTH_MESSAGES.step1Desc}
              </Text>
            </View>

            {/* Step 2 */}
            <View className="gap-1">
              <Text className="text-xs font-bold text-slate-900">{AUTH_MESSAGES.step2Title}</Text>
              <Text className="text-[11px] leading-4 text-slate-600">
                {AUTH_MESSAGES.step2Desc}
              </Text>
            </View>

            {/* Step 3 */}
            <View className="gap-1">
              <Text className="text-xs font-bold text-slate-900">{AUTH_MESSAGES.step3Title}</Text>
              <Text className="text-[11px] leading-4 text-slate-600">
                {AUTH_MESSAGES.step3Desc}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Trust Security Banner */}
      <View
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"
        style={{ borderRadius: 14 }}
      >
        <View className="flex-row items-start gap-2.5">
          <Text className="text-lg">🛡</Text>
          <View className="flex-1">
            <Text className="mb-1 text-xs font-bold text-slate-900">
              {AUTH_MESSAGES.trustBannerTitle}
            </Text>
            <Text className="text-[11px] leading-4 text-slate-600">
              {AUTH_MESSAGES.trustBannerDesc}
            </Text>
          </View>
        </View>
      </View>

      {/* Copyright */}
      <Text className="mt-6 mb-2 text-center text-[10px] text-slate-400">
        Copyright © 2026 storeX. {AUTH_MESSAGES.brandSubtitle}.
      </Text>
    </View>
  );
}
