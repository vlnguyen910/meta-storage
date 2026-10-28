"use client";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, UserRound } from "lucide-react";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import type { CheckoutState } from "./checkout.types";
import { CheckoutPanel, CheckoutSummary, UnitPhoto } from "./checkout-parts";

export function CheckoutReview({ state }: { state: CheckoutState }) {
  const values = state.form.getValues();
  return (
    <>
      <h1 className={s.title}>{m.reviewTitle}</h1>
      <p className={s.description}>{m.paymentDescription}</p>
      <div className={s.layout}>
        <div className={s.stack}>
          <CheckoutPanel title={m.details} onEdit={() => state.setStep(0)}>
            <div className={s.detailUnit}>
              <div className={s.detailImage}>
                <UnitPhoto
                  index={state.availabilityQuery.data?.findIndex(
                    (item) => item.unitTypeId === state.selectedOption?.unitTypeId,
                  )}
                />
              </div>
              <div>
                <h3 className={s.summaryUnit}>{state.selectedOption?.unitType}</h3>
                <p className={s.address}>
                  {state.selectedFacility?.name}
                  <br />
                  {state.selectedFacility?.address}
                </p>
                <div className={`${s.specs} mt-3`}>
                  <div>
                    <span className={s.caption}>{m.area}</span>
                    {state.selectedOption?.sizeSqm} m²
                  </div>
                  <div>
                    <span className={s.caption}>{m.dimensions}</span>
                    {state.selectedOption?.lengthM} × {state.selectedOption?.widthM} ×{" "}
                    {state.selectedOption?.heightM} m
                  </div>
                </div>
              </div>
            </div>
          </CheckoutPanel>
          <CheckoutPanel title={m.schedule} onEdit={() => state.setStep(1)}>
            <div className={s.detailGrid}>
              <div className={s.detailBox}>
                <CalendarDays size={18} />
                <span className={s.caption}>{m.date}</span>
                {new Date(`${values.checkInDate}T00:00:00+07:00`).toLocaleDateString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </div>
              <div className={s.detailBox}>
                <Clock3 size={18} />
                <span className={s.caption}>{m.time}</span>
                {state.selectedSlot?.startTime.slice(0, 5)}
                <span className={s.caption}>{m.timeHint}</span>
              </div>
              <div className={s.detailBox}>
                <CalendarDays size={18} />
                <span className={s.caption}>{m.duration}</span>
                {m.month(values.durationMonths)}
              </div>
            </div>
          </CheckoutPanel>
          <CheckoutPanel title={m.contact} onEdit={() => state.setStep(1)}>
            <div className={s.formGrid}>
              <div className={s.detailBox}>
                <UserRound size={18} />
                <span className={s.caption}>{m.fullName}</span>
                {values.fullName}
              </div>
              <div className={s.detailBox}>
                <span className={s.caption}>{m.phone}</span>
                {values.phone}
              </div>
              <div className={`${s.detailBox} ${s.wide}`}>
                <span className={s.caption}>{m.email}</span>
                {values.email}
              </div>
              {state.note ? (
                <div className={`${s.detailBox} ${s.wide}`}>
                  <span className={s.caption}>{m.note}</span>
                  {state.note}
                </div>
              ) : null}
            </div>
          </CheckoutPanel>
          <div className={s.actions}>
            <button type="button" className={s.secondary} onClick={() => state.setStep(1)}>
              <ArrowLeft size={14} className="inline mr-2" />
              {m.back}
            </button>
            <button type="button" className={s.primary} onClick={state.next}>
              {m.checkout}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <CheckoutSummary state={state} />
      </div>
    </>
  );
}
