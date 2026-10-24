"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/features/auth/auth-store";
import { useCheckoutPaymentStatus } from "./booking-checkout.hooks";
import type { CheckoutContext } from "./booking-checkout.types";
import styles from "./checkout.module.css";
import { CheckoutConfirmation } from "./checkout-confirmation";
import { clearCheckoutContext, readCheckoutContext } from "./checkout-storage";
import { paymentResultMessages as m } from "./payment-result.messages";

export function PaymentResultScreen() {
  const params = useSearchParams();
  const paymentId = params.get("paymentId");
  const bookingId = params.get("bookingId");
  const session = useAuthStore((state) => state.session);
  const [context, setContext] = useState<CheckoutContext | null>(null);
  const [ready, setReady] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const saved = readCheckoutContext();
    if (saved?.payment?.paymentId === paymentId && (!bookingId || saved.draft.id === bookingId))
      setContext(saved);
    else setContext(null);
    setReady(true);
  }, [paymentId, bookingId]);
  const canRead = ready && Boolean(context || session);
  const query = useCheckoutPaymentStatus(paymentId, context?.draft.draftAccessToken, canRead);
  const confirmation =
    canRead && !query.isError && query.data?.status === "SUCCEEDED"
      ? query.data.confirmation
      : undefined;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!confirmation) return;
    clearCheckoutContext();
    let active = true;
    QRCode.toDataURL(confirmation.qrUrl, { width: 320, margin: 1 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [confirmation]);
  const expired = context?.payment && Date.parse(context.payment.expiresAt) <= now;
  const message = !paymentId
    ? m.missing
    : !ready
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
  const blockingPaymentCheck =
    canRead &&
    !confirmation &&
    !query.isError &&
    (query.isPending ||
      query.isFetching ||
      query.data?.status === "PENDING" ||
      (query.data?.status === "SUCCEEDED" && !query.data.confirmation));
  return (
    <PublicLayout>
      <main
        aria-busy={blockingPaymentCheck}
        className={`${styles.checkout} mx-auto min-h-[70vh] w-full max-w-5xl px-5 py-12`}
      >
        {confirmation ? (
          <CheckoutConfirmation
            state={{ confirmation, qrDataUrl: qr, paidPricing: context?.draft.pricing ?? null }}
          />
        ) : (
          <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold">{m.title}</h1>
            <p role={query.isError ? "alert" : "status"}>{message}</p>
            {canRead && (
              <>
                <p>{m.pendingHint}</p>
                <button
                  className="min-h-11 rounded bg-emerald-900 px-5 text-white"
                  type="button"
                  disabled={query.isFetching}
                  onClick={() => query.refetch()}
                >
                  {m.retry}
                </button>
              </>
            )}
            {!canRead && ready && <Link href="/login">{m.login}</Link>}
          </section>
        )}
        <Link
          aria-disabled={blockingPaymentCheck}
          className={`mt-6 inline-flex min-h-11 items-center underline ${blockingPaymentCheck ? "pointer-events-none opacity-50" : ""}`}
          href="/reservations/new?new=1"
        >
          {m.newBooking}
        </Link>
      </main>
      {blockingPaymentCheck ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-[min(360px,100%)] flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-2xl">
            <Spinner size="xl" label={m.loading} />
            <strong className="text-lg text-slate-900">{m.loading}</strong>
            <p className="m-0 text-sm text-slate-600">Vui lòng chờ hệ thống xác nhận giao dịch.</p>
          </div>
        </div>
      ) : null}
    </PublicLayout>
  );
}
