import { useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { CalendarField, facilityDay } from "../../components/ui/calendar-field";
import { ChoiceTabs } from "../../components/ui/choice-tabs";
import { Button } from "../../components/ui/mobile-ui";
import { STAFF_API_UI as M } from "./staff-api.messages";
import type { StaffWorkFilters, StaffWorkGroup } from "./staff-api.types";
import { StaffSheet } from "./staff-sheet";

export function StaffStatusTabs({
  value,
  counts,
  onChange,
}: {
  value: StaffWorkGroup;
  counts?: Record<StaffWorkGroup, number>;
  onChange: (value: StaffWorkGroup) => void;
}) {
  return (
    <View className="mb-4 flex-row gap-1 rounded-2xl bg-slate-100 p-1">
      {(
        [
          { value: "pending", label: M.pending },
          { value: "done", label: M.done },
          { value: "closed", label: M.closedShort },
        ] as const
      ).map((tab) => (
        <Pressable
          key={tab.value}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.value === value }}
          onPress={() => onChange(tab.value)}
          className={`min-h-11 min-w-0 flex-1 flex-row items-center justify-center gap-1 rounded-xl px-2 ${tab.value === value ? "bg-emerald-900" : "bg-transparent"}`}
        >
          <Text
            numberOfLines={1}
            className={`text-xs font-semibold ${tab.value === value ? "text-white" : "text-slate-600"}`}
          >
            {tab.label}
          </Text>
          {counts && (
            <Text
              className={`text-[10px] font-bold ${tab.value === value ? "text-emerald-100" : "text-slate-500"}`}
            >
              {counts[tab.value]}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function staffFilterDate(date: string) {
  return date === facilityDay()
    ? M.today
    : date
      ? new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(`${date}T12:00:00+07:00`))
      : M.allDates;
}
export function StaffWorkFiltersBar({
  filters,
  onChange,
}: {
  filters: StaffWorkFilters;
  onChange: (value: StaffWorkFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const kindLabel =
    filters.kind === "appointment"
      ? M.bookings
      : filters.kind === "task"
        ? M.tasks
        : filters.kind === "return"
          ? M.returns
          : M.allWork;
  const openSheet = () => {
    Keyboard.dismiss();
    setOpen(true);
  };
  return (
    <View className="mb-3">
      <View className="flex-row items-center gap-2">
        <View className="min-h-11 min-w-0 flex-1 flex-row items-center rounded-xl border border-slate-200 bg-white pl-3">
          <Text className="mr-2 text-2xl text-slate-400">⌕</Text>
          <TextInput
            accessibilityLabel={M.search}
            placeholder={M.searchPlaceholder}
            placeholderTextColor="#64748b"
            value={filters.search}
            onChangeText={(search) => onChange({ ...filters, search })}
            autoCorrect={false}
            returnKeyType="search"
            className="min-h-11 min-w-0 flex-1 py-2 text-sm text-slate-900"
          />
          {!!filters.search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={M.clearSearch}
              onPress={() => onChange({ ...filters, search: "" })}
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <Text className="text-xl text-slate-500">×</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.filters}
          onPress={openSheet}
          className="min-h-11 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3"
        >
          <Text className="text-lg text-emerald-900">☷</Text>
          <Text className="text-sm font-semibold text-slate-800">{M.filterButton}</Text>
        </Pressable>
      </View>
      <View className="mt-1 flex-row flex-wrap gap-x-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filters.date ? M.clearDate : M.chooseDate}
          onPress={filters.date ? () => onChange({ ...filters, date: "" }) : openSheet}
          className="min-h-11 flex-row items-center gap-2 px-1"
        >
          <Text className="text-xs font-medium text-emerald-900">
            {staffFilterDate(filters.date)}
          </Text>
          <Text className="text-sm text-emerald-700">{filters.date ? "×" : "⌄"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filters.kind !== "all" ? M.clearKind : M.chooseKind}
          onPress={filters.kind !== "all" ? () => onChange({ ...filters, kind: "all" }) : openSheet}
          className="min-h-11 flex-row items-center gap-2 px-1"
        >
          <Text className="text-xs font-medium text-slate-600">{kindLabel}</Text>
          <Text className="text-sm text-slate-500">{filters.kind !== "all" ? "×" : "⌄"}</Text>
        </Pressable>
      </View>
      {open && (
        <StaffFilterSheet
          filters={filters}
          onClose={() => setOpen(false)}
          onApply={(next) => {
            onChange({ ...filters, ...next });
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

function StaffFilterSheet({
  filters,
  onClose,
  onApply,
}: {
  filters: StaffWorkFilters;
  onClose: () => void;
  onApply: (values: Pick<StaffWorkFilters, "date" | "kind">) => void;
}) {
  const [kind, setKind] = useState(filters.kind);
  const [date, setDate] = useState(filters.date);
  const [calendar, setCalendar] = useState(false);
  return (
    <StaffSheet
      title={M.filters}
      onClose={onClose}
      footer={
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              secondary
              label={M.resetFilters}
              onPress={() => {
                setKind("all");
                setDate(facilityDay());
                setCalendar(false);
              }}
            />
          </View>
          <View className="flex-1">
            <Button label={M.applyFilters} onPress={() => onApply({ kind, date })} />
          </View>
        </View>
      }
    >
      <Text className="mb-3 text-sm font-bold text-slate-900">{M.workType}</Text>
      <ChoiceTabs
        options={[
          { value: "all", label: M.all },
          { value: "appointment", label: M.bookings },
          { value: "return", label: M.returns },
          { value: "task", label: M.tasks },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Text className="mb-3 mt-3 text-sm font-bold text-slate-900">{M.date}</Text>
      <ChoiceTabs
        options={[
          { value: "today", label: M.today },
          { value: "all", label: M.allDates },
          { value: "custom", label: M.customDate },
        ]}
        value={calendar ? "custom" : date === facilityDay() ? "today" : date ? "custom" : "all"}
        onChange={(value) => {
          setCalendar(value === "custom");
          if (value !== "custom") setDate(value === "today" ? facilityDay() : "");
        }}
      />
      {calendar && (
        <CalendarField
          label={M.chooseDate}
          value={date || facilityDay()}
          minDate="2020-01-01"
          onChange={setDate}
        />
      )}
      <Text className="mb-2 text-sm text-slate-500">
        {M.date}: {staffFilterDate(date)}
      </Text>
    </StaffSheet>
  );
}
