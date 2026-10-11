import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AUTH_MESSAGES } from "./auth.messages";
import type { useAuthFlow } from "./use-auth-flow";

interface VerifyEmailViewProps {
  auth: ReturnType<typeof useAuthFlow>;
}

export function VerifyEmailView({ auth }: VerifyEmailViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const customerName = auth.registeredUser?.name || auth.values.name || "Nguyễn Minh Anh";
  const customerEmail = auth.registeredUser?.email || auth.values.email || "customer@example.com";

  // Mask email e.g. "cu*******@example.test"
  const maskedEmail = maskEmail(customerEmail);

  function toggleFaq(index: number) {
    setOpenFaq((prev) => (prev === index ? null : index));
  }

  return (
    <View className="w-full">
      {/* State Simulator Control Bar (as shown in Figma screenshot) */}
      <View
        className="mb-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs"
        style={{ borderRadius: 14 }}
      >
        <View className="flex-row items-center gap-1.5 px-2 py-1">
          <Text className="text-xs font-semibold text-slate-500">Mô phỏng:</Text>
          <View className="flex-1 flex-row gap-1">
            <Pressable
              className={`flex-1 items-center justify-center rounded-lg py-1.5 ${
                auth.verifySimState === "pending" ? "bg-[#125345]" : "bg-slate-100"
              }`}
              onPress={() => auth.setVerifySimState("pending")}
            >
              <Text
                className={`text-[11px] font-bold ${
                  auth.verifySimState === "pending" ? "text-white" : "text-slate-600"
                }`}
              >
                1. Chờ xác thực
              </Text>
            </Pressable>

            <Pressable
              className={`flex-1 items-center justify-center rounded-lg py-1.5 ${
                auth.verifySimState === "success" ? "bg-[#125345]" : "bg-slate-100"
              }`}
              onPress={() => auth.setVerifySimState("success")}
            >
              <Text
                className={`text-[11px] font-bold ${
                  auth.verifySimState === "success" ? "text-white" : "text-slate-600"
                }`}
              >
                2. Thành công
              </Text>
            </Pressable>

            <Pressable
              className={`flex-1 items-center justify-center rounded-lg py-1.5 ${
                auth.verifySimState === "expired" ? "bg-[#125345]" : "bg-slate-100"
              }`}
              onPress={() => auth.setVerifySimState("expired")}
            >
              <Text
                className={`text-[11px] font-bold ${
                  auth.verifySimState === "expired" ? "text-white" : "text-slate-600"
                }`}
              >
                3. Hết hạn
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Customer Identity Card */}
      <View
        className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        style={{ borderRadius: 16 }}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[10px] text-emerald-700">●</Text>
            <Text className="text-[11px] font-bold text-slate-700">
              {AUTH_MESSAGES.userTypePersonal}
            </Text>
          </View>

          <View
            className={`rounded-full px-2.5 py-0.5 ${
              auth.verifySimState === "success"
                ? "bg-emerald-100"
                : auth.verifySimState === "expired"
                  ? "bg-amber-100"
                  : "bg-[#e8f3ef]"
            }`}
          >
            <Text
              className={`text-[11px] font-bold ${
                auth.verifySimState === "success"
                  ? "text-emerald-800"
                  : auth.verifySimState === "expired"
                    ? "text-amber-800"
                    : "text-[#125345]"
              }`}
            >
              ●{" "}
              {auth.verifySimState === "success"
                ? AUTH_MESSAGES.statusSuccess
                : auth.verifySimState === "expired"
                  ? AUTH_MESSAGES.statusExpired
                  : AUTH_MESSAGES.statusPending}
            </Text>
          </View>
        </View>

        <Text className="text-xs text-slate-500">{AUTH_MESSAGES.customerRegisteredLabel}</Text>
        <Text className="mt-0.5 text-base font-bold text-slate-900">{customerName}</Text>

        <View className="mt-3 flex-row items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm">✉</Text>
            <Text className="text-xs font-mono font-medium text-slate-700">{maskedEmail}</Text>
          </View>
          <Pressable onPress={() => auth.setMode("register")}>
            <Text className="text-xs font-bold text-[#125345]">{AUTH_MESSAGES.changeEmailBtn}</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Status Container */}
      <View
        className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        style={{ borderRadius: 16 }}
      >
        {/* State 1: PENDING (Chờ xác thực) */}
        {auth.verifySimState === "pending" && (
          <View className="items-center">
            {/* Mail Icon */}
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f3ef]"
              style={{ borderRadius: 18 }}
            >
              <Text className="text-3xl">✉️</Text>
            </View>

            <Text className="mb-2 text-center text-xl font-bold text-slate-900">
              {AUTH_MESSAGES.checkEmailTitle}
            </Text>
            <Text className="mb-5 text-center text-xs leading-5 text-slate-500">
              {AUTH_MESSAGES.checkEmailDescription}
            </Text>

            {/* 3 Step Instruction Box */}
            <View className="mb-5 w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 gap-3">
              <View className="flex-row items-start gap-2.5">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-[#125345]">
                  <Text className="text-[10px] font-bold text-white">1</Text>
                </View>
                <Text className="flex-1 text-xs leading-4 text-slate-700">
                  {AUTH_MESSAGES.verifyStep1}
                </Text>
              </View>

              <View className="flex-row items-start gap-2.5">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-[#125345]">
                  <Text className="text-[10px] font-bold text-white">2</Text>
                </View>
                <Text className="flex-1 text-xs leading-4 text-slate-700">
                  <Text className="font-semibold">{AUTH_MESSAGES.verifyStep2}</Text>
                </Text>
              </View>

              <View className="flex-row items-start gap-2.5">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-[#125345]">
                  <Text className="text-[10px] font-bold text-white">3</Text>
                </View>
                <Text className="flex-1 text-xs leading-4 text-slate-700">
                  {AUTH_MESSAGES.verifyStep3}
                </Text>
              </View>
            </View>

            {/* CTA 1: Mở ứng dụng thư */}
            <Pressable
              accessibilityRole="button"
              className="mb-2.5 h-12 w-full flex-row items-center justify-center rounded-xl bg-[#125345] active:bg-[#0d3f34]"
              onPress={() => void auth.openMailApp()}
              style={{ borderRadius: 12 }}
            >
              <Text className="mr-1.5 text-base">↗</Text>
              <Text className="text-sm font-semibold text-white">
                {AUTH_MESSAGES.openMailAppBtn}
              </Text>
            </Pressable>

            {/* CTA 2: Gửi lại email xác thực (45s) */}
            <Pressable
              accessibilityRole="button"
              className={`h-11 w-full flex-row items-center justify-center rounded-xl border ${
                auth.resendCountdown > 0 || auth.isResending
                  ? "border-slate-200 bg-slate-50"
                  : "border-[#125345] bg-white active:bg-[#e8f3ef]"
              }`}
              disabled={auth.resendCountdown > 0 || auth.isResending}
              onPress={() => void auth.resendVerificationEmail()}
              style={{ borderRadius: 12 }}
            >
              {auth.isResending ? (
                <ActivityIndicator color="#125345" size="small" />
              ) : (
                <Text
                  className={`text-xs font-bold ${
                    auth.resendCountdown > 0 ? "text-slate-400" : "text-[#125345]"
                  }`}
                >
                  ↻{" "}
                  {auth.resendCountdown > 0
                    ? AUTH_MESSAGES.resendEmailCountdown(auth.resendCountdown)
                    : AUTH_MESSAGES.resendEmailReady}
                </Text>
              )}
            </Pressable>

            <Text className="mt-3 text-center text-[11px] text-slate-400">
              🕒 {AUTH_MESSAGES.resendWaitNotice}
            </Text>
          </View>
        )}

        {/* State 2: SUCCESS (Thành công) */}
        {auth.verifySimState === "success" && (
          <View className="items-center py-2">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100"
              style={{ borderRadius: 18 }}
            >
              <Text className="text-3xl text-emerald-800">✓</Text>
            </View>

            <Text className="mb-2 text-center text-xl font-bold text-slate-900">
              {AUTH_MESSAGES.verifySuccessTitle}
            </Text>
            <Text className="mb-6 text-center text-xs leading-5 text-slate-500">
              {AUTH_MESSAGES.verifySuccessDesc}
            </Text>

            <Pressable
              accessibilityRole="button"
              className="h-12 w-full flex-row items-center justify-center rounded-xl bg-[#125345] active:bg-[#0d3f34]"
              onPress={() => auth.setMode("login")}
              style={{ borderRadius: 12 }}
            >
              <Text className="text-sm font-semibold text-white">
                {AUTH_MESSAGES.continueToLoginBtn} →
              </Text>
            </Pressable>
          </View>
        )}

        {/* State 3: EXPIRED (Hết hạn) */}
        {auth.verifySimState === "expired" && (
          <View className="items-center py-2">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-amber-100"
              style={{ borderRadius: 18 }}
            >
              <Text className="text-3xl text-amber-800">⚠</Text>
            </View>

            <Text className="mb-2 text-center text-xl font-bold text-slate-900">
              {AUTH_MESSAGES.verifyExpiredTitle}
            </Text>
            <Text className="mb-6 text-center text-xs leading-5 text-slate-500">
              {AUTH_MESSAGES.verifyExpiredDesc}
            </Text>

            <Pressable
              accessibilityRole="button"
              className="h-12 w-full flex-row items-center justify-center rounded-xl bg-[#125345] active:bg-[#0d3f34]"
              onPress={() => {
                auth.setVerifySimState("pending");
                void auth.resendVerificationEmail();
              }}
              style={{ borderRadius: 12 }}
            >
              <Text className="text-sm font-semibold text-white">
                {AUTH_MESSAGES.resendNewEmailBtn}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Accordion FAQ Section */}
      <View
        className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ borderRadius: 16 }}
      >
        <View className="border-b border-slate-100 p-4">
          <Text className="text-xs font-bold text-slate-900">❓ {AUTH_MESSAGES.faqTitle}</Text>
        </View>

        {/* FAQ 1 */}
        <Pressable className="border-b border-slate-100 p-4" onPress={() => toggleFaq(1)}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-slate-800">{AUTH_MESSAGES.faq1Question}</Text>
            <Text className="text-xs text-slate-400">{openFaq === 1 ? "▲" : "▼"}</Text>
          </View>
          {openFaq === 1 ? (
            <Text className="mt-2 text-[11px] leading-4 text-slate-500">
              {AUTH_MESSAGES.faq1Answer}
            </Text>
          ) : null}
        </Pressable>

        {/* FAQ 2 */}
        <Pressable className="border-b border-slate-100 p-4" onPress={() => toggleFaq(2)}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-slate-800">{AUTH_MESSAGES.faq2Question}</Text>
            <Text className="text-xs text-slate-400">{openFaq === 2 ? "▲" : "▼"}</Text>
          </View>
          {openFaq === 2 ? (
            <Text className="mt-2 text-[11px] leading-4 text-slate-500">
              {AUTH_MESSAGES.faq2Answer}
            </Text>
          ) : null}
        </Pressable>

        {/* FAQ 3 */}
        <Pressable className="p-4" onPress={() => toggleFaq(3)}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-slate-800">{AUTH_MESSAGES.faq3Question}</Text>
            <Text className="text-xs text-slate-400">{openFaq === 3 ? "▲" : "▼"}</Text>
          </View>
          {openFaq === 3 ? (
            <Text className="mt-2 text-[11px] leading-4 text-slate-500">
              {AUTH_MESSAGES.faq3Answer}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {/* Station Hotline Box */}
      <View
        className="mb-5 rounded-2xl border border-slate-200 bg-white p-4"
        style={{ borderRadius: 16 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {AUTH_MESSAGES.facilityCentral}
            </Text>
            <Text className="text-sm font-bold text-slate-900">{AUTH_MESSAGES.hotlineCentral}</Text>
            <Text className="text-[11px] text-slate-500">{AUTH_MESSAGES.hotlineWorkingHours}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            className="flex-row items-center rounded-xl bg-[#125345] px-4 py-2.5 active:bg-[#0d3f34]"
            onPress={() => void auth.callHotline(AUTH_MESSAGES.hotlineCentral)}
            style={{ borderRadius: 10 }}
          >
            <Text className="mr-1 text-xs text-white">📞</Text>
            <Text className="text-xs font-bold text-white">{AUTH_MESSAGES.callNowBtn}</Text>
          </Pressable>
        </View>
      </View>

      {/* Back Link */}
      <View className="items-center pb-6">
        <Pressable onPress={() => auth.setMode("register")}>
          <Text className="text-xs font-semibold text-slate-600">
            ← {AUTH_MESSAGES.backToRegisterBtn}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const username = parts[0] || "";
  const domain = parts[1] || "";
  if (username.length <= 2) {
    return `${username}***@${domain}`;
  }
  const prefix = username.slice(0, 2);
  return `${prefix}*******@${domain}`;
}
