import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ScreenFrame } from "../../components/ui/screen-frame";
import { AUTH_MESSAGES } from "./auth.messages";
import { ForgotPasswordView } from "./forgot-password-view";
import { LoginView } from "./login-view";
import { RegisterView } from "./register-view";
import { useAuthFlow } from "./use-auth-flow";
import { VerifyEmailView } from "./verify-email-view";

export function AuthScreen({ onBack, callbackUrl }: { onBack?: () => void; callbackUrl?: string }) {
  const auth = useAuthFlow(callbackUrl);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (auth.mode !== "login") {
        auth.setMode("login");
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [auth.mode, auth.setMode, onBack]);

  if (auth.isSessionPending) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f8faf9]">
        <StatusBar style="dark" />
        <ActivityIndicator
          accessibilityLabel="Đang tải phiên đăng nhập"
          color="#125345"
          size="large"
        />
      </View>
    );
  }

  return (
    <ScreenFrame>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Top App Bar - Adaptive to Figma specs */}
        <View className="h-14 flex-row items-center justify-between border-b border-slate-200/80 bg-white px-4 shadow-xs">
          {auth.mode === "forgot-password" ? (
            // M-A04 Header: [← Đăng nhập] [storeX •] [📞]
            <View className="flex-1 flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 py-1.5 pr-2 active:opacity-70"
                onPress={() => auth.setMode("login")}
              >
                <Text className="text-base text-slate-800">←</Text>
                <Text className="text-xs font-semibold text-slate-800">
                  {AUTH_MESSAGES.backToLoginBtn.replace("Quay lại ", "")}
                </Text>
              </Pressable>

              <View className="flex-row items-center gap-1">
                <Text className="text-lg font-black text-[#125345]">{AUTH_MESSAGES.brandName}</Text>
                <Text className="text-sm font-bold text-emerald-400">●</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100"
                onPress={() => void auth.callHotline()}
              >
                <Text className="text-lg text-slate-800">📞</Text>
              </Pressable>
            </View>
          ) : auth.mode === "login" ? (
            // M-A01 Header: [← Trở lại] [[+] storeX] [📞]
            <View className="flex-1 flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-1 py-1.5 pr-2 active:opacity-70"
                onPress={() => {
                  // Switch to register or back
                  onBack?.();
                }}
              >
                <Text className="text-base text-slate-800">←</Text>
                <Text className="text-xs font-semibold text-slate-800">{AUTH_MESSAGES.back}</Text>
              </Pressable>

              <View className="flex-row items-center gap-1.5">
                <View className="h-6 w-6 items-center justify-center rounded bg-[#125345]">
                  <Text className="text-xs font-black text-white">◫</Text>
                </View>
                <Text className="text-lg font-black text-[#125345]">{AUTH_MESSAGES.brandName}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100"
                onPress={() => void auth.callHotline()}
              >
                <Text className="text-lg text-slate-800">📞</Text>
              </Pressable>
            </View>
          ) : auth.mode === "register" ? (
            // M-A02 Header: [←] [[+] storeX] [Đăng nhập]
            <View className="flex-1 flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100"
                onPress={() => auth.setMode("login")}
              >
                <Text className="text-xl font-bold text-slate-800">←</Text>
              </Pressable>

              <View className="flex-row items-center gap-1.5">
                <View className="h-6 w-6 items-center justify-center rounded bg-[#125345]">
                  <Text className="text-xs font-black text-white">◫</Text>
                </View>
                <Text className="text-lg font-black text-[#125345]">{AUTH_MESSAGES.brandName}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                className="py-1 px-2"
                onPress={() => auth.setMode("login")}
              >
                <Text className="text-xs font-bold text-[#125345]">Đăng nhập</Text>
              </Pressable>
            </View>
          ) : (
            // A03 Header: [←] [Xác thực khách hàng] [?]
            <View className="flex-1 flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100"
                onPress={() => auth.setMode("register")}
              >
                <Text className="text-xl font-bold text-slate-800">←</Text>
              </Pressable>

              <Text className="text-base font-bold text-slate-900">
                {AUTH_MESSAGES.verificationTitle}
              </Text>

              <Pressable
                accessibilityRole="button"
                className="h-8 w-8 items-center justify-center rounded-full active:bg-slate-100"
                onPress={() => void auth.callHotline()}
              >
                <Text className="text-base text-slate-600">?</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Scrollable Body */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-[440px]">
            {auth.user ? (
              <View className="items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <Text className="text-2xl text-emerald-800">👤</Text>
                </View>
                <Text className="text-xl font-bold text-slate-900">Xin chào, {auth.user.name}</Text>
                <Text className="text-center text-xs text-slate-500">{auth.user.email}</Text>
                <Pressable
                  accessibilityRole="button"
                  className="mt-2 min-h-11 items-center justify-center rounded-xl bg-[#125345] px-6 active:bg-[#0d3f34]"
                  onPress={() => void auth.signOut()}
                >
                  <Text className="text-sm font-bold text-white">Đăng xuất</Text>
                </Pressable>
              </View>
            ) : auth.mode === "register" ? (
              <RegisterView auth={auth} />
            ) : auth.mode === "verify-email" ? (
              <VerifyEmailView auth={auth} />
            ) : auth.mode === "forgot-password" ? (
              <ForgotPasswordView auth={auth} />
            ) : (
              <LoginView auth={auth} onBrowse={onBack} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}
