"use client";

import type { BookingConfirmation, BookingDraftPricing } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { ArrowLeft, Check, Copy, Mail, Phone, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Currency } from "@/components/ui/display";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { checkoutMessages as m } from "./checkout.messages";
import { CheckoutRow, UnitPhoto } from "./checkout-parts";

export function CheckoutConfirmation({
  state,
  children,
  qrHint = m.qrHint,
}: {
  state: {
    confirmation:
      | (Omit<BookingConfirmation, "bookingId" | "qrToken" | "qrUrl" | "emailStatus"> & {
          emailStatus?: BookingConfirmation["emailStatus"];
        })
      | null;
    qrDataUrl: string | null;
    paidPricing: BookingDraftPricing | null;
  } & {
    contact?: { fullName?: string; phone?: string; email?: string } | null;
  };
  children?: ReactNode;
  qrHint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const facilitiesPath = pathname?.startsWith("/customer/")
    ? routes.customer.facilities
    : routes.facilities;

  const confirmation = state.confirmation;
  if (!confirmation) return null;

  const customerName = state.contact?.fullName || session?.user?.name;
  const customerEmail = state.contact?.email || session?.user?.email;
  const customerPhone = state.contact?.phone || session?.user?.phone;
  const hasContactInfo = Boolean(customerName || customerEmail || customerPhone);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Success Hero Banner */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <div className="size-12 rounded-2xl bg-emerald-100 text-[#165f4d] flex items-center justify-center shrink-0 shadow-xs">
              <Check size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[#165f4d]">
                  {m.paid}
                </span>
                <h1 className="text-base sm:text-lg font-bold text-slate-900">{m.successful}</h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{m.successDescription}</p>
            </div>
          </div>

          {/* Booking Code Banner */}
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <div className="inline-flex items-center gap-2 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm">
              <span className="text-xs text-slate-500">{m.bookingId}:</span>
              <strong className="min-w-0 break-all font-mono text-xs sm:text-sm font-bold text-slate-900">
                {formatReference(confirmation.bookingCode, "BK")}
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
              {copied ? (
                <span className="text-emerald-700 font-bold text-xs ml-0.5">{m.copied}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Email Status Notice */}
        <p
          role="status"
          className="mt-3 text-xs text-slate-500 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-100 text-center sm:text-left"
        >
          {isMockMode
            ? m.mockEmail
            : confirmation.emailStatus
              ? m.emailStatuses[confirmation.emailStatus]
              : m.reservationConfirmed}
        </p>
      </section>

      {/* Details Grid: QR Code + Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {/* QR Code Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            {m.qrTitle}
          </h2>
          <strong className="block max-w-full break-all text-sm font-mono font-bold text-slate-800 mb-2">
            {formatReference(confirmation.bookingCode, "BK")}
          </strong>
          <div className="flex justify-center my-2">
            {state.qrDataUrl ? (
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs inline-block">
                <Image src={state.qrDataUrl} alt={m.qrTitle} width={160} height={160} unoptimized />
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-8">{m.qrUnavailable}</p>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{qrHint}</p>
        </div>

        {/* Summary Details Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 mb-3 border-b border-slate-100">
              {m.summary}
            </h2>

            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100">
              <div className="size-14 relative rounded-xl overflow-hidden border border-slate-100 shrink-0">
                <UnitPhoto />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {confirmation.facility.name}
                </h3>
                <p className="text-xs text-slate-500 truncate">{confirmation.facility.address}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs sm:text-sm">
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

            {/* Optional Customer Contact info if available */}
            {hasContactInfo && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                {customerName && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <UserRound size={12} className="text-[#165f4d]" />
                      <span>{m.fullName}</span>
                    </span>
                    <strong className="text-slate-800 font-semibold">{customerName}</strong>
                  </div>
                )}
                {customerPhone && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Phone size={12} className="text-[#165f4d]" />
                      <span>{m.phone}</span>
                    </span>
                    <strong className="text-slate-800 font-semibold">{customerPhone}</strong>
                  </div>
                )}
                {customerEmail && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Mail size={12} className="text-[#165f4d]" />
                      <span>{m.email}</span>
                    </span>
                    <strong className="text-slate-800 font-semibold">{customerEmail}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {state.paidPricing ? (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-600">{m.total}</span>
              <strong className="text-base font-bold text-[#165f4d]">
                <Currency value={Number(state.paidPricing.totalAmount)} />
              </strong>
            </div>
          ) : null}
        </div>
      </div>

      {children}

      {/* Action Links - "Booking" button removed as requested */}
      <div className="flex items-center justify-center pt-2">
        <Link
          className="h-10 px-6 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          href={facilitiesPath}
        >
          <ArrowLeft size={14} />
          <span>{m.backToFacilities}</span>
        </Link>
      </div>
    </div>
  );
}
