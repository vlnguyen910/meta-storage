import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CALENDAR_UI as M } from "./calendar-field.messages";
import { Icon } from "./icon";

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
      <Text className="mb-2 font-body-semibold text-label leading-6 text-ink">{label}</Text>
      <View className="rounded-card border border-outline-variant bg-surface p-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.previous}
            disabled={disabled || month <= minDate.slice(0, 7)}
            accessibilityState={{ disabled: disabled || month <= minDate.slice(0, 7) }}
            onPress={() => shift(-1)}
            className="min-h-touch min-w-touch items-center justify-center rounded-control active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-ring"
          >
            <Icon
              as={ChevronLeft}
              className={
                disabled || month <= minDate.slice(0, 7) ? "text-muted/40" : "text-primary"
              }
            />
          </Pressable>
          <Text className="font-body-bold text-label text-ink">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.next}
            disabled={disabled}
            accessibilityState={{ disabled }}
            onPress={() => shift(1)}
            className="min-h-touch min-w-touch items-center justify-center rounded-control active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-ring"
          >
            <Icon as={ChevronRight} className={disabled ? "text-muted/40" : "text-primary"} />
          </Pressable>
        </View>
        <View className="flex-row">
          {M.days.map((day) => (
            <Text
              key={day}
              className="flex-1 pb-3 text-center font-body-bold text-[12px] text-muted"
            >
              {day}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week.key} className="flex-row">
            {week.cells.map(({ day, date }) => {
              return day < 1 || day > days ? (
                <View key={date} className="min-h-touch flex-1" />
              ) : (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={date}
                  accessibilityState={{
                    selected: date === value,
                    disabled: disabled || date < minDate,
                  }}
                  aria-pressed={date === value}
                  disabled={disabled || date < minDate}
                  onPress={() => onChange(date)}
                  className={`min-h-touch flex-1 items-center justify-center rounded-control web:focus-visible:outline-2 web:focus-visible:outline-ring ${date === value ? "bg-primary" : "bg-transparent active:bg-primary-soft"}`}
                >
                  <Text
                    className={`font-body-semibold text-label ${date === value ? "text-primary-foreground" : disabled || date < minDate ? "text-muted/40" : "text-ink"}`}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {error && (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-2 font-body text-label text-danger-strong"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
