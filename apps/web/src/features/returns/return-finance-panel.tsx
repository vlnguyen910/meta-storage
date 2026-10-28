"use client";
import type { ReturnRequestDetailDto } from "@metastorage/contracts";
import { BadgeDollarSign, ReceiptText } from "lucide-react";
import { OperationalSectionHeader } from "@/components/ui/operational";
import { F3 } from "./integration.messages";
import { f3Panel, money, readWholeVnd } from "./integration-utils";
import { MoneyRows, RefundBalances } from "./return-money-summary";
import { ReturnRefundForm } from "./return-refund-form";
import { ReturnSettlementForm } from "./return-settlement-form";

export function ReturnFinancePanel({
  detail,
  manager,
  stale = false,
  className,
}: {
  detail: ReturnRequestDetailDto;
  manager: boolean;
  stale?: boolean;
  className?: string;
}) {
  const settlement = detail.settlements[0];
  const summary = detail.refundSummary;
  const refundable = summary && (readWholeVnd(summary.remainingRefund) ?? 0n) > 0n;
  return (
    <section className={className ?? f3Panel}>
      {manager ? (
        <OperationalSectionHeader title={F3.settlement} icon={BadgeDollarSign} />
      ) : (
        <h2 className="font-bold text-lg">{F3.settlement}</h2>
      )}
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
          {manager && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-medium text-emerald-800">{F3.entitlement}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">
                  {money(entry.refundEntitlement)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-600">{F3.debt}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {money(entry.debtAmount)}
                </p>
              </div>
            </div>
          )}
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
      {manager ? (
        <OperationalSectionHeader
          title={F3.refundHistory}
          icon={ReceiptText}
          count={detail.refunds.length}
        />
      ) : (
        <h3 className="font-semibold">{F3.refundHistory}</h3>
      )}
      {detail.refunds.length === 0 ? (
        <p className="text-sm text-muted">Chưa có lần hoàn tiền nào.</p>
      ) : (
        <ul className="space-y-2">
          {detail.refunds.map((refund) => (
            <li
              key={refund.id}
              className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm break-words"
            >
              <strong>{money(refund.amount)}</strong> · {refund.reference}
              <p>
                {F3.deposit}:{" "}
                {refund.depositRefundAmount === null
                  ? F3.unknown
                  : money(refund.depositRefundAmount)}{" "}
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
      )}
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
