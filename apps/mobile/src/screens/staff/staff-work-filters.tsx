import { CalendarDays, ChevronDown, Search, SlidersHorizontal } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import type { StaffWorkFilters, StaffWorkGroup } from "../../common/staff-api.types";
import { CalendarField, facilityDay } from "../../components/ui/calendar-field";
import { ChoiceTabs } from "../../components/ui/choice-tabs";
import { Icon } from "../../components/ui/icon";
import { Button } from "../../components/ui/mobile-ui";
import { STAFF_API_UI as M } from "../../features/staff-api/staff-api.messages";
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
    <View className="mb-3 flex-row gap-1 rounded-xl border border-outline-variant bg-customer-canvas p-1">
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
          className={`min-h-10 min-w-0 flex-1 flex-row items-center justify-center gap-1 rounded-lg px-2 ${tab.value === value ? "bg-primary" : "bg-transparent active:bg-primary-soft"}`}
        >
          <Text
            numberOfLines={1}
            className={`font-body-semibold text-[11px] ${tab.value === value ? "text-primary-foreground" : "text-muted"}`}
          >
            {tab.label}
          </Text>
          {counts && (
            <Text
              className={`min-w-5 rounded-full px-1 text-center font-body-bold text-[10px] ${tab.value === value ? "bg-customer-mint text-primary" : "bg-surface text-muted"}`}
            >
              {counts[tab.value]}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function staffFilterDate(date: string) {
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
  const [initialCalendar, setInitialCalendar] = useState(false);
  const kindLabel =
    filters.kind === "appointment"
      ? M.bookings
      : filters.kind === "task"
        ? M.tasks
        : filters.kind === "return"
          ? M.returns
          : M.allWork;
  const openSheet = (showCalendar = false) => {
    Keyboard.dismiss();
    setInitialCalendar(showCalendar);
    setOpen(true);
  };
  return (
    <View className="mb-3 gap-2 rounded-xl border border-outline-variant bg-surface p-2.5">
      <View className="flex-row gap-1.5">
        {(
          [
            { value: "today", label: M.today },
            { value: "all", label: M.allDates },
          ] as const
        ).map((option) => {
          const selected =
            option.value === "today" ? filters.date === facilityDay() : !filters.date;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() =>
                onChange({ ...filters, date: option.value === "today" ? facilityDay() : "" })
              }
              className={`min-h-9 items-center justify-center rounded-lg px-3 ${selected ? "bg-primary" : "border border-outline-variant bg-surface active:bg-primary-soft"}`}
            >
              <Text
                className={`font-body-semibold text-[11px] ${selected ? "text-primary-foreground" : "text-muted"}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.chooseDate}
          onPress={() => openSheet(true)}
          className="min-h-9 min-w-0 flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-outline-variant bg-surface px-2 active:bg-primary-soft"
        >
          <Icon as={CalendarDays} size={13} className="text-primary" />
          <Text numberOfLines={1} className="font-body-medium text-[11px] text-muted">
            {filters.date && filters.date !== facilityDay()
              ? staffFilterDate(filters.date)
              : M.chooseDate}
          </Text>
        </Pressable>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={M.chooseKind}
          onPress={() => openSheet()}
          className="min-h-10 max-w-[45%] flex-row items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-2.5 active:bg-primary-soft"
        >
          <Icon as={SlidersHorizontal} size={14} className="text-primary" />
          <Text numberOfLines={1} className="font-body-semibold text-[11px] text-ink">
            {kindLabel}
          </Text>
          <Icon as={ChevronDown} size={13} className="text-muted" />
        </Pressable>
        <View className="min-h-10 min-w-0 flex-1 flex-row items-center rounded-lg border border-outline-variant bg-surface pl-2.5">
          <Icon as={Search} size={15} className="text-muted" />
          <TextInput
            accessibilityLabel={M.search}
            placeholder={M.searchPlaceholder}
            placeholderTextColor="#64748b"
            value={filters.search}
            onChangeText={(search) => onChange({ ...filters, search })}
            autoCorrect={false}
            returnKeyType="search"
            className="min-h-10 min-w-0 flex-1 px-2 py-1 font-body text-[11px] text-ink placeholder:text-muted"
          />
          {!!filters.search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={M.clearSearch}
              onPress={() => onChange({ ...filters, search: "" })}
              className="min-h-10 min-w-9 items-center justify-center"
            >
              <Text className="font-body text-lg text-muted">×</Text>
            </Pressable>
          )}
        </View>
      </View>
      {open && (
        <StaffFilterSheet
          filters={filters}
          initialCalendar={initialCalendar}
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
  initialCalendar,
  onClose,
  onApply,
}: {
  filters: StaffWorkFilters;
  initialCalendar: boolean;
  onClose: () => void;
  onApply: (values: Pick<StaffWorkFilters, "date" | "kind">) => void;
}) {
  const [kind, setKind] = useState(filters.kind);
  const [date, setDate] = useState(filters.date);
  const [calendar, setCalendar] = useState(initialCalendar);
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
                setDate("");
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
