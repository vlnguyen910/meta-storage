"use client";
import type { ReturnRequestDetailDto } from "@metastorage/contracts";
import { F3 } from "./integration.messages";
import { f3Panel, money, readWholeVnd } from "./integration-utils";
import { MoneyRows, RefundBalances } from "./return-money-summary";
import { ReturnRefundForm } from "./return-refund-form";
import { ReturnSettlementForm } from "./return-settlement-form";

export function ReturnFinancePanel({
  detail,
  manager,
  stale = false,
}: {
  detail: ReturnRequestDetailDto;
  manager: boolean;
  stale?: boolean;
}) {
  const settlement = detail.settlements[0];
  const summary = detail.refundSummary;
  const refundable = summary && (readWholeVnd(summary.remainingRefund) ?? 0n) > 0n;
  return (
    <section className={f3Panel}>
      <h2 className="font-bold text-lg">{F3.settlement}</h2>
      {!settlement && <p>{F3.noSettlement}</p>}
      {stale && (
        <p role="alert" className="text-amber-950">
          {F3.refreshFailed}
        </p>
      )}
      {manager && !settlement && !["CANCELLED", "COMPLETED"].includes(detail.request.status) && (
        <ReturnSettlementForm detail={detail} stale={stale} />
      )}
      {detail.settlements.map((entry) => (
        <details
          key={entry.id}
          open={entry.id === settlement?.id}
          className="border-t border-slate-200 pt-3"
        >
          <summary className="min-h-11 cursor-pointer font-bold">
            {F3.version(entry.revision)}
          </summary>
          <MoneyRows
            rows={[
              [F3.deposit, entry.depositSnapshot],
              [F3.overdue, entry.overdueFeeAmount],
              [F3.damage, entry.damageAmount],
              [F3.rentRefund, entry.unusedRentRefundAmount],
              [F3.entitlement, entry.refundEntitlement],
              [F3.debt, entry.debtAmount],
            ]}
          />
        </details>
      ))}
      {summary && <RefundBalances summary={summary} />}
      <h3 className="font-semibold">{F3.refundHistory}</h3>
      <ul className="space-y-2">
        {detail.refunds.map((refund) => (
          <li
            key={refund.id}
            className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm break-words"
          >
            <strong>{money(refund.amount)}</strong> · {refund.reference}
            <p>
              {F3.deposit}:{" "}
              {refund.depositRefundAmount === null ? F3.unknown : money(refund.depositRefundAmount)}{" "}
              · {F3.rentRefund}:{" "}
              {refund.rentRefundAmount === null ? F3.unknown : money(refund.rentRefundAmount)}
            </p>
            <p>
              {new Date(refund.confirmedAt).toLocaleString("vi-VN", {
                timeZone: detail.request.timezone,
              })}
            </p>
          </li>
        ))}
      </ul>
      {manager &&
        refundable &&
        (detail.request.status !== "COMPLETED" ? (
          <p>{F3.notClosed}</p>
        ) : !summary.allocationKnown ? (
          <p
            role="status"
            className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950"
          >
            {F3.allocationUnknown}
          </p>
        ) : (
          <ReturnRefundForm detail={detail} stale={stale} />
        ))}
      {manager && settlement && !summary && <p role="status">{F3.unknown}</p>}
    </section>
  );
}
