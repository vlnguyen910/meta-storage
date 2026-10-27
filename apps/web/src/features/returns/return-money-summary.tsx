import type { ReturnRefundSummaryDto, ReturnSettlementPreviewDto } from "@metastorage/contracts";
import { F3 } from "./integration.messages";
import { money } from "./integration-utils";

export function MoneyRows({ rows }: { rows: Array<readonly [string, string | null]> }) {
  return (
    <dl className="space-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2">
          <dt>{label}</dt>
          <dd className="font-semibold">{value === null ? F3.unknown : money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function RefundBalances({ summary }: { summary: ReturnRefundSummaryDto }) {
  return (
    <MoneyRows
      rows={[
        [F3.entitlement, summary.refundEntitlement],
        [F3.remaining, summary.remainingRefund],
        [F3.depositRemaining, summary.remainingDepositRefund],
        [F3.rentRemaining, summary.remainingRentRefund],
        [F3.depositConfirmed, summary.confirmedDepositRefund],
        [F3.rentConfirmed, summary.confirmedRentRefund],
      ]}
    />
  );
}
export function SettlementPreview({ preview }: { preview: ReturnSettlementPreviewDto }) {
  const values = preview.calculation;
  return (
    <div className="space-y-4 rounded border border-[#BFCAC4] bg-slate-50 p-4">
      <h3 className="font-bold">{F3.preview}</h3>
      {preview.blockingReasons.length > 0 && (
        <div
          role="status"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950"
        >
          <strong>{F3.cannotClose}</strong>
          <ul className="mt-2 list-disc pl-5">
            {Array.from(
              new Map(preview.blockingReasons.map((reason) => [reason.code, reason])).values(),
            ).map((reason) => (
              <li key={reason.code}>{reason.message}</li>
            ))}
          </ul>
        </div>
      )}
      {!values ? (
        <p>{F3.unknown}</p>
      ) : (
        <>
          <MoneyRows
            rows={[
              [F3.deposit, values.depositSnapshot],
              [F3.overdue, values.overdueFeeAmount],
              [F3.damage, values.damageAmount],
              [F3.rentRefund, values.unusedRentRefundAmount],
              [F3.debt, values.debtAmount],
            ]}
          />
          <p className="text-sm">
            {F3.overdueRate}: {values.rateSnapshot}%
          </p>
          <RefundBalances summary={values} />
        </>
      )}
      <p className="text-sm text-slate-700">{F3.previewNotice}</p>
    </div>
  );
}
