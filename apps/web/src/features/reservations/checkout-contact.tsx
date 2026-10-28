"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Lock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { isMockMode } from "@/config/api-mode";
import { cn } from "@/lib/utils";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutState } from "./checkout.types";
import { CheckoutSummary } from "./checkout-parts";
import { toLocalDateTimeInput } from "./checkout-validation";

function dateFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthFromDate(value: string): string {
  return value.slice(0, 7);
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

export function CheckoutContact({ state }: { state: CheckoutState }) {
  const { form } = state;
  const today = toLocalDateTimeInput(new Date()).slice(0, 10);
  const tomorrow = toLocalDateTimeInput(new Date(Date.now() + 86_400_000)).slice(0, 10);
  const selectedDate = form.watch("checkInDate");
  const selectedSlotId = form.watch("checkInSlotId");
  const selectedDuration = form.watch("durationMonths");

  const [calendarMonth, setCalendarMonth] = useState(() => monthFromDate(today));
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
  const currentMonth = monthFromDate(today);

  useEffect(() => {
    if (selectedDate) setCalendarMonth(monthFromDate(selectedDate));
  }, [selectedDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form
        className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        onSubmit={(event) => {
          event.preventDefault();
          void state.next();
        }}
        noValidate
      >
        {/* Header */}
        <div className="mb-4">
          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#165f4d]">
            {m.contactBadge}
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">{m.contactTitle}</h1>
          <p className="text-xs text-slate-500">{m.contactDescription}</p>
        </div>

        {/* Section 1: Customer Contact Info (Compact 3-column row) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 mb-1">
              {m.fullName}
            </label>
            <input
              id="fullName"
              type="text"
              readOnly={!isMockMode}
              autoComplete="name"
              {...form.register("fullName")}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
            />
            {form.formState.errors.fullName?.message && (
              <p className="mt-1 text-[11px] text-rose-600">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-slate-700 mb-1">
              {m.phone}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="0901234567"
              {...form.register("phone")}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
            />
            {form.formState.errors.phone?.message ? (
              <p className="mt-1 text-[11px] text-rose-600">
                {form.formState.errors.phone.message}
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">{m.phoneHint}</p>
            )}
          </div>

          {/* Email (LOCKED / DISABLED) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="email" className="text-xs font-bold text-slate-700">
                {m.email}
              </label>
              <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Lock size={10} />
                <span>Đã khóa</span>
              </span>
            </div>
            <input
              id="email"
              type="email"
              disabled
              readOnly
              autoComplete="email"
              value={form.watch("email") || ""}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 text-xs font-medium text-slate-500 cursor-not-allowed select-none"
            />
            <p className="mt-1 text-[10px] text-slate-400">Khóa theo tài khoản đang đăng nhập</p>
          </div>
        </div>

        {/* Section 2: Duration, Slots and Calendar (2 Compact Columns to fit 100% zoom) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3.5 border-t border-slate-100">
          {/* Left Column: Duration Months + Check-in Slot */}
          <div className="space-y-4">
            {/* Duration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock size={14} className="text-[#165f4d]" />
                  <span>{m.duration}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  {[1, 3, 6, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer",
                        selectedDuration === num
                          ? "bg-[#165f4d] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                      onClick={() =>
                        form.setValue("durationMonths", num, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      {num}T
                    </button>
                  ))}
                </div>
              </div>

              {/* 12 months buttons grid */}
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mth) => {
                  const isSelected = selectedDuration === mth;
                  return (
                    <button
                      key={mth}
                      type="button"
                      onClick={() =>
                        form.setValue("durationMonths", mth, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                      className={cn(
                        "h-8 rounded-lg text-xs font-bold transition-all border flex items-center justify-center cursor-pointer",
                        isSelected
                          ? "bg-[#165f4d] text-white border-[#165f4d] shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300",
                      )}
                    >
                      {mth}T
                    </button>
                  );
                })}
              </div>
              {form.formState.errors.durationMonths?.message && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.durationMonths.message}
                </p>
              )}
            </div>

            {/* Check-in Slot Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock3 size={14} className="text-[#165f4d]" />
                  <span>{m.slotPickerTitle}</span>
                </div>
                <span className="text-[10px] text-slate-400">{m.timeHint}</span>
              </div>

              {state.slotsQuery.isLoading ? (
                <p className="text-xs text-slate-500 py-2">{m.slotsLoading}</p>
              ) : null}

              {state.slotsQuery.isError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 flex items-center justify-between">
                  <span>{m.slotsUnavailable}</span>
                  <button
                    type="button"
                    className="underline font-bold"
                    onClick={() => state.slotsQuery.refetch()}
                  >
                    {m.refreshSlots}
                  </button>
                </div>
              ) : null}

              {state.slotsQuery.data?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {state.slotsQuery.data.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() =>
                          form.setValue("checkInSlotId", slot.id, { shouldValidate: true })
                        }
                        className={cn(
                          "px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer",
                          isSelected
                            ? "border-[#165f4d] bg-emerald-50/40 text-slate-900 ring-1 ring-[#165f4d]"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "size-4 rounded-full border flex items-center justify-center shrink-0",
                              isSelected ? "border-[#165f4d]" : "border-slate-300",
                            )}
                          >
                            {isSelected && <div className="size-2 rounded-full bg-[#165f4d]" />}
                          </div>
                          <span className="text-xs font-bold truncate max-w-[100px]">
                            {slot.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {form.formState.errors.checkInSlotId?.message && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.checkInSlotId.message}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Check-in Date (Compact Calendar + Quick Chips) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CalendarDays size={14} className="text-[#165f4d]" />
                <span>{m.datePickerTitle}</span>
              </div>
              <span className="text-[10px] text-slate-400">Chọn từ ngày mai</span>
            </div>

            {/* Quick date chips */}
            <div className="flex items-center gap-1.5 mb-2">
              {[
                { label: "Ngày mai", date: tomorrow },
                {
                  label: "Ngày kia",
                  date: toLocalDateTimeInput(new Date(Date.now() + 172_800_000)).slice(0, 10),
                },
                {
                  label: "Sau 3 ngày",
                  date: toLocalDateTimeInput(new Date(Date.now() + 259_200_000)).slice(0, 10),
                },
              ].map((chip) => {
                const isSelected = selectedDate === chip.date;
                return (
                  <button
                    key={chip.date}
                    type="button"
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border",
                      isSelected
                        ? "bg-[#165f4d] text-white border-[#165f4d] shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                    onClick={() => {
                      form.setValue("checkInDate", chip.date, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      form.clearErrors("checkInDate");
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Compact Month Calendar */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
              {/* Calendar Header */}
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-200/60">
                <button
                  type="button"
                  disabled={calendarMonth <= currentMonth}
                  onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
                  className="size-6 flex items-center justify-center rounded-md hover:bg-slate-200/70 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-bold text-slate-800 capitalize">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
                  className="size-6 flex items-center justify-center rounded-md hover:bg-slate-200/70 text-slate-600 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Weekday Row */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {m.datePickerWeekdays.map((weekday) => (
                  <span key={weekday} className="text-[10px] font-bold text-slate-400">
                    {weekday}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const value = dateFromParts(monthYear, monthIndex, day);
                  const disabled = value < tomorrow;
                  const isSelected = value === selectedDate;

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      style={day === 1 ? { gridColumnStart: firstWeekday + 1 } : undefined}
                      onClick={() => {
                        form.setValue("checkInDate", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        form.clearErrors("checkInDate");
                      }}
                      className={cn(
                        "h-7 w-full flex items-center justify-center rounded-md text-[11px] font-semibold transition-all cursor-pointer",
                        disabled && "text-slate-300 cursor-not-allowed",
                        isSelected &&
                          "bg-[#165f4d] text-white font-bold shadow-xs hover:bg-[#0f493b]",
                        !isSelected &&
                          !disabled &&
                          "text-slate-700 hover:bg-emerald-50 hover:text-[#165f4d]",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <p className="mt-1.5 text-[11px] text-[#165f4d] font-semibold">
                Đã chọn: {formatCalendarDate(selectedDate)}
              </p>
            )}

            {form.formState.errors.checkInDate?.message && (
              <p className="mt-1 text-[11px] text-rose-600">
                {form.formState.errors.checkInDate.message}
              </p>
            )}
          </div>
        </div>

        {/* Optional Note */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <label htmlFor="note" className="block text-xs font-bold text-slate-700 mb-1">
            {m.note} <span className="text-[11px] font-normal text-slate-400">({m.optional})</span>
          </label>
          <textarea
            id="note"
            rows={2}
            value={state.note}
            placeholder={m.notePlaceholder}
            onChange={(e) => state.setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors resize-none"
          />
        </div>

        {state.submissionError && (
          <p role="alert" className="mt-2 text-xs text-rose-600 font-medium">
            {state.submissionError}
          </p>
        )}

        {/* Navigation Buttons */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            onClick={() => state.setStep(0)}
          >
            <ArrowLeft size={14} />
            <span>{m.back}</span>
          </button>

          <button
            type="submit"
            disabled={
              state.busy ||
              state.availabilityQuery.isFetching ||
              state.availabilityQuery.isError ||
              state.selectedOption?.availableCount === 0
            }
            className="h-10 px-5 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{state.busy ? m.loading : m.review}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </form>

      {/* Right Column: Summary Sidebar */}
      <div className="lg:col-span-4">
        <CheckoutSummary state={state} />
      </div>
    </div>
  );
}
