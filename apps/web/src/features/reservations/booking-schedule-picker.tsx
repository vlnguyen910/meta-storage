"use client";

import type { CheckInSlotOption } from "@metastorage/contracts";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { checkoutMessages as m } from "./checkout.messages";
import { toLocalDateTimeInput } from "./checkout-validation";

function dateFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12)));
}

export function BookingSchedulePicker({
  date,
  onDateChange,
  slotId,
  onSlotChange,
  slots,
  minDate,
  dateTitle,
  slotTitle,
  dateHint,
  timeHint,
  slotsLoading = false,
  slotsError = false,
  onRetrySlots,
}: {
  date: string;
  onDateChange: (value: string) => void;
  slotId: string;
  onSlotChange: (value: string) => void;
  slots: CheckInSlotOption[];
  minDate: string;
  dateTitle: string;
  slotTitle: string;
  dateHint: string;
  timeHint: string;
  slotsLoading?: boolean;
  slotsError?: boolean;
  onRetrySlots?: () => void;
}) {
  const localNow = toLocalDateTimeInput(new Date());
  const today = localNow.slice(0, 10);
  const currentTime = localNow.slice(11, 16);
  const [calendarMonth, setCalendarMonth] = useState(() => minDate.slice(0, 7));
  const [year, month] = calendarMonth.split("-").map(Number);
  const monthYear = year ?? 0;
  const monthIndex = (month ?? 1) - 1;
  const firstWeekday = new Date(Date.UTC(monthYear, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(monthYear, monthIndex + 1, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(monthYear, monthIndex, 1, 12)));
  const currentMonth = minDate.slice(0, 7);

  useEffect(() => {
    if (date) setCalendarMonth(date.slice(0, 7));
  }, [date]);

  const quickDates = [0, 1, 2].map((offset) => {
    const value = new Date(`${minDate}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  });
  const quickLabels =
    minDate === today
      ? [m.quickToday, m.quickTomorrow, m.quickDayAfterTomorrow]
      : [m.quickTomorrow, m.quickDayAfterTomorrow, m.quickInThreeDays];
  function selectDate(value: string) {
    if (value !== date) onSlotChange("");
    onDateChange(value);
  }
  function slotHasPassed(startTime: string) {
    return date === today && startTime.slice(0, 5) <= currentTime;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label={slotTitle}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <Clock3 size={15} className="text-primary" /> {slotTitle}
          </h3>
          <span className="text-xs text-muted">{timeHint}</span>
        </div>
        {slotsLoading && <p className="py-2 text-sm text-muted">{m.slotsLoading}</p>}
        {slotsError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            <span>{m.slotsUnavailable}</span>
            {onRetrySlots && (
              <button type="button" className="underline" onClick={onRetrySlots}>
                {m.refreshSlots}
              </button>
            )}
          </div>
        ) : slots.length ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot) => {
                const selected = slotId === slot.id;
                const passed = slotHasPassed(slot.startTime);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={passed}
                    onClick={() => onSlotChange(slot.id)}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
                      passed
                        ? "border-line bg-canvas text-muted"
                        : selected
                          ? "border-primary bg-primary-soft ring-1 ring-primary"
                          : "border-line bg-white hover:bg-canvas",
                    )}
                  >
                    <span className="font-semibold">{slot.name}</span>
                    <span className="text-xs text-muted">
                      {m.slotRange(slot.startTime.slice(0, 5), slot.endTime.slice(0, 5))}
                    </span>
                  </button>
                );
              })}
            </div>
            {date === today && slots.every((slot) => slotHasPassed(slot.startTime)) && (
              <p role="status" className="mt-2 text-xs text-muted">
                {m.slotsPassedToday}
              </p>
            )}
          </>
        ) : !slotsLoading ? (
          <p className="text-sm text-muted">{m.slotsEmpty}</p>
        ) : null}
      </section>
      <section aria-label={dateTitle}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <CalendarDays size={15} className="text-primary" /> {dateTitle}
          </h3>
          <span className="text-xs text-muted">{dateHint}</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickDates.map((value, index) => (
            <button
              key={value}
              type="button"
              aria-pressed={date === value}
              onClick={() => selectDate(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                date === value
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white text-ink hover:bg-canvas",
              )}
            >
              {quickLabels[index]}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-canvas/50 p-3">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
            <button
              type="button"
              aria-label={m.datePickerPreviousMonth}
              disabled={calendarMonth <= currentMonth}
              onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
              className="grid size-8 place-items-center rounded hover:bg-slate-200 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold capitalize">{monthLabel}</span>
            <button
              type="button"
              aria-label={m.datePickerNextMonth}
              onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
              className="grid size-8 place-items-center rounded hover:bg-slate-200"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center">
            {m.datePickerWeekdays.map((weekday) => (
              <span key={weekday} className="py-1 text-[10px] font-bold text-muted">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const value = dateFromParts(monthYear, monthIndex, day);
              const disabled = value < minDate;
              const selected = value === date;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={m.datePickerSelectDate(formatCalendarDate(value))}
                  aria-pressed={selected}
                  disabled={disabled}
                  style={day === 1 ? { gridColumnStart: firstWeekday + 1 } : undefined}
                  onClick={() => selectDate(value)}
                  className={cn(
                    "grid h-9 place-items-center rounded-lg text-sm font-semibold",
                    disabled
                      ? "cursor-not-allowed text-slate-300"
                      : selected
                        ? "bg-primary text-white"
                        : "text-ink hover:bg-primary-soft hover:text-primary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        {date && (
          <p className="mt-2 text-xs font-semibold text-primary">
            {m.datePickerSelectedDate(formatCalendarDate(date))}
          </p>
        )}
      </section>
    </div>
  );
}
