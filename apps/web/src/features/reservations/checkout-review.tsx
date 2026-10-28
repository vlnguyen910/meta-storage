"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Edit2,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutState } from "./checkout.types";
import { CheckoutSummary, UnitPhoto } from "./checkout-parts";

export function CheckoutReview({ state }: { state: CheckoutState }) {
  const values = state.form.getValues();

  return (
    <>
      <div className="mb-3.5">
        <h1 className="text-base sm:text-lg font-bold text-slate-900">{m.reviewTitle}</h1>
        <p className="text-xs text-slate-500">{m.paymentDescription}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Review Panels (Expanded for balance & beauty) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Unit & Facility Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {m.details}
              </h2>
              <button
                type="button"
                onClick={() => state.setStep(0)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#165f4d] hover:underline cursor-pointer"
              >
                <Edit2 size={12} />
                <span>{m.edit}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative w-full sm:w-32 h-24 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                <UnitPhoto
                  index={state.availabilityQuery.data?.findIndex(
                    (item) => item.unitTypeId === state.selectedOption?.unitTypeId,
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {state.selectedOption?.unitType}
                  </h3>
                  {state.selectedOption &&
                    !state.selectedOption.unitType.includes(
                      `${state.selectedOption.sizeSqm} m²`,
                    ) && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-[#165f4d]">
                        {state.selectedOption.sizeSqm} m²
                      </span>
                    )}
                </div>

                <div className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                  <MapPin size={14} className="shrink-0 text-slate-400 mt-0.5" />
                  <span className="font-medium text-slate-700">
                    {state.selectedFacility?.name} — {state.selectedFacility?.address}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                  <span>
                    Kích thước (Dài × Rộng × Cao):{" "}
                    <strong className="text-slate-800 font-semibold">
                      {state.selectedOption?.lengthM}m × {state.selectedOption?.widthM}m ×{" "}
                      {state.selectedOption?.heightM}m
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Schedule & Contact (Redesigned with clear visual hierarchy) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Lịch hẹn nhận kho & Thông tin liên hệ
              </h2>
              <button
                type="button"
                onClick={() => state.setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#165f4d] hover:underline cursor-pointer"
              >
                <Edit2 size={12} />
                <span>{m.edit}</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Sub-section A: Schedule Information */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Lịch nhận kho
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Check-in Date */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                      <CalendarDays size={13} className="text-[#165f4d]" />
                      {m.date}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      {new Date(`${values.checkInDate}T00:00:00+07:00`).toLocaleDateString(
                        "vi-VN",
                        {
                          timeZone: "Asia/Ho_Chi_Minh",
                        },
                      )}
                    </p>
                  </div>

                  {/* Check-in Time Slot */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                      <Clock3 size={13} className="text-[#165f4d]" />
                      {m.time}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {state.selectedSlot?.name ?? state.selectedSlot?.startTime.slice(0, 5)}
                    </p>
                    <span className="text-[11px] text-slate-500 font-medium block truncate mt-0.5">
                      {state.selectedSlot
                        ? `${state.selectedSlot.startTime.slice(0, 5)} – ${state.selectedSlot.endTime.slice(0, 5)}`
                        : ""}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                      <Clock3 size={13} className="text-[#165f4d]" />
                      {m.duration}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-[#165f4d]">
                      {m.month(values.durationMonths)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-section B: Contact Information */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Thông tin khách thuê
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Customer Name */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                      <UserRound size={13} className="text-[#165f4d]" />
                      {m.fullName}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {values.fullName}
                    </p>
                  </div>

                  {/* Customer Phone */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                      <Phone size={13} className="text-[#165f4d]" />
                      {m.phone}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">{values.phone}</p>
                  </div>

                  {/* Customer Email */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                      <Mail size={13} className="text-[#165f4d]" />
                      {m.email}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {values.email}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {state.note && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {m.note}
                </span>
                <p className="text-slate-700">{state.note}</p>
              </div>
            )}
          </section>

          {/* Navigation - Sole payment transition button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              onClick={() => state.setStep(1)}
            >
              <ArrowLeft size={14} />
              <span>{m.back}</span>
            </button>

            <button
              type="button"
              className="h-10 px-5 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              onClick={state.next}
            >
              <span>{m.checkout}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Right column: Summary */}
        <div className="lg:col-span-5">
          <CheckoutSummary state={state} />
        </div>
      </div>
    </>
  );
}
