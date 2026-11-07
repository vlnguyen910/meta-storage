import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleUserRound,
  House,
  Search,
  Warehouse,
  X,
} from "lucide-react-native";
import { useRef } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import type {
  ActionLinkProps,
  AppHeaderProps,
  BottomTabsProps,
  CustomerTab,
  IconButtonProps,
  ListItemProps,
  SearchFieldProps,
  SectionHeadingProps,
} from "../../common/app-ui.types";
import { APP_UI as M } from "./app-ui.messages";
import { Icon } from "./icon";

const customerTabs = [
  { key: "home", label: M.tabs.home, icon: House },
  { key: "rentals", label: M.tabs.rentals, icon: Warehouse },
  { key: "profile", label: M.tabs.profile, icon: CircleUserRound },
] as const satisfies readonly { key: CustomerTab; label: string; icon: IconButtonProps["icon"] }[];

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  inverse = false,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch min-w-touch items-center justify-center rounded-control ${inverse ? "active:bg-white/15" : "active:bg-primary-soft"} web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring ${disabled ? "opacity-55" : ""}`}
    >
      <Icon as={icon} className={inverse ? "text-primary-foreground" : "text-primary"} />
    </Pressable>
  );
}

export function AppHeader({ onHome, onBack, onNotifications }: AppHeaderProps) {
  return (
    <View className="bg-transparent px-4 py-2">
      <View className="mx-auto w-full max-w-3xl flex-row items-center gap-2">
        {onBack ? <IconButton icon={ArrowLeft} label={M.back} onPress={onBack} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.home}
          onPress={onHome}
          className="min-h-touch min-w-0 flex-1 flex-row items-center gap-2 rounded-control web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
        >
          {/* RN Web sets local asset dimensions inline, so web sizing needs priority. */}
          <Image
            source={require("../../../assets/logo/logo.png")}
            accessible={false}
            resizeMode="contain"
            className="h-[28px] w-[36px] web:h-[28px]! web:w-[36px]!"
          />
          <Text numberOfLines={1} className="shrink font-body-bold text-[16px] text-primary">
            {M.brand}
          </Text>
        </Pressable>
        <IconButton icon={Bell} label={M.notifications} onPress={onNotifications} />
      </View>
    </View>
  );
}

export function BottomTabs({ selected, onSelect, labels }: BottomTabsProps) {
  return (
    <View className="border-t border-line bg-customer-canvas px-4 py-1">
      <View
        accessibilityRole="tablist"
        accessibilityLabel={M.navigation}
        className="mx-auto w-full max-w-3xl flex-row"
      >
        {customerTabs.map((tab) => {
          const active = selected === tab.key;
          const label = labels?.[tab.key] ?? tab.label;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() => onSelect(tab.key)}
              className="min-h-touch min-w-touch flex-1 items-center justify-center rounded-control py-1 active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
            >
              <View
                className={`min-w-[90px] items-center justify-center gap-1 rounded-control px-3 py-1 ${active ? "bg-customer-mint" : "bg-transparent"}`}
              >
                <Icon as={tab.icon} className={active ? "text-primary" : "text-muted"} />
                <Text
                  className={`text-[12px] leading-5 ${active ? "font-body-bold text-primary" : "font-body-medium text-muted"}`}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SearchField({
  label,
  value,
  onChangeText,
  placeholder = M.search,
  onSubmit,
  disabled = false,
  inverse = false,
  trailing,
}: SearchFieldProps) {
  const input = useRef<TextInput>(null);
  return (
    <View
      className={`min-h-control flex-row items-center rounded-control border px-1 ${inverse ? "border-white/25 bg-white/15" : "mb-4 border-outline-variant bg-surface"} ${disabled ? "opacity-55" : ""}`}
    >
      <View className="min-h-touch w-8 items-center justify-center">
        <Icon as={Search} size={18} className={inverse ? "text-white" : "text-muted"} />
      </View>
      <View className="min-w-0 flex-1">
        <TextInput
          ref={input}
          accessibilityLabel={label}
          editable={!disabled}
          aria-disabled={disabled}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          maxLength={200}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => onSubmit?.(value.trim())}
          className={`min-h-touch w-full rounded-control px-1 py-2 font-body leading-6 web:focus:outline-2 web:focus:outline-offset-2 web:focus:outline-ring ${inverse ? "text-[12px] text-primary-foreground placeholder:text-primary-foreground/85" : "text-body text-ink placeholder:text-muted"}`}
        />
      </View>
      {value && !disabled ? (
        <IconButton
          icon={X}
          inverse={inverse}
          label={M.clearSearch}
          onPress={() => {
            onChangeText("");
            input.current?.focus();
          }}
        />
      ) : null}
      {trailing ? <View className="shrink-0">{trailing}</View> : null}
    </View>
  );
}

export function ActionLink({
  disabled = false,
  label,
  onPress,
  icon = ChevronRight,
  warning = false,
}: ActionLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      className="min-h-touch min-w-touch flex-row items-center justify-between gap-2 rounded-control web:focus-visible:outline-2 web:focus-visible:outline-ring"
    >
      <Text
        className={`shrink font-body-semibold text-[12px] leading-5 ${warning ? "text-warning-strong" : "text-primary"}`}
      >
        {label}
      </Text>
      <Icon as={icon} size={16} className={warning ? "text-warning-strong" : "text-primary"} />
    </Pressable>
  );
}

export function SectionHeading({ title, actionLabel, onAction }: SectionHeadingProps) {
  return (
    <View className="mb-2 min-h-touch flex-row items-center justify-between gap-2">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full bg-primary" />
        <Text
          accessibilityRole="header"
          aria-level={2}
          className="shrink font-body-bold text-label leading-5 text-ink"
        >
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? <ActionLink label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ListItem({ label, description, icon, onPress }: ListItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-control flex-row items-center gap-3 rounded-control px-3 py-3 active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
    >
      <Icon as={icon} className="text-primary" />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-body-semibold text-label leading-6 text-ink">{label}</Text>
        {description ? (
          <Text className="font-body text-[12px] leading-5 text-muted">{description}</Text>
        ) : null}
      </View>
      <Icon as={ChevronRight} size={16} className="text-muted" />
    </Pressable>
  );
}
