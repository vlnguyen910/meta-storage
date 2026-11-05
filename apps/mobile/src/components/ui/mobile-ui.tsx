import { Eye, EyeOff } from "lucide-react-native";
import { useId, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type {
  MobileButtonProps,
  MobileButtonVariant,
  MobileCardProps,
  MobileFieldProps,
} from "../../common/mobile-ui.types";
import { IconButton } from "./app-ui";
import { APP_UI } from "./app-ui.messages";
import { ThemedActivityIndicator, ThemedTextInput } from "./native-styles";

const buttonVariants: Record<MobileButtonVariant, { container: string; label: string }> = {
  primary: {
    container: "bg-primary active:bg-primary-dark",
    label: "text-primary-foreground",
  },
  secondary: {
    container: "bg-secondary active:bg-ink",
    label: "text-primary-foreground",
  },
  outline: {
    container: "border border-outline-variant bg-surface active:bg-primary-soft",
    label: "text-primary",
  },
  ghost: { container: "bg-transparent active:bg-neutral-soft", label: "text-muted" },
  danger: {
    container: "bg-danger-strong active:bg-danger-strong/80",
    label: "text-primary-foreground",
  },
};

export function Card({ children, title }: MobileCardProps) {
  return (
    <View className="mb-4 rounded-card border border-line bg-surface p-card shadow-soft">
      {title ? (
        <Text
          accessibilityRole="header"
          className="mb-3 font-body-bold text-[18px] leading-7 text-ink"
        >
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
  loading = false,
  leadingIcon,
  variant,
  secondary,
  danger,
  hint,
  accessibilityState,
  ...props
}: MobileButtonProps) {
  const appearance =
    buttonVariants[variant ?? (danger ? "danger" : secondary ? "outline" : "primary")];
  const unavailable = disabled || loading;
  return (
    <View className="mb-2">
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ ...accessibilityState, disabled: !!unavailable, busy: loading }}
        aria-busy={loading}
        disabled={unavailable}
        onPress={onPress}
        className={`min-h-control flex-row items-center justify-center gap-2 rounded-control px-4 py-3 web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring ${appearance.container} ${unavailable ? "opacity-55" : ""}`}
      >
        {loading ? (
          <ThemedActivityIndicator
            aria-hidden={true}
            accessible={false}
            color={Platform.OS === "web" ? "currentColor" : undefined}
            className={appearance.label}
          />
        ) : (
          leadingIcon
        )}
        <Text
          className={`min-w-0 shrink text-center font-body-bold text-label leading-6 ${appearance.label}`}
        >
          {label}
        </Text>
      </Pressable>
      {hint ? <Text className="mt-1 font-body text-label leading-5 text-muted">{hint}</Text> : null}
    </View>
  );
}
export function Field({
  label,
  error,
  hint,
  ref,
  labelAction,
  secureTextEntry,
  ...props
}: MobileFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="shrink font-body-semibold text-label leading-6 text-ink">{label}</Text>
        {labelAction}
      </View>
      <View className="relative">
        <ThemedTextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderClassName="text-muted"
          selectionClassName="text-primary"
          accessibilityState={{ disabled: props.editable === false }}
          aria-describedby={Platform.OS === "web" && (error || hint) ? descriptionId : undefined}
          {...props}
          secureTextEntry={secureTextEntry && !passwordVisible}
          aria-invalid={!!error}
          className={`min-h-control rounded-control border bg-surface px-3 py-3 font-body text-body leading-6 text-ink placeholder:text-muted web:focus:outline-2 web:focus:outline-offset-2 web:focus:outline-ring ${secureTextEntry ? "pr-14" : ""} ${error ? "border-danger-strong focus:border-danger-strong" : "border-outline-variant focus:border-primary"} ${props.editable === false ? "opacity-55" : ""}`}
        />
        {secureTextEntry ? (
          <View className="absolute inset-y-0 right-1 justify-center">
            <IconButton
              icon={passwordVisible ? EyeOff : Eye}
              label={passwordVisible ? APP_UI.hidePassword : APP_UI.showPassword}
              onPress={() => setPasswordVisible((visible) => !visible)}
              disabled={props.editable === false}
            />
          </View>
        ) : null}
      </View>
      {error ? (
        <Text
          nativeID={descriptionId}
          accessibilityLiveRegion="polite"
          className="mt-1 font-body text-label leading-5 text-danger-strong"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text nativeID={descriptionId} className="mt-1 font-body text-label leading-5 text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
export function Notice({ children, error = false }: { children: string; error?: boolean }) {
  return (
    <View
      className={`mb-4 rounded-control border p-3 ${error ? "border-danger-line bg-danger-soft" : "border-outline-variant bg-primary-soft"}`}
    >
      <Text
        accessibilityLiveRegion="polite"
        className={`font-body text-label leading-6 ${error ? "text-danger-strong" : "text-primary"}`}
      >
        {children}
      </Text>
    </View>
  );
}
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row flex-wrap justify-between gap-2 border-b border-line pb-2">
      <Text className="shrink font-body text-label leading-6 text-muted">{label}</Text>
      <Text className="min-w-0 flex-1 text-right font-body-semibold text-label leading-6 text-ink">
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
      className="mb-4 font-body-bold text-title leading-8 text-ink"
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
