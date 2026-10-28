import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CALENDAR_UI as M } from "./calendar-field.messages";

export function facilityDay(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function CalendarField({
  label,
  value,
  onChange,
  minDate = facilityDay(),
  error,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [month, setMonth] = useState((value || minDate).slice(0, 7));
  useEffect(() => {
    if (value) setMonth(value.slice(0, 7));
  }, [value]);
  const [year = 2026, number = 1] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const shift = (offset: number) =>
    setMonth(new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7));
  const title = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, number - 1, 1)));
  const weeks = Array.from({ length: Math.ceil((first + days) / 7) }, (_, week) => ({
    key: `${month}-${week * 7 - first + 1}`,
    cells: Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - first + 1;
      return { day, date: `${month}-${String(day).padStart(2, "0")}` };
    }),
  }));
  return (
    <View className="mb-4">
      <Text className="mb-2 font-semibold text-slate-900">{label}</Text>
      <View className="rounded-2xl border border-slate-200 bg-white p-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.previous}
            disabled={disabled || month <= minDate.slice(0, 7)}
            onPress={() => shift(-1)}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <Text className={month <= minDate.slice(0, 7) ? "text-slate-300" : "text-emerald-800"}>
              ‹
            </Text>
          </Pressable>
          <Text className="font-bold text-slate-900">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.next}
            disabled={disabled}
            onPress={() => shift(1)}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <Text className="text-emerald-800">›</Text>
          </Pressable>
        </View>
        <View className="flex-row">
          {M.days.map((day) => (
            <Text key={day} className="flex-1 pb-3 text-center text-xs font-bold text-slate-500">
              {day}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week.key} className="flex-row">
            {week.cells.map(({ day, date }) => {
              return day < 1 || day > days ? (
                <View key={date} className="min-h-11 flex-1" />
              ) : (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={date}
                  accessibilityState={{
                    selected: date === value,
                    disabled: disabled || date < minDate,
                  }}
                  disabled={disabled || date < minDate}
                  onPress={() => onChange(date)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-lg ${date === value ? "bg-emerald-800" : "bg-transparent"}`}
                >
                  <Text
                    className={`text-sm font-semibold ${date === value ? "text-white" : date < minDate ? "text-slate-300" : "text-slate-800"}`}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {error && <Text className="mt-2 text-sm text-red-700">{error}</Text>}
    </View>
  );
}
