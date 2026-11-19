"use client";
import { createMobilePaymentReturn } from "@metastorage/shared";
import { Loader2 } from "lucide-react";
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
  const [minLoadingDone, setMinLoadingDone] = useState(process.env.NODE_ENV === "test");

  useEffect(() => {
    if (minLoadingDone) return;
    const timer = window.setTimeout(() => {
      setMinLoadingDone(true);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [minLoadingDone]);

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
  const isPending = message === m.pending;
  const isWaiting =
    (canRead && (!minLoadingDone || isPending || query.isLoading)) || (!confirmedId && isPending);
  const showReceipt = canRead && Boolean(confirmedId) && minLoadingDone;

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
        (showReceipt ? (
          <ReservationReceipt
            key={confirmedId}
            reservationId={confirmedId as string}
            variant="confirmation"
          />
        ) : isWaiting ? (
          <section className="grid gap-5 rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-xs max-w-xl mx-auto text-center my-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{m.title}</h1>

            <div className="relative my-2 flex items-center justify-center">
              <span className="absolute inline-flex size-24 animate-ping rounded-full bg-emerald-500/15" />
              <div className="relative flex size-20 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200/80 shadow-xs">
                <Loader2 className="size-9 animate-spin text-[#165f4d]" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-semibold text-slate-800">{m.processingTitle}</h2>
              <div>
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                >
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {m.pending}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 my-0.5">
              <span className="size-1.5 rounded-full bg-[#165f4d] animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1.5 rounded-full bg-[#165f4d] animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1.5 rounded-full bg-[#165f4d] animate-bounce" />
            </div>

            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {m.pendingHint}
            </p>

            {canRead && (
              <div className="pt-2">
                <button
                  className="inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] px-5 text-xs font-bold text-white transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-60"
                  type="button"
                  disabled={query.isFetching}
                  onClick={() => query.refetch()}
                >
                  {query.isFetching && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{m.retry}</span>
                </button>
              </div>
            )}
          </section>
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

  if (isCustomer || (session && !appReturnUrl)) {
    return content;
  }

  return <PublicLayout>{content}</PublicLayout>;
}
