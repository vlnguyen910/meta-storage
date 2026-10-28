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
import { CheckoutPanel, CheckoutRow, UnitPhoto } from "./checkout-parts";

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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Hero */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 md:p-8 text-center shadow-xs">
        <div className="size-14 rounded-2xl bg-emerald-100 text-[#165f4d] flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Check size={28} className="stroke-[2.5]" />
        </div>
        <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#165f4d]">
          {m.paid}
        </span>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2">{m.successful}</h1>
        <p className="text-xs text-slate-500 mt-1">{m.successDescription}</p>

        {/* Booking Code Banner */}
        <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
          <span className="text-slate-500">{m.bookingId}:</span>
          <strong className="font-mono text-sm font-bold text-slate-900">
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
            <Copy size={14} />
          </button>
          {copied ? <span className="text-emerald-700 font-bold ml-1">{m.copied}</span> : null}
        </div>

        <p
          role="status"
          className="mt-4 text-xs text-slate-500 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 max-w-md mx-auto"
        >
          {isMockMode ? m.mockEmail : m.emailStatuses[confirmation.emailStatus]}
        </p>
      </section>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* QR Code Panel */}
        <CheckoutPanel title={m.qrTitle}>
          <div className="text-center p-3">
            <strong className="block text-xs font-mono font-bold text-slate-700 mb-2">
              {confirmation.bookingCode}
            </strong>
            <div className="flex justify-center my-2">
              {state.qrDataUrl ? (
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs inline-block">
                  <Image
                    src={state.qrDataUrl}
                    alt={m.qrTitle}
                    width={180}
                    height={180}
                    unoptimized
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-8">{m.qrUnavailable}</p>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{m.qrHint}</p>
          </div>
        </CheckoutPanel>

        {/* Summary Details */}
        <CheckoutPanel title={m.summary}>
          <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100">
            <div className="size-14 relative rounded-lg overflow-hidden border border-slate-100 shrink-0">
              <UnitPhoto />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {confirmation.facility.name}
              </h3>
              <p className="text-xs text-slate-500 truncate">{confirmation.facility.address}</p>
            </div>
          </div>

          <div className="space-y-1.5 py-1">
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

          {state.paidPricing ? (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-600">{m.total}</span>
              <strong className="text-base font-bold text-[#165f4d]">
                <Currency value={Number(state.paidPricing.totalAmount)} />
              </strong>
            </div>
          ) : null}
        </CheckoutPanel>
      </div>

      {/* Action Links */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          href={routes.customer.reservation(confirmation.bookingId)}
        >
          {C.booking}
        </Link>
        <Link
          className="w-full sm:w-auto h-11 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          href={facilitiesPath}
        >
          <ArrowLeft size={14} />
          {m.backToFacilities}
        </Link>
      </div>
    </div>
  );
}
