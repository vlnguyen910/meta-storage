import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { type ReactNode, useEffect, useRef } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { Authentication } from "../../../common/auth.types";
import { Icon, IconButton, Notice, ScreenFrame } from "../../../components/ui";
import { AUTHENTICATION as M } from "../authentication.messages";

export function AuthenticationLayout({
  auth,
  title,
  children,
  compact = false,
  onBack,
  footer,
}: {
  auth: Authentication;
  title: string;
  children: ReactNode;
  compact?: boolean;
  onBack?: () => void;
  footer: ReactNode;
}) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") document.title = `${title} | ${M.brand}`;
  }, [title]);
  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        className="flex-1 bg-surface"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="grow"
        >
          <View className="flex-1">
            {onBack ? (
              <View className="flex-row px-4 pt-2">
                <IconButton
                  icon={ArrowLeft}
                  label={M.back}
                  onPress={onBack}
                  disabled={auth.pending}
                />
              </View>
            ) : null}
            <View
              role={Platform.OS === "web" ? "main" : undefined}
              className={`flex-1 justify-center px-6 ${compact ? "py-6" : "py-10"}`}
            >
              <View className="mx-auto w-full max-w-md">{children}</View>
            </View>
            <View className="border-t border-line bg-canvas px-6 py-4">
              <View className="mx-auto w-full max-w-md items-center gap-2">{footer}</View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

export function AuthenticationHeader({
  title,
  compact = false,
}: {
  title: string;
  compact?: boolean;
}) {
  return (
    <View className={`items-center ${compact ? "mb-6" : "mb-10"}`}>
      <Brand />
      <Title>{title}</Title>
    </View>
  );
}

export function AuthenticationAccountFooter({ auth }: { auth: Authentication }) {
  const register = auth.page === "register";
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-x-2">
      <Text className="font-body text-label text-muted">
        {register ? M.hasAccount : M.noAccount}
      </Text>
      <TextAction
        label={register ? M.login : M.registerNow}
        disabled={auth.pending}
        onPress={() => auth.navigate(register ? "login" : "register")}
      />
    </View>
  );
}

export function AuthenticationSecurityNote({ children }: { children: string }) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      <Icon as={ShieldCheck} size={16} className="text-primary" />
      <Text className="shrink text-center font-body text-[12px] leading-5 text-muted">
        {children}
      </Text>
    </View>
  );
}

export function Brand() {
  return (
    <View className="items-center gap-1">
      <Image
        source={require("../../../../assets/logo/logo.png")}
        accessible={false}
        resizeMode="contain"
        className="h-[48px] w-[68px] web:h-[48px]! web:w-[68px]!"
      />
      <Text className="font-body-bold text-[12px] tracking-[2px] text-primary">
        {M.brand.toUpperCase()}
      </Text>
    </View>
  );
}

export function Title({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      aria-level={Platform.OS === "web" ? 1 : undefined}
      className="mt-4 text-center font-body-bold text-title leading-9 text-ink"
    >
      {children}
    </Text>
  );
}

export function TextAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch justify-center rounded-control px-1 web:focus-visible:outline-2 web:focus-visible:outline-ring ${disabled ? "opacity-55" : ""}`}
    >
      <Text className="font-body-semibold text-label text-primary">{label}</Text>
    </Pressable>
  );
}

export function Feedback({ auth }: { auth: Authentication }) {
  return auth.error ? (
    <Notice error>{auth.error}</Notice>
  ) : auth.feedback ? (
    <Notice>{auth.feedback}</Notice>
  ) : null;
}
