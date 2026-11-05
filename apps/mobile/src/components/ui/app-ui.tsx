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
import { Image, Pressable, Text, type TextInput, View } from "react-native";
import type {
  AppHeaderProps,
  BottomTabsProps,
  CustomerTab,
  IconButtonProps,
  ListItemProps,
  SearchFieldProps,
} from "../../common/app-ui.types";
import { APP_UI as M } from "./app-ui.messages";
import { Icon } from "./icon";
import { ThemedTextInput } from "./native-styles";

const customerTabs = [
  { key: "home", label: M.tabs.home, icon: House },
  { key: "rentals", label: M.tabs.rentals, icon: Warehouse },
  { key: "profile", label: M.tabs.profile, icon: CircleUserRound },
] as const satisfies readonly { key: CustomerTab; label: string; icon: IconButtonProps["icon"] }[];

export function IconButton({ icon, label, onPress, disabled = false }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch min-w-touch items-center justify-center rounded-control active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring ${disabled ? "opacity-55" : ""}`}
    >
      <Icon as={icon} className="text-primary" />
    </Pressable>
  );
}

export function AppHeader({ onHome, onBack, onNotifications }: AppHeaderProps) {
  return (
    <View className="border-b border-line bg-surface px-4 py-2">
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
            className="h-[32px] w-[44px] web:h-[32px]! web:w-[44px]!"
          />
          <Text numberOfLines={1} className="shrink font-body-bold text-[20px] text-primary">
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
    <View className="border-t border-line bg-surface px-4 py-2">
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
              className="min-h-touch min-w-touch flex-1 items-center justify-center gap-1 rounded-control py-1 active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
            >
              <View
                className={`items-center justify-center rounded-full px-5 py-1 ${active ? "bg-primary-soft" : "bg-transparent"}`}
              >
                <Icon as={tab.icon} className={active ? "text-primary" : "text-muted"} />
              </View>
              <Text
                className={`text-[12px] leading-5 ${active ? "font-body-bold text-primary" : "font-body-medium text-muted"}`}
              >
                {label}
              </Text>
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
}: SearchFieldProps) {
  const input = useRef<TextInput>(null);
  return (
    <View
      className={`mb-4 min-h-control flex-row items-center rounded-control border border-outline-variant bg-surface px-1 ${disabled ? "opacity-55" : ""}`}
    >
      <View className="min-h-touch min-w-touch items-center justify-center">
        <Icon as={Search} className="text-muted" />
      </View>
      <ThemedTextInput
        ref={input}
        accessibilityLabel={label}
        editable={!disabled}
        aria-disabled={disabled}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderClassName="text-muted"
        selectionClassName="text-primary"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => onSubmit?.(value.trim())}
        className="min-h-control min-w-0 flex-1 rounded-control px-1 py-2 font-body text-body leading-6 text-ink placeholder:text-muted web:focus:outline-2 web:focus:outline-offset-2 web:focus:outline-ring"
      />
      {value && !disabled ? (
        <IconButton
          icon={X}
          label={M.clearSearch}
          onPress={() => {
            onChangeText("");
            input.current?.focus();
          }}
        />
      ) : null}
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
