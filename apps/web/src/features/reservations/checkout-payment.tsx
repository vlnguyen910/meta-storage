"use client";
import { CUSTOMER_WORKSPACE as C } from "@metastorage/shared";
import { ArrowLeft, Landmark } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
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
      <h1 className={s.title}>{m.paymentTitle}</h1>
      <p className={s.description}>{m.paymentDescription}</p>
      <div className={s.layout}>
        <section className={s.panel}>
          <div className={s.paymentOption}>
            <Landmark size={21} aria-hidden="true" />
            <div>
              <strong>{m.sepayTitle}</strong>
              <small>{isMockMode ? m.mockPaymentDescription : m.sepayDescription}</small>
            </div>
          </div>
          {!state.draft?.pricing ? (
            <p role="status" className={s.notice}>
              <strong>{m.paymentUnavailable}</strong>
              <br />
              {m.pricingNotice}
            </p>
          ) : null}
          {pending ? (
            <section className={s.detailBox}>
              <h2>
                {status === "REFUND_PENDING"
                  ? m.refundPending
                  : status === "REFUNDED"
                    ? m.refunded
                    : status === "FAILED"
                      ? m.paymentFailed
                      : m.waitingPayment}
              </h2>
              <CheckoutRow label={m.paymentCode}>{pending.paymentCode}</CheckoutRow>
              {!terminal &&
              state.holdSeconds > 0 &&
              pending.checkoutUrl &&
              pending.checkoutFormFields ? (
                <form
                  action={pending.checkoutUrl}
                  method="POST"
                  target="_self"
                  rel="noopener noreferrer"
                >
                  {Object.entries(pending.checkoutFormFields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={String(value)} />
                  ))}
                  <button type="submit" className={`${s.primary} ${s.full} mt-4`}>
                    {m.openGateway}
                  </button>
                </form>
              ) : null}
              <p role="status" className={s.fieldHint}>
                {state.holdSeconds === 0 && !terminal ? m.expiredPayment : m.waitingHint}
              </p>
              {state.paymentStatusQuery.isError ? (
                <p role="alert" className={s.fieldError}>
                  {m.statusError}
                </p>
              ) : null}
              <button
                type="button"
                className={`${s.secondary} mt-4`}
                disabled={state.paymentStatusQuery.isFetching}
                onClick={() => state.paymentStatusQuery.refetch()}
              >
                {m.refreshPayment}
              </button>
            </section>
          ) : null}
          {pending && state.draft && (
            <Link
              className={s.secondary}
              href={`${routes.customer.supportNew}?bookingId=${encodeURIComponent(state.draft.id)}&paymentId=${encodeURIComponent(pending.paymentId)}`}
            >
              {C.newTicket}
            </Link>
          )}
          {state.paymentError ? (
            <div role="alert" className={s.notice}>
              <strong>{m.paymentFailed}</strong>
              <p>{state.paymentError}</p>
            </div>
          ) : null}
          {terminal ? (
            <Link className={s.secondary} href={`${restartPath}?new=1`}>
              {m.startAgain}
            </Link>
          ) : null}
          <button
            type="button"
            className={`${s.primary} ${s.full} mt-6`}
            disabled={!state.draft?.pricing || state.paying || Boolean(pending)}
            onClick={state.pay}
          >
            {state.paying
              ? m.processing
              : pending
                ? m.waitingPayment
                : state.draft?.pricing
                  ? m.checkout
                  : m.paymentUnavailable}
          </button>
          <div className={s.actions}>
            <button
              type="button"
              className={s.secondary}
              disabled={Boolean(pending)}
              onClick={() => state.setStep(2)}
            >
              <ArrowLeft size={14} className="inline mr-2" />
              {m.back}
            </button>
            {state.hold && state.holdSeconds === 0 && !pending ? (
              <button type="button" className={s.secondary} onClick={() => state.setStep(1)}>
                {m.review}
              </button>
            ) : null}
          </div>
        </section>
        <CheckoutSummary state={state} />
      </div>
    </>
  );
}
