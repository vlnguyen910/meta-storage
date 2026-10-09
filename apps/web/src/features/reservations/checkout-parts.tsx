"use client";
import { ArrowRight, Check, LockKeyhole, MapPin } from "lucide-react";
import Image from "next/image";
import { Currency } from "@/components/ui/display";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import type { CheckoutPanelProps, CheckoutState } from "./checkout.types";

export function CheckoutProgress({ step }: { step: number }) {
  return (
    <ol className={s.progress}>
      {m.steps.map((label, i) => (
        <li key={label} aria-current={i === step ? "step" : undefined}>
          <span
            className={`${s.stepNumber} ${i === step ? s.current : i < step ? s.complete : ""}`}
          >
            {i < step ? <Check size={16} /> : i + 1}
          </span>
          <span>
            {i + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CheckoutPanel({ title, children, onEdit }: CheckoutPanelProps) {
  return (
    <section className={s.panel}>
      <div className={s.panelHeading}>
        <h2>{title}</h2>
        {onEdit ? (
          <button className={s.edit} type="button" onClick={onEdit}>
            {m.edit}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CheckoutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.row}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

export function UnitPhoto({ index = 0 }: { index?: number }) {
  return (
    <Image
      src={`/images/metastorage/unit-${index % 3}.png`}
      alt={m.illustration}
      fill
      sizes="(max-width: 760px) 100vw, 300px"
    />
  );
}

export function CheckoutSummary({ state }: { state: CheckoutState }) {
  const { selectedOption: option, selectedFacility: facility, form, step } = state;
  const months = form.watch("durationMonths");
  const pricing = state.draft?.pricing;
  return (
    <aside className={`${s.panel} ${s.sidebar}`}>
      <h2>{step === 1 ? m.serviceSummary : step >= 2 ? m.billing : m.summary}</h2>
      {option && step > 0 ? (
        <div className={s.summaryImage}>
          <UnitPhoto
            index={state.availabilityQuery.data?.findIndex(
              (item) => item.unitTypeId === option.unitTypeId,
            )}
          />
        </div>
      ) : null}
      <span className={s.caption}>{m.unit}</span>
      <h3 className={s.summaryUnit}>{option?.unitType ?? m.unitNotSelected}</h3>
      {option ? <p className={s.address}>{option.sizeLabel}</p> : null}
      <div className={s.address}>
        <MapPin size={14} className="inline mr-1" />
        {facility?.name}
        <p>{facility?.address}</p>
      </div>
      <div className={s.rows}>
        <CheckoutRow label={m.unitPrice}>
          {option ? (
            <>
              <Currency
                value={pricing ? Number(pricing.monthlyRateSnapshot) : option.monthlyPrice}
              />{" "}
              {m.monthly}
            </>
          ) : (
            "—"
          )}
        </CheckoutRow>
        {step > 0 ? <CheckoutRow label={m.duration}>{m.month(months)}</CheckoutRow> : null}
        {step >= 2 ? (
          <>
            <CheckoutRow label={m.rental}>
              {pricing ? <Currency value={Number(pricing.rentalFeeAmount)} /> : "—"}
            </CheckoutRow>
            <CheckoutRow label={m.deposit}>
              {pricing ? <Currency value={Number(pricing.depositAmount)} /> : m.pendingPricing}
            </CheckoutRow>
          </>
        ) : null}
      </div>
      <div className={s.total}>
        <span className={s.caption}>{step >= 2 ? m.total : m.estimate}</span>
        <strong>
          {step >= 2 ? (
            pricing ? (
              <Currency value={Number(pricing.totalAmount)} />
            ) : (
              m.pendingPricing
            )
          ) : option ? (
            <Currency value={option.monthlyPrice * (step === 0 ? 1 : months)} />
          ) : (
            "—"
          )}
        </strong>
      </div>
      {step >= 2 && !pricing ? <p className={s.notice}>{m.pricingNotice}</p> : null}
      {step === 0 ? (
        <button
          type="button"
          className={`${s.primary} ${s.full}`}
          disabled={!option || option.availableCount === 0}
          onClick={state.next}
        >
          {m.nextContact}
          <ArrowRight size={16} />
        </button>
      ) : null}
      {step === 2 ? (
        <button type="button" className={`${s.primary} ${s.full} mt-5`} onClick={state.next}>
          {m.checkout}
          <ArrowRight size={16} />
        </button>
      ) : null}
      {state.hold && step >= 2 ? (
        <p role="status" className={s.fieldHint}>
          {state.holdSeconds > 0
            ? `${m.expiry}: ${Math.floor(state.holdSeconds / 60)}:${String(state.holdSeconds % 60).padStart(2, "0")}`
            : m.expired}
        </p>
      ) : null}
      <p className={s.fine}>
        <LockKeyhole size={12} />
        {step < 2 ? m.noPaymentYet : m.paymentVerified}
      </p>
    </aside>
  );
}
