import { Pressable, ScrollView, Text, View } from "react-native";

export function ChoiceTabs<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      <View accessibilityRole="tablist" className="flex-row gap-2">
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: value === option.value, disabled }}
            aria-selected={value === option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`min-h-touch justify-center rounded-full border px-4 py-2 web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring ${value === option.value ? "border-primary bg-primary active:bg-primary-dark" : "border-outline-variant bg-surface active:bg-primary-soft"} ${disabled ? "opacity-55" : ""}`}
          >
            <Text
              className={`font-body-semibold text-label leading-6 ${value === option.value ? "text-primary-foreground" : "text-muted"}`}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
