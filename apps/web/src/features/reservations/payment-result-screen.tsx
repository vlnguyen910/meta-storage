"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Spinner } from "@/components/ui/spinner";
import { customerRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { useCheckoutPaymentStatus } from "./booking-checkout.hooks";
import type { CheckoutContext } from "./booking-checkout.types";
import { readCheckoutContext } from "./checkout-storage";
import { paymentResultMessages as m } from "./payment-result.messages";
import { ReservationReceipt } from "./reservation-receipt";

export function PaymentResultScreen() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const paymentId = params.get("paymentId");
  const reservationId = params.get("reservationId");
  const session = useAuthStore((state) => state.session);
  const authReady = useAuthStore((state) => state.authReady);
  const [context, setContext] = useState<CheckoutContext | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!session || pathname !== "/bookings/payment-result") return;
    const query = params.toString();
    router.replace(`${customerRoutes.paymentResult}${query ? `?${query}` : ""}`);
  }, [pathname, params, router, session]);
  useEffect(() => {
    const saved = readCheckoutContext();
    if (
      saved?.payment?.paymentId === paymentId &&
      (!reservationId || saved.draft.id === reservationId)
    )
      setContext(saved);
    else setContext(null);
    setReady(true);
  }, [paymentId, reservationId]);
  const canRead = ready && authReady && Boolean(session);
  const query = useCheckoutPaymentStatus(paymentId, undefined, canRead);
  const confirmedId =
    canRead && !query.isError && query.data?.status === "SUCCEEDED"
      ? query.data.reservationId
      : undefined;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = context?.payment && Date.parse(context.payment.expiresAt) <= now;
  const message = !paymentId
    ? m.missing
    : !ready || !authReady
      ? m.loading
      : !canRead
        ? m.accessRequired
        : query.isError
          ? m.error
          : query.isLoading
            ? m.loading
            : query.data?.status === "FAILED"
              ? m.failed
              : query.data?.status === "REFUND_PENDING"
                ? m.refundPending
                : query.data?.status === "REFUNDED"
                  ? m.refunded
                  : expired
                    ? m.expired
                    : m.pending;
  const blockingPaymentCheck = canRead && query.isFetching && !query.data;
  const isCustomer = pathname?.startsWith("/customer/");

  const content = (
    <main aria-busy={blockingPaymentCheck} className="mx-auto w-full max-w-4xl px-4 py-2 sm:py-3">
      {blockingPaymentCheck && <Spinner label={m.loading} />}
      {confirmedId ? (
        <ReservationReceipt key={confirmedId} reservationId={confirmedId} />
      ) : (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs max-w-xl mx-auto">
          <h1 className="text-xl font-bold text-slate-900">{m.title}</h1>
          <p role={query.isError ? "alert" : "status"} className="text-sm text-slate-600">
            {message}
          </p>
          {canRead && (
            <>
              <p className="text-xs text-slate-500">{m.pendingHint}</p>
              <button
                className="h-10 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] px-4 text-xs font-bold text-white transition-colors cursor-pointer"
                type="button"
                disabled={query.isFetching}
                onClick={() => query.refetch()}
              >
                {m.retry}
              </button>
            </>
          )}
          {!canRead && ready && (
            <Link className="text-xs font-semibold text-[#165f4d] underline" href="/login">
              {m.login}
            </Link>
          )}
        </section>
      )}
      {!isCustomer && (
        <div className="text-center mt-3">
          <Link
            aria-disabled={blockingPaymentCheck}
            className={`inline-flex items-center text-xs font-semibold text-[#165f4d] hover:underline ${blockingPaymentCheck ? "pointer-events-none opacity-50" : ""}`}
            href="/customer/booking/new?new=1"
          >
            {m.newBooking}
          </Link>
        </div>
      )}
    </main>
  );

  if (isCustomer) {
    return content;
  }

  return <PublicLayout>{content}</PublicLayout>;
}
