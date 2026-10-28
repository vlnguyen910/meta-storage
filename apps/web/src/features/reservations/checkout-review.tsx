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
      <div className="mb-2.5">
        <h1 className="text-base font-bold text-slate-900">{m.reviewTitle}</h1>
        <p className="text-[11px] text-slate-500">{m.paymentDescription}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left column: Review Panels */}
        <div className="lg:col-span-8 space-y-3">
          {/* Card 1: Unit & Facility Information */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {m.details}
              </h2>
              <button
                type="button"
                onClick={() => state.setStep(0)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#165f4d] hover:underline cursor-pointer"
              >
                <Edit2 size={11} />
                <span>{m.edit}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative w-full sm:w-24 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                <UnitPhoto
                  index={state.availabilityQuery.data?.findIndex(
                    (item) => item.unitTypeId === state.selectedOption?.unitTypeId,
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {state.selectedOption?.unitType}
                  </h3>
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-[#165f4d]">
                    {state.selectedOption?.sizeSqm} m²
                  </span>
                </div>

                <div className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
                  <MapPin size={12} className="shrink-0 text-slate-400 mt-0.5" />
                  <span className="font-medium text-slate-700 text-[11px]">
                    {state.selectedFacility?.name} - {state.selectedFacility?.address}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
                  <span>
                    Kích thước:{" "}
                    <strong className="text-slate-800 font-semibold">
                      {state.selectedOption?.lengthM} × {state.selectedOption?.widthM} ×{" "}
                      {state.selectedOption?.heightM} m
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Schedule & Contact Combined (High density grid) */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Lịch hẹn nhận kho & Thông tin liên hệ
              </h2>
              <button
                type="button"
                onClick={() => state.setStep(1)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#165f4d] hover:underline cursor-pointer"
              >
                <Edit2 size={11} />
                <span>{m.edit}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Check-in Date */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-0.5">
                  <CalendarDays size={11} className="text-[#165f4d]" />
                  {m.date}
                </span>
                <p className="text-xs font-bold text-slate-900">
                  {new Date(`${values.checkInDate}T00:00:00+07:00`).toLocaleDateString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </p>
              </div>

              {/* Check-in Time Slot */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-0.5">
                  <Clock3 size={11} className="text-[#165f4d]" />
                  {m.time}
                </span>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {state.selectedSlot?.name ?? state.selectedSlot?.startTime.slice(0, 5)}
                  <span className="text-[10px] text-slate-500 font-normal block truncate">
                    {state.selectedSlot
                      ? `${state.selectedSlot.startTime.slice(0, 5)} - ${state.selectedSlot.endTime.slice(0, 5)}`
                      : ""}
                  </span>
                </p>
              </div>

              {/* Duration */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-0.5">
                  <Clock3 size={11} className="text-[#165f4d]" />
                  {m.duration}
                </span>
                <p className="text-xs font-bold text-[#165f4d]">{m.month(values.durationMonths)}</p>
              </div>

              {/* Customer Name */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-0.5">
                  <UserRound size={11} className="text-[#165f4d]" />
                  {m.fullName}
                </span>
                <p className="text-xs font-bold text-slate-900 truncate">{values.fullName}</p>
              </div>

              {/* Customer Phone */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-0.5">
                  <Phone size={11} className="text-[#165f4d]" />
                  {m.phone}
                </span>
                <p className="text-xs font-bold text-slate-900">{values.phone}</p>
              </div>

              {/* Customer Email */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-0.5">
                  <Mail size={11} className="text-[#165f4d]" />
                  {m.email}
                </span>
                <p className="text-xs font-bold text-slate-900 truncate">{values.email}</p>
              </div>
            </div>

            {state.note && (
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-xs">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
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
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              onClick={() => state.setStep(1)}
            >
              <ArrowLeft size={13} />
              <span>{m.back}</span>
            </button>

            <button
              type="button"
              className="h-9 px-4.5 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              onClick={state.next}
            >
              <span>{m.checkout}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Right column: Summary */}
        <div className="lg:col-span-4">
          <CheckoutSummary state={state} />
        </div>
      </div>
    </>
  );
}
