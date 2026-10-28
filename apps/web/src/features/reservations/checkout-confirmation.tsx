"use client";

import { CUSTOMER_WORKSPACE as C } from "@metastorage/shared";
import { ArrowLeft, Check, Copy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Currency } from "@/components/ui/display";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutState } from "./checkout.types";
import { CheckoutRow, UnitPhoto } from "./checkout-parts";

export function CheckoutConfirmation({
  state,
}: {
  state: Pick<CheckoutState, "confirmation" | "qrDataUrl" | "paidPricing">;
}) {
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const facilitiesPath = pathname?.startsWith("/customer/")
    ? routes.customer.facilities
    : routes.facilities;

  const confirmation = state.confirmation;
  if (!confirmation) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Success Hero - Compact banner */}
      <section className="rounded-xl border border-emerald-200 bg-white p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 text-left">
            <div className="size-10 rounded-xl bg-emerald-100 text-[#165f4d] flex items-center justify-center shrink-0 shadow-xs">
              <Check size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#165f4d]">
                  {m.paid}
                </span>
                <h1 className="text-sm sm:text-base font-bold text-slate-900">{m.successful}</h1>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{m.successDescription}</p>
            </div>
          </div>

          {/* Booking Code Banner */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <span className="text-[11px] text-slate-500">{m.bookingId}:</span>
              <strong className="font-mono text-xs font-bold text-slate-900">
                {confirmation.bookingCode}
              </strong>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(confirmation.bookingCode);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
                aria-label={m.copy}
              >
                <Copy size={13} />
              </button>
              {copied ? (
                <span className="text-emerald-700 font-bold text-[10px] ml-0.5">{m.copied}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Email Status Notice */}
        <p
          role="status"
          className="mt-2 text-[11px] text-slate-500 bg-slate-50/70 px-2.5 py-1 rounded-md border border-slate-100 text-center sm:text-left"
        >
          {isMockMode ? m.mockEmail : m.emailStatuses[confirmation.emailStatus]}
        </p>
      </section>

      {/* Details Grid: QR Code + Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
        {/* QR Code Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col items-center justify-center text-center">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {m.qrTitle}
          </h2>
          <strong className="block text-xs font-mono font-bold text-slate-800 mb-1.5">
            {confirmation.bookingCode}
          </strong>
          <div className="flex justify-center my-1">
            {state.qrDataUrl ? (
              <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs inline-block">
                <Image src={state.qrDataUrl} alt={m.qrTitle} width={130} height={130} unoptimized />
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6">{m.qrUnavailable}</p>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{m.qrHint}</p>
        </div>

        {/* Summary Details Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-1.5 mb-2 border-b border-slate-100">
              {m.summary}
            </h2>

            <div className="flex items-center gap-2.5 pb-2 mb-2 border-b border-slate-100">
              <div className="size-11 relative rounded-lg overflow-hidden border border-slate-100 shrink-0">
                <UnitPhoto />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 truncate">
                  {confirmation.facility.name}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {confirmation.facility.address}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <CheckoutRow label={m.date}>
                {new Date(confirmation.checkInSlotStart).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </CheckoutRow>
              <CheckoutRow label={m.unit}>
                {confirmation.unitTypeName} · {confirmation.sizeLabel}
              </CheckoutRow>
              <CheckoutRow label={m.duration}>{m.month(confirmation.durationMonths)}</CheckoutRow>
            </div>
          </div>

          {state.paidPricing ? (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-600">{m.total}</span>
              <strong className="text-sm font-bold text-[#165f4d]">
                <Currency value={Number(state.paidPricing.totalAmount)} />
              </strong>
            </div>
          ) : null}
        </div>
      </div>

      {/* Action Links */}
      <div className="flex items-center justify-center gap-2.5 pt-1">
        <Link
          className="h-9 px-4 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          href={routes.customer.reservation(confirmation.bookingId)}
        >
          {C.booking}
        </Link>
        <Link
          className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          href={facilitiesPath}
        >
          <ArrowLeft size={13} />
          <span>{m.backToFacilities}</span>
        </Link>
      </div>
    </div>
  );
}
