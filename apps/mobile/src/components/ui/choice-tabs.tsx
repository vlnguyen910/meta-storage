import { Pressable, ScrollView, Text, View } from "react-native";
import type { ChoiceTabsProps } from "../../common/app-ui.types";
export function ChoiceTabs<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  variant = "pills",
}: ChoiceTabsProps<T>) {
  const segmented = variant === "segmented";
  const content = (
    <View
      accessibilityRole="tablist"
      className={segmented ? "flex-row rounded-control bg-customer-subtle p-1" : "flex-row gap-2"}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityLabel={`${option.label}${option.count === undefined ? "" : ` (${option.count})`}`}
          accessibilityState={{ selected: value === option.value, disabled }}
          aria-selected={value === option.value}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          className={`min-h-touch flex-row flex-wrap items-center justify-center gap-1 py-2 web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring ${segmented ? "min-w-0 flex-1 rounded-control px-2" : "rounded-full border px-4"} ${value === option.value ? "border-primary bg-primary active:bg-primary-dark" : segmented ? "border-transparent bg-transparent" : "border-outline-variant bg-surface active:bg-primary-soft"} ${disabled ? "opacity-55" : ""}`}
        >
          <Text
            className={`shrink font-body-semibold ${segmented ? "text-[12px] leading-5" : "text-label leading-6"} ${value === option.value ? "text-primary-foreground" : segmented ? "text-customer-muted" : "text-muted"}`}
          >
            {option.label}
          </Text>
          {option.count !== undefined ? (
            <View
              className={`min-w-[18px] items-center rounded-full px-1 ${value === option.value ? "bg-customer-mint" : "bg-surface"}`}
            >
              <Text className="font-body-semibold text-[10px] leading-4 text-primary">
                {option.count}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
  return segmented ? (
    <View className="mb-4">{content}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      {content}
    </ScrollView>
  );
}
