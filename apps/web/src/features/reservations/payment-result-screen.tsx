"use client";
import { createMobilePaymentReturn } from "@metastorage/shared";
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
import { readMobilePaymentReturn } from "./mobile-payment-return-storage";
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
  const lookupKey = `${pathname}:${paymentId ?? ""}:${reservationId ?? ""}`;
  const [loadedKey, setLoadedKey] = useState<string>();
  const ready = loadedKey === lookupKey;
  const [now, setNow] = useState(Date.now());
  const [appReturnUrl, setAppReturnUrl] = useState<string>();
  const nativeReturnUrl = paymentId ? createMobilePaymentReturn(paymentId, reservationId) : null;
  useEffect(() => {
    setAppReturnUrl(
      paymentId && !pathname.startsWith("/customer/")
        ? readMobilePaymentReturn(paymentId, reservationId)
        : undefined,
    );
    const saved = readCheckoutContext();
    if (
      saved?.payment?.paymentId === paymentId &&
      (!reservationId || saved.draft.id === reservationId)
    )
      setContext(saved);
    else setContext(null);
    setLoadedKey(lookupKey);
  }, [paymentId, reservationId, pathname, lookupKey]);
  const returnParams = new URLSearchParams();
  if (paymentId) returnParams.set("paymentId", paymentId);
  if (reservationId) returnParams.set("reservationId", reservationId);
  const returnTo = `${customerRoutes.paymentResult}?${returnParams.toString()}`;
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  useEffect(() => {
    if (
      !authReady ||
      !session ||
      pathname !== "/bookings/payment-result" ||
      !ready ||
      appReturnUrl ||
      !nativeReturnUrl
    )
      return;
    router.replace(returnTo);
  }, [pathname, router, session, authReady, ready, appReturnUrl, nativeReturnUrl, returnTo]);
  const canRead =
    ready && authReady && Boolean(session) && Boolean(nativeReturnUrl) && !appReturnUrl;
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
  const message = !nativeReturnUrl
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
      {appReturnUrl && (
        <section className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-bold text-slate-900">{m.title}</h1>
          <p className="text-sm text-slate-600">{m.returnToAppHint}</p>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#165f4d] px-4 font-semibold text-white"
            href={appReturnUrl}
          >
            {m.returnToApp}
          </a>
          <p className="text-xs text-slate-500">{m.manualAppReturnHint}</p>
          <Link className="text-sm font-semibold text-[#165f4d] underline" href={returnTo}>
            {m.viewOnWeb}
          </Link>
        </section>
      )}
      {blockingPaymentCheck && <Spinner label={m.loading} />}
      {!appReturnUrl &&
        (confirmedId ? (
          <ReservationReceipt
            key={confirmedId}
            reservationId={confirmedId}
            variant="confirmation"
          />
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
            {!session && ready && authReady && nativeReturnUrl && (
              <div className="grid gap-3">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#165f4d] px-4 font-semibold text-white"
                  href={loginHref}
                >
                  {m.login}
                </Link>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 font-semibold text-[#165f4d]"
                  href={nativeReturnUrl}
                >
                  {m.openInApp}
                </a>
                <p className="text-xs text-slate-500">{m.manualAppReturnHint}</p>
              </div>
            )}
          </section>
        ))}
      {!isCustomer && !appReturnUrl && (
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
