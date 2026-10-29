"use client";

import { CUSTOMER_WORKSPACE as C } from "@metastorage/shared";
import { AlertCircle, ArrowRight, CheckCircle2, Landmark, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutState } from "./checkout.types";
import { CheckoutRow, CheckoutSummary } from "./checkout-parts";

export function CheckoutPayment({ state }: { state: CheckoutState }) {
  const pathname = usePathname();
  const restartPath = pathname?.startsWith("/customer/")
    ? routes.customer.newReservation
    : routes.reservationNew;

  const pending = state.pendingPayment;
  const status = state.paymentStatusQuery.data?.status;
  const terminal = status === "FAILED" || status === "REFUND_PENDING" || status === "REFUNDED";

  return (
    <>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">{m.paymentTitle}</h1>
        <p className="text-xs text-slate-500">{m.paymentDescription}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Payment Details */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          {/* Payment Method Badge */}
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
            <div className="size-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-[#165f4d] shadow-xs">
              <Landmark size={20} />
            </div>
            <div>
              <strong className="block text-sm font-bold text-slate-900">{m.sepayTitle}</strong>
              <p className="text-xs text-slate-500">
                {isMockMode ? m.mockPaymentDescription : m.sepayDescription}
              </p>
            </div>
          </div>

          {!state.paidPricing ? (
            <div
              role="status"
              className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800"
            >
              <strong className="block font-bold">{m.paymentUnavailable}</strong>
              <span>{m.pricingNotice}</span>
            </div>
          ) : null}

          {/* If currently redirecting or initiating payment */}
          {(state.paying || state.isRedirecting) && (
            <div className="p-6 rounded-xl border border-emerald-200 bg-emerald-50/30 text-center space-y-2">
              <Loader2 size={24} className="animate-spin text-[#165f4d] mx-auto" />
              <p className="text-xs font-bold text-slate-800">
                Đang chuyển hướng đến cổng thanh toán SePay...
              </p>
              <p className="text-[11px] text-slate-500">
                Vui lòng không đóng trình duyệt hoặc tải lại trang.
              </p>
            </div>
          )}

          {/* Pending Payment Box */}
          {pending ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[#165f4d]" />
                  <span>
                    {status === "REFUND_PENDING"
                      ? m.refundPending
                      : status === "REFUNDED"
                        ? m.refunded
                        : status === "FAILED"
                          ? m.paymentFailed
                          : m.waitingPayment}
                  </span>
                </h2>
                <span className="text-[11px] font-mono text-slate-500">{pending.paymentCode}</span>
              </div>

              <CheckoutRow label={m.paymentCode}>{pending.paymentCode}</CheckoutRow>

              {/* Manual fallback form if auto-redirect was delayed */}
              {!terminal &&
              state.holdSeconds > 0 &&
              pending.checkoutUrl &&
              pending.checkoutFormFields ? (
                <form
                  action={pending.checkoutUrl}
                  method="POST"
                  target="_self"
                  rel="noopener noreferrer"
                  className="pt-2"
                >
                  {Object.entries(pending.checkoutFormFields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={String(value)} />
                  ))}
                  <button
                    type="submit"
                    className="w-full h-11 bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                  >
                    <span>{m.openGateway}</span>
                    <ArrowRight size={14} />
                  </button>
                </form>
              ) : null}

              <p role="status" className="text-[11px] text-slate-500 text-center">
                {state.holdSeconds === 0 && !terminal ? m.expiredPayment : m.waitingHint}
              </p>

              {state.paymentStatusQuery.isError ? (
                <p role="alert" className="text-xs text-rose-600">
                  {m.statusError}
                </p>
              ) : null}

              <button
                type="button"
                className="w-full h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                disabled={state.paymentStatusQuery.isFetching}
                onClick={() => state.paymentStatusQuery.refetch()}
              >
                <RefreshCw
                  size={12}
                  className={state.paymentStatusQuery.isFetching ? "animate-spin" : ""}
                />
                <span>{m.refreshPayment}</span>
              </button>
            </section>
          ) : null}

          {/* Support Ticket Link if needed */}
          {pending && state.draft && (
            <Link
              className="inline-block text-xs font-semibold text-[#165f4d] hover:underline"
              href={`${routes.customer.supportNew}?reservationId=${encodeURIComponent(state.draft.id)}&paymentId=${encodeURIComponent(pending.paymentId)}`}
            >
              {C.newTicket} →
            </Link>
          )}

          {state.paymentError ? (
            <div
              role="alert"
              className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div>
                <strong className="block font-bold">{m.paymentFailed}</strong>
                <span>{state.paymentError}</span>
              </div>
            </div>
          ) : null}

          {terminal ? (
            <Link
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
              href={`${restartPath}?new=1`}
            >
              {m.startAgain}
            </Link>
          ) : null}

          {/* Primary Action Button: 1-click payment */}
          {!pending && (
            <button
              type="button"
              className="w-full h-11 bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!state.paidPricing || state.paying || state.isRedirecting}
              onClick={state.pay}
            >
              {state.paying || state.isRedirecting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang chuyển đến cổng thanh toán...</span>
                </>
              ) : state.paidPricing ? (
                <>
                  <span>Thanh toán ngay bằng SePay</span>
                  <ArrowRight size={15} />
                </>
              ) : (
                <span>{m.paymentUnavailable}</span>
              )}
            </button>
          )}
        </section>

        {/* Right Column: Summary */}
        <div className="lg:col-span-4">
          <CheckoutSummary state={state} />
        </div>
      </div>
    </>
  );
}
