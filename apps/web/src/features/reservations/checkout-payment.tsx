"use client";
import { ArrowLeft, CreditCard, Landmark, Wallet } from "lucide-react";
import { Currency } from "@/components/ui/display";
import { isMockMode } from "@/config/api-mode";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import type { CheckoutState } from "./checkout.types";
import { CheckoutRow, CheckoutSummary } from "./checkout-parts";

export function CheckoutPayment({ state }: { state: CheckoutState }) {
  const pending = state.pendingPayment;
  const methods = [
    {
      name: isMockMode ? m.mockPayment : m.sepayTitle,
      description: isMockMode ? m.mockPaymentDescription : m.sepayDescription,
      icon: Landmark,
    },
    { name: m.domestic, description: m.comingSoon, icon: CreditCard },
    { name: m.international, description: m.comingSoon, icon: CreditCard },
    { name: m.wallet, description: m.comingSoon, icon: Wallet },
  ];
  return (
    <>
      <h1 className={s.title}>{m.paymentTitle}</h1>
      <p className={s.description}>{m.paymentDescription}</p>
      <div className={s.layout}>
        <section className={s.panel}>
          {methods.map((method) => (
            <div key={method.name} className={s.paymentOption}>
              <method.icon size={21} />
              <div>
                <strong>{method.name}</strong>
                <small>{method.description}</small>
              </div>
            </div>
          ))}
          {!state.draft?.pricing ? (
            <p role="status" className={s.notice}>
              <strong>{m.paymentUnavailable}</strong>
              <br />
              {m.pricingNotice}
            </p>
          ) : null}
          {pending ? (
            <section className={s.detailBox}>
              <h2>{m.waitingPayment}</h2>
              <CheckoutRow label={m.paymentCode}>{pending.paymentCode}</CheckoutRow>
              {pending.checkoutUrl && pending.checkoutFormFields ? (
                <form
                  action={pending.checkoutUrl}
                  method="POST"
                  target="_blank"
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
              {pending.transferInstructions ? (
                <div className={s.rows}>
                  <CheckoutRow label={m.bankName}>
                    {pending.transferInstructions.bankName}
                  </CheckoutRow>
                  <CheckoutRow label={m.accountNumber}>
                    {pending.transferInstructions.accountNumber}
                  </CheckoutRow>
                  <CheckoutRow label={m.accountName}>
                    {pending.transferInstructions.accountName}
                  </CheckoutRow>
                  <CheckoutRow label={m.total}>
                    <Currency value={Number(pending.transferInstructions.amount)} />
                  </CheckoutRow>
                  <CheckoutRow label={m.transferContent}>
                    {pending.transferInstructions.content}
                  </CheckoutRow>
                </div>
              ) : null}
              <p role="status" className={s.fieldHint}>
                {m.waitingHint}
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
          {state.paymentError ? (
            <div role="alert" className={s.notice}>
              <strong>{m.paymentFailed}</strong>
              <p>{state.paymentError}</p>
            </div>
          ) : null}
          <button
            type="button"
            className={`${s.primary} ${s.full} mt-6`}
            disabled={
              !state.draft?.pricing || state.holdSeconds <= 0 || state.paying || Boolean(pending)
            }
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
            {state.holdSeconds === 0 && !pending ? (
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
