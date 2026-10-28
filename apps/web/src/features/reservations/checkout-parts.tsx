"use client";

import { ArrowRight, Check, LockKeyhole, MapPin } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Currency } from "@/components/ui/display";
import { cn } from "@/lib/utils";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutPanelProps, CheckoutState } from "./checkout.types";

export function CheckoutProgress({ step }: { step: number }) {
  return (
    <nav
      aria-label="Tiến trình đặt kho"
      className="mb-3 sm:mb-4 rounded-xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-xs"
    >
      <ol className="flex items-center justify-between">
        {m.steps.map((label, i) => {
          const isCurrent = i === step;
          const isComplete = i < step;
          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className="flex-1 flex items-center last:flex-none"
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  className={cn(
                    "flex size-6 sm:size-7 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold transition-all shrink-0",
                    isCurrent &&
                      "bg-[#165f4d] text-white shadow-xs ring-2 sm:ring-4 ring-[#165f4d]/15",
                    isComplete && "bg-emerald-100 text-[#165f4d]",
                    !isCurrent && !isComplete && "bg-slate-100 text-slate-400",
                  )}
                >
                  {isComplete ? <Check size={13} className="stroke-[2.5]" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden sm:inline text-xs font-semibold whitespace-nowrap",
                    isCurrent && "text-slate-900 font-bold",
                    isComplete && "text-slate-600",
                    !isCurrent && !isComplete && "text-slate-400",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < m.steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 sm:mx-3 h-[2px] flex-1 rounded-full transition-colors",
                    isComplete ? "bg-[#165f4d]" : "bg-slate-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CheckoutPanel({ title, children, onEdit }: CheckoutPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {onEdit ? (
          <button
            className="text-xs font-semibold text-[#165f4d] hover:text-[#0f493b] hover:underline cursor-pointer"
            type="button"
            onClick={onEdit}
          >
            {m.edit}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CheckoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-500">{label}</span>
      <strong className="text-slate-900 font-semibold">{children}</strong>
    </div>
  );
}

export function UnitPhoto({ index = 0 }: { index?: number }) {
  return (
    <Image
      src={`/images/metastorage/unit-${index % 3}.png`}
      alt={m.illustration}
      fill
      className="object-cover"
      sizes="(max-width: 760px) 100vw, 300px"
    />
  );
}

export function CheckoutSummary({ state }: { state: CheckoutState }) {
  const { selectedOption: option, selectedFacility: facility, form, step } = state;
  const months = form.watch("durationMonths");
  const pricing = state.draft?.pricing;

  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm sticky top-4"
      aria-label={m.summary}
    >
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-3 border-b border-slate-100">
        {step === 1 ? m.serviceSummary : step >= 2 ? m.billing : m.summary}
      </h2>

      {option && step > 0 ? (
        <div className="h-28 w-full relative rounded-xl overflow-hidden border border-slate-100 my-3">
          <UnitPhoto
            index={state.availabilityQuery.data?.findIndex(
              (item) => item.unitTypeId === option.unitTypeId,
            )}
          />
        </div>
      ) : null}

      <div className="my-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {m.unit}
        </span>
        <h3 className="text-sm font-bold text-slate-900 leading-tight">
          {option?.unitType ?? m.unitNotSelected}
        </h3>
        {option && !option.unitType.includes(option.sizeLabel) ? (
          <p className="text-xs text-slate-500 mt-1 font-medium">{option.sizeLabel}</p>
        ) : null}
        <div className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
          <MapPin size={14} className="shrink-0 text-slate-400 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold text-slate-700 block text-xs">{facility?.name}</span>
            <span className="text-[11px] text-slate-400 block truncate">{facility?.address}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 py-3 border-y border-slate-100 my-3">
        <CheckoutRow label={m.unitPrice}>
          {option ? (
            <>
              <Currency
                value={pricing ? Number(pricing.monthlyRateSnapshot) : option.monthlyPrice}
              />{" "}
              {m.monthly}
            </>
          ) : (
            "—"
          )}
        </CheckoutRow>
        {step > 0 ? <CheckoutRow label={m.duration}>{m.month(months)}</CheckoutRow> : null}
        {step >= 2 ? (
          <>
            <CheckoutRow label={m.rental}>
              {pricing ? <Currency value={Number(pricing.rentalFeeAmount)} /> : "—"}
            </CheckoutRow>
            <CheckoutRow label={m.deposit}>
              {pricing ? <Currency value={Number(pricing.depositAmount)} /> : m.pendingPricing}
            </CheckoutRow>
          </>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <span className="text-xs font-semibold text-slate-600">
          {step >= 2 ? m.total : m.estimate}
        </span>
        <strong className="text-base font-bold text-[#165f4d]">
          {step >= 2 ? (
            pricing ? (
              <Currency value={Number(pricing.totalAmount)} />
            ) : (
              m.pendingPricing
            )
          ) : option ? (
            <Currency value={option.monthlyPrice * (step === 0 ? 1 : months)} />
          ) : (
            "—"
          )}
        </strong>
      </div>

      {step >= 2 && !pricing ? (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">{m.pricingNotice}</p>
      ) : null}

      {step === 0 ? (
        <button
          type="button"
          className="mt-4 w-full h-10 bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={
            !option ||
            option.availableCount === 0 ||
            state.availabilityQuery.isFetching ||
            state.availabilityQuery.isError
          }
          onClick={state.next}
        >
          <span>{m.nextContact}</span>
          <ArrowRight size={14} />
        </button>
      ) : null}

      {state.hold && step >= 2 ? (
        <p role="status" className="mt-2 text-center text-xs text-amber-700 font-medium">
          {state.holdSeconds > 0
            ? `${m.expiry}: ${Math.floor(state.holdSeconds / 60)}:${String(state.holdSeconds % 60).padStart(2, "0")}`
            : m.expired}
        </p>
      ) : null}

      <p className="mt-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
        <LockKeyhole size={11} className="text-slate-400" />
        <span>{step < 2 ? m.noPaymentYet : m.paymentVerified}</span>
      </p>
    </aside>
  );
}
