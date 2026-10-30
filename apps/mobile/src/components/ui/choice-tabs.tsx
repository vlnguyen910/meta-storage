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
      <View className="flex-row gap-2">
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: value === option.value, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`min-h-11 justify-center rounded-full border px-4 ${value === option.value ? "border-emerald-900 bg-emerald-900" : "border-slate-200 bg-white"}`}
          >
            <Text
              className={`text-sm font-semibold ${value === option.value ? "text-white" : "text-slate-600"}`}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
