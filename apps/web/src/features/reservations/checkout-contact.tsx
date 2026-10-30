"use client";

import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { isMockMode } from "@/config/api-mode";
import { cn } from "@/lib/utils";
import { BookingSchedulePicker } from "./booking-schedule-picker";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutState } from "./checkout.types";
import { CheckoutSummary } from "./checkout-parts";
import { toLocalDateTimeInput } from "./checkout-validation";

export function CheckoutContact({ state }: { state: CheckoutState }) {
  const { form } = state;
  const tomorrow = toLocalDateTimeInput(new Date(Date.now() + 86_400_000)).slice(0, 10);
  const selectedDate = form.watch("checkInDate");
  const selectedSlotId = form.watch("checkInSlotId");
  const selectedDuration = form.watch("durationMonths");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form
        className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void state.next();
        }}
        noValidate
      >
        {/* Header - Compact without redundant badge or subtitle */}
        <div className="mb-3.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{m.contactTitle}</h2>
        </div>

        {/* Section 1: Customer Contact Info (Expanded 3-column row) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3.5">
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
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
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
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
            />
            {form.formState.errors.phone?.message ? (
              <p className="mt-1 text-[11px] text-rose-600">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
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
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 text-xs sm:text-sm font-medium text-slate-500 cursor-not-allowed select-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold text-slate-800">{m.duration}</p>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((months) => (
                <button
                  key={months}
                  type="button"
                  aria-pressed={selectedDuration === months}
                  onClick={() =>
                    form.setValue("durationMonths", months, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                  className={cn(
                    "min-h-9 rounded-lg border text-xs font-semibold",
                    selectedDuration === months
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-white text-ink hover:bg-canvas",
                  )}
                >
                  {m.month(months)}
                </button>
              ))}
            </div>
            {form.formState.errors.durationMonths?.message && (
              <p className="mt-1 text-[11px] text-rose-600">
                {form.formState.errors.durationMonths.message}
              </p>
            )}
          </div>
          <BookingSchedulePicker
            date={selectedDate}
            onDateChange={(value) => {
              form.setValue("checkInDate", value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
              form.clearErrors("checkInDate");
            }}
            slotId={selectedSlotId}
            onSlotChange={(value) =>
              form.setValue("checkInSlotId", value, { shouldValidate: true })
            }
            slots={state.slotsQuery.data ?? []}
            minDate={tomorrow}
            dateTitle={m.datePickerTitle}
            slotTitle={m.slotPickerTitle}
            dateHint={m.datePickerHint}
            timeHint={m.timeHint}
            slotsLoading={state.slotsQuery.isLoading}
            slotsError={state.slotsQuery.isError}
            onRetrySlots={() => void state.slotsQuery.refetch()}
          />
          {form.formState.errors.checkInDate?.message && (
            <p className="mt-1 text-[11px] text-rose-600">
              {form.formState.errors.checkInDate.message}
            </p>
          )}
          {form.formState.errors.checkInSlotId?.message && (
            <p className="mt-1 text-[11px] text-rose-600">
              {form.formState.errors.checkInSlotId.message}
            </p>
          )}
        </div>

        {/* Optional Note */}
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <input
            id="note"
            type="text"
            value={state.note}
            placeholder="Ghi chú thêm cho cơ sở (không bắt buộc)..."
            onChange={(e) => state.setNote(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
          />
        </div>

        {state.submissionError && (
          <p role="alert" className="mt-2 text-xs text-rose-600 font-medium">
            {state.submissionError}
          </p>
        )}

        {/* Navigation Buttons */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
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
            className="h-10 px-5 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{state.busy ? m.loading : m.review}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </form>

      {/* Right Column: Summary Sidebar */}
      <div className="lg:col-span-5">
        <CheckoutSummary state={state} />
      </div>
    </div>
  );
}
