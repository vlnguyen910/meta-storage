"use client";
import { ArrowLeft, Check, Copy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Currency } from "@/components/ui/display";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import type { CheckoutState } from "./checkout.types";
import { CheckoutPanel, CheckoutRow, UnitPhoto } from "./checkout-parts";

export function CheckoutConfirmation({
  state,
}: {
  state: Pick<CheckoutState, "confirmation" | "qrDataUrl" | "paidPricing">;
}) {
  const [copied, setCopied] = useState(false);
  const confirmation = state.confirmation;
  if (!confirmation) return null;
  return (
    <div className={s.success}>
      <section className={s.successHero}>
        <div className={s.successIcon}>
          <Check size={26} />
        </div>
        <span className={s.badge}>{m.paid}</span>
        <h1 className={s.title}>{m.successful}</h1>
        <p className={s.description}>{m.successDescription}</p>
        <div className={s.bookingCode}>
          <span>{m.bookingId}</span>
          <strong>{confirmation.bookingCode}</strong>
          <button
            type="button"
            className={s.secondary}
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
            <Copy size={15} />
          </button>
          {copied ? <span role="status">{m.copied}</span> : null}
        </div>
        <p role="status" className={`${s.detailBox} mt-6`}>
          {isMockMode ? m.mockEmail : m.emailStatuses[confirmation.emailStatus]}
        </p>
      </section>
      <div className={s.successGrid}>
        <CheckoutPanel title={m.qrTitle}>
          <div className={s.qr}>
            <strong>{confirmation.bookingCode}</strong>
            {state.qrDataUrl ? (
              <Image src={state.qrDataUrl} alt={m.qrTitle} width={210} height={210} unoptimized />
            ) : (
              <p>{m.qrUnavailable}</p>
            )}
            <p className={s.address}>{m.qrHint}</p>
          </div>
        </CheckoutPanel>
        <CheckoutPanel title={m.summary}>
          <div className={s.detailUnit}>
            <div className={s.detailImage}>
              <UnitPhoto />
            </div>
            <div>
              <h3 className={s.summaryUnit}>{confirmation.facility.name}</h3>
              <p className={s.address}>{confirmation.facility.address}</p>
            </div>
          </div>
          <div className={s.rows}>
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
          {state.paidPricing ? (
            <div className={s.total}>
              <span className={s.caption}>{m.total}</span>
              <strong>
                <Currency value={Number(state.paidPricing.totalAmount)} />
              </strong>
            </div>
          ) : null}
        </CheckoutPanel>
      </div>
      <div className={s.actions}>
        <Link className={s.primary} href={routes.facilities}>
          <ArrowLeft size={16} />
          {m.backToFacilities}
        </Link>
      </div>
    </div>
  );
}
