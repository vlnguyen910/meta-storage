"use client";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { isMockMode } from "@/config/api-mode";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
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
    <div className={s.layout}>
      <form
        className={s.panel}
        onSubmit={(event) => {
          event.preventDefault();
          void state.next();
        }}
        noValidate
      >
        <span className={s.badge}>{m.contactBadge}</span>
        <h1 className={s.title}>{m.contactTitle}</h1>
        <p className={s.description}>{m.contactDescription}</p>
        <div className={s.formGrid}>
          <div className={s.wide}>
            <FieldShell label={m.fullName} error={form.formState.errors.fullName?.message}>
              <Input readOnly={!isMockMode} autoComplete="name" {...form.register("fullName")} />
            </FieldShell>
          </div>
          <div>
            <FieldShell label={m.phone} error={form.formState.errors.phone?.message}>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="0901234567"
                {...form.register("phone")}
              />
            </FieldShell>
            <p className={s.fieldHint}>{m.phoneHint}</p>
          </div>
          <div>
            <FieldShell label={m.email} error={form.formState.errors.email?.message}>
              <Input readOnly type="email" autoComplete="email" {...form.register("email")} />
            </FieldShell>
            <p className={s.fieldHint}>{isMockMode ? m.emailHint : m.accountContactHint}</p>
          </div>
          <fieldset
            className={s.durationField}
            aria-describedby={
              form.formState.errors.durationMonths ? "durationMonths-error" : undefined
            }
          >
            <legend className={s.durationLegend}>{m.duration}</legend>
            <div className={s.durationGrid}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <label
                  className={s.durationOption}
                  data-selected={selectedDuration === month}
                  htmlFor={`durationMonths-${month}`}
                  key={month}
                >
                  <input
                    id={`durationMonths-${month}`}
                    className={s.durationRadio}
                    type="radio"
                    name="durationMonths"
                    value={month}
                    checked={selectedDuration === month}
                    aria-describedby={
                      form.formState.errors.durationMonths ? "durationMonths-error" : undefined
                    }
                    onChange={() =>
                      form.setValue("durationMonths", month, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  <span>{m.month(month)}</span>
                </label>
              ))}
            </div>
            {form.formState.errors.durationMonths?.message ? (
              <p className={s.fieldError} id="durationMonths-error" role="alert">
                {form.formState.errors.durationMonths.message}
              </p>
            ) : null}
          </fieldset>
          <fieldset
            className={s.calendarField}
            aria-describedby={
              form.formState.errors.checkInDate ? "checkInDate-error" : "checkInDate-hint"
            }
          >
            <legend className={s.pickerLegend}>
              <CalendarDays size={18} aria-hidden="true" />
              <span>{m.datePickerTitle}</span>
            </legend>
            <div className={s.calendarPanel} data-calendar-month={calendarMonth}>
              <div className={s.calendarHeader}>
                <button
                  type="button"
                  className={s.calendarNav}
                  aria-label={m.datePickerPreviousMonth}
                  disabled={calendarMonth <= currentMonth}
                  onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <h2>{monthLabel}</h2>
                <button
                  type="button"
                  className={s.calendarNav}
                  aria-label={m.datePickerNextMonth}
                  onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
              <div className={s.calendarGrid}>
                {m.datePickerWeekdays.map((weekday) => (
                  <span className={s.calendarWeekday} key={weekday} aria-hidden="true">
                    {weekday}
                  </span>
                ))}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const value = dateFromParts(monthYear, monthIndex, day);
                  const disabled = value < tomorrow;
                  const selected = value === selectedDate;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={s.calendarDay}
                      data-calendar-date={value}
                      data-selected={selected}
                      disabled={disabled}
                      aria-label={m.datePickerSelectDate(formatCalendarDate(value))}
                      aria-pressed={selected}
                      style={day === 1 ? { gridColumnStart: firstWeekday + 1 } : undefined}
                      onClick={() => {
                        form.setValue("checkInDate", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        form.clearErrors("checkInDate");
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className={s.calendarHint} id="checkInDate-hint">
              {selectedDate
                ? m.datePickerSelectedDate(formatCalendarDate(selectedDate))
                : m.datePickerHint}
            </p>
            {form.formState.errors.checkInDate?.message ? (
              <p className={s.fieldError} id="checkInDate-error" role="alert">
                {form.formState.errors.checkInDate.message}
              </p>
            ) : null}
          </fieldset>
          <fieldset
            className={`${s.slotField} ${s.wide}`}
            aria-describedby={
              form.formState.errors.checkInSlotId ? "checkInSlot-error" : "checkInSlot-hint"
            }
            disabled={state.slotsQuery.isLoading}
          >
            <legend className={s.pickerLegend}>{m.slotPickerTitle}</legend>
            <p className={s.fieldHint} id="checkInSlot-hint">
              {m.timeHint}
            </p>
            {state.slotsQuery.isLoading ? (
              <p className={s.slotStatus} role="status">
                {m.slotsLoading}
              </p>
            ) : null}
            {state.slotsQuery.isError ? (
              <div className={s.slotError} role="alert">
                <span>{m.slotsUnavailable}</span>
                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => state.slotsQuery.refetch()}
                >
                  {m.refreshSlots}
                </button>
              </div>
            ) : null}
            {!state.slotsQuery.isLoading &&
            !state.slotsQuery.isError &&
            state.slotsQuery.data?.length === 0 ? (
              <p className={s.slotStatus} role="status">
                {m.slotsEmpty}
              </p>
            ) : null}
            {state.slotsQuery.data?.length ? (
              <div className={s.slotGrid}>
                {state.slotsQuery.data.map((slot) => (
                  <label
                    className={s.slotCard}
                    data-selected={selectedSlotId === slot.id}
                    key={slot.id}
                    htmlFor={`checkInSlot-${slot.id}`}
                  >
                    <input
                      id={`checkInSlot-${slot.id}`}
                      className={s.slotRadio}
                      type="radio"
                      value={slot.id}
                      checked={selectedSlotId === slot.id}
                      aria-describedby="checkInSlot-hint"
                      {...form.register("checkInSlotId")}
                    />
                    <span className={s.slotCardText}>
                      <strong>{slot.name}</strong>
                      <span>
                        {m.slotRange(slot.startTime.slice(0, 5), slot.endTime.slice(0, 5))}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {form.formState.errors.checkInSlotId?.message ? (
              <p className={s.fieldError} id="checkInSlot-error" role="alert">
                {form.formState.errors.checkInSlotId.message}
              </p>
            ) : null}
          </fieldset>
          <div className={s.wide}>
            <FieldShell label={m.note} hint={m.optional}>
              <textarea
                value={state.note}
                placeholder={m.notePlaceholder}
                onChange={(event) => state.setNote(event.target.value)}
              />
            </FieldShell>
          </div>
        </div>
        {state.submissionError ? (
          <p role="alert" className={s.fieldError}>
            {state.submissionError}
          </p>
        ) : null}
        {state.selectedOption?.availableCount === 0 ? (
          <div className={s.capacityNotice} role="alert">
            <p>{m.unavailablePeriod}</p>
            <button type="button" className={s.secondary} onClick={() => state.setStep(0)}>
              {m.chooseAnother}
            </button>
            <button
              type="button"
              className={s.secondary}
              disabled={state.availabilityQuery.isFetching}
              onClick={() => void state.availabilityQuery.refetch()}
            >
              {m.refreshAvailability}
            </button>
          </div>
        ) : null}
        <div className={s.actions}>
          <button type="button" className={s.secondary} onClick={() => state.setStep(0)}>
            <ArrowLeft size={14} className="inline mr-2" />
            {m.back}
          </button>
          <button
            type="submit"
            className={s.primary}
            disabled={
              state.busy ||
              state.availabilityQuery.isFetching ||
              state.availabilityQuery.isError ||
              state.selectedOption?.availableCount === 0
            }
          >
            {state.busy ? m.loading : m.review}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
      <CheckoutSummary state={state} />
    </div>
  );
}
