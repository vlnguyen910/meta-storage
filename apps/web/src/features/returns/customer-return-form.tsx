"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui/display";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useRental } from "@/features/rentals/hooks";
import { useCreateReturnRequest, useRentalReturns, useReturnSlots } from "./hooks";
import { RETURNS_MESSAGES as M } from "./returns.messages";

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

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getTomorrowString(): string {
  const date = new Date(Date.now() + 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CustomerReturnForm({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const rental = useRental(rentalId);

  const today = getTodayString();
  const tomorrow = getTomorrowString();

  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");

  const [calendarMonth, setCalendarMonth] = useState(() => monthFromDate(tomorrow));
  const [year, month] = calendarMonth.split("-").map(Number);
  const monthYear = year ?? 0;
  const monthIndex = (month ?? 1) - 1;
  const firstWeekday = new Date(Date.UTC(monthYear, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(monthYear, monthIndex + 1, 0)).getUTCDate();

  const rawMonthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(monthYear, monthIndex, 1, 12)));
  const monthLabel = rawMonthLabel.replace(/^([a-z])|(\s[a-z])/g, (c) => c.toUpperCase());
  const currentMonth = monthFromDate(today);

  useEffect(() => {
    if (date) setCalendarMonth(monthFromDate(date));
  }, [date]);

  const slots = useReturnSlots(rentalId, date);
  const create = useCreateReturnRequest(rentalId);
  const returnsQuery = useRentalReturns(rentalId);

  if (rental.isLoading || returnsQuery.isLoading) return <LoadingState variant="detail" />;
  if (rental.isError || !rental.data)
    return <ErrorState message={M.loadError} onRetry={() => rental.refetch()} />;

  const openRequest = returnsQuery.data?.find((request) =>
    ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"].includes(request.status),
  );

  if (openRequest) {
    return (
      <>
        <PageHeader
          eyebrow={M.sectionTitle}
          title={M.requestTitle}
          description={M.requestDescription}
        />
        <Card className="mx-auto grid max-w-xl gap-5 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-6 shadow-2xs sm:p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-amber-800">
            <Clock size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-ink">{M.alreadyHasOpenRequestTitle}</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">{M.alreadyHasOpenRequestDesc}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-4 text-left shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{M.schedule}:</span>
              <strong className="text-sm text-ink">
                {new Date(openRequest.startsAt).toLocaleString("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: openRequest.timezone,
                })}
              </strong>
            </div>
            {openRequest.reason ? (
              <div className="mt-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{M.requestReason}: </span>
                {openRequest.reason}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={customerRoutes.returnRequest(openRequest.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-xs transition hover:bg-primary-dark"
            >
              <span>{M.viewExistingRequest}</span>
              <ChevronRight size={16} />
            </Link>
            <Link
              href={customerRoutes.rental(rentalId)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              <span>{M.back}</span>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={M.sectionTitle}
        title={M.requestTitle}
        description={M.requestDescription}
      />
      <Card className="mx-auto grid max-w-3xl gap-6 rounded-2xl border border-slate-200/80 p-6 shadow-2xs sm:p-8">
        <fieldset className="grid gap-3 border-0 p-0">
          <legend className="flex items-center gap-2 text-base font-bold text-ink">
            <CalendarDays size={18} className="text-primary" aria-hidden="true" />
            <span>{M.datePickerTitle}</span>
          </legend>
          <div className="overflow-hidden rounded-xl border border-[#dce5e1] bg-[#f8fbfa] p-4 sm:p-5">
            <div className="mb-3 grid grid-cols-[40px_1fr_40px] items-center gap-2">
              <button
                type="button"
                className="grid size-10 place-items-center rounded-lg text-primary transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                aria-label={M.datePickerPreviousMonth}
                disabled={calendarMonth <= currentMonth}
                onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <h2 className="m-0 text-center text-sm font-bold capitalize text-ink sm:text-base">
                {monthLabel}
              </h2>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-lg text-primary transition hover:bg-emerald-50"
                aria-label={M.datePickerNextMonth}
                onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {M.datePickerWeekdays.map((weekday) => (
                <span
                  className="grid min-h-8 place-items-center text-xs font-bold text-slate-500"
                  key={weekday}
                  aria-hidden="true"
                >
                  {weekday}
                </span>
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const value = dateFromParts(monthYear, monthIndex, day);
                const disabled = value < tomorrow;
                const selected = value === date;
                return (
                  <button
                    key={value}
                    type="button"
                    data-calendar-date={value}
                    data-selected={selected}
                    disabled={disabled}
                    aria-label={M.datePickerSelectDate(formatCalendarDate(value))}
                    aria-pressed={selected}
                    style={day === 1 ? { gridColumnStart: firstWeekday + 1 } : undefined}
                    onClick={() => {
                      setDate(value);
                      setSlotId("");
                    }}
                    className={`grid min-h-11 w-full place-items-center rounded-lg text-xs font-bold transition sm:text-sm ${
                      selected
                        ? "bg-primary font-bold text-white shadow-2xs"
                        : disabled
                          ? "cursor-not-allowed text-slate-300"
                          : "text-ink hover:bg-emerald-100/60 hover:text-primary"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="m-0 text-xs text-muted" id="return-date-hint">
            {date ? M.datePickerSelectedDate(formatCalendarDate(date)) : M.datePickerHint}
          </p>
        </fieldset>

        <fieldset className="grid gap-3 border-0 p-0">
          <legend className="flex items-center gap-2 text-base font-bold text-ink">
            <Clock size={18} className="text-primary" aria-hidden="true" />
            <span>{M.slot}</span>
          </legend>
          {!date ? (
            <p className="text-sm text-muted">{M.chooseDate}</p>
          ) : slots.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner size="sm" variant="brand" />
              <span>{M.loadingSlots}</span>
            </div>
          ) : slots.isError ? (
            <button
              type="button"
              onClick={() => void slots.refetch()}
              className="inline-flex min-h-10 items-center gap-1.5 justify-self-start text-sm font-semibold text-primary underline"
            >
              <RotateCcw size={14} />
              {M.retry}
            </button>
          ) : slots.data?.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {slots.data.map((slot) => {
                const isSelected = slotId === slot.slotId;
                return (
                  <label
                    key={slot.slotId}
                    className={`flex min-h-12 cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-primary bg-emerald-50/70 shadow-2xs"
                        : "border-slate-200/80 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="return-slot"
                        value={slot.slotId}
                        checked={isSelected}
                        onChange={() => setSlotId(slot.slotId)}
                        className="accent-primary size-4"
                        required
                      />
                      <span className="text-sm font-semibold text-ink">
                        {new Date(slot.startsAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: slot.timezone,
                        })}{" "}
                        –{" "}
                        {new Date(slot.endsAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: slot.timezone,
                        })}
                      </span>
                    </div>
                    <Clock size={15} className={isSelected ? "text-primary" : "text-slate-400"} />
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">{M.noSlots}</p>
          )}
        </fieldset>

        <div className="grid gap-2">
          <label htmlFor="return-reason" className="text-base font-bold text-ink">
            {M.reason}
          </label>
          <textarea
            id="return-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={4000}
            rows={3}
            className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-sm transition focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-100"
            required
            aria-describedby="return-reason-hint"
            placeholder={M.reasonHint}
          />
          <small id="return-reason-hint" className="text-xs text-muted">
            {M.reasonHint}
          </small>
        </div>

        {create.isError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {create.error instanceof Error && create.error.message
              ? create.error.message
              : `${M.returnRequestFailed} ${M.saveError}`}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => router.push(customerRoutes.rental(rentalId))}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowLeft size={16} />
            {M.back}
          </button>
          <button
            type="button"
            disabled={!date || !slotId || !reason.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { date, slotId, reason: reason.trim() },
                { onSuccess: (request) => router.push(customerRoutes.returnRequest(request.id)) },
              )
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-xs transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {create.isPending ? (
              <>
                <Spinner size="sm" variant="button" />
                <span>{M.creating}</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>{M.submit}</span>
              </>
            )}
          </button>
        </div>
      </Card>
    </>
  );
}
