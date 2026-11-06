import type { StorageOverlaysProps } from "../../../common/my-storage.types";
import { storageMoney } from "../../../common/my-storage.utils";
import { Card, DetailSheet, Notice, Row } from "../../../components/ui";
import { dateTime } from "../../../components/ui/mobile-ui";
import { QueryFeedback } from "../../customer-home/components/query-feedback";
import { MY_STORAGE as M } from "../my-storage.messages";
export function StorageOverlays({ state: s }: StorageOverlaysProps) {
  const rental = s.detail.data,
    transaction = s.selection?.kind === "payment" ? s.selection.transaction : undefined;
  const p = transaction?.payment;
  return (
    <DetailSheet
      visible={s.selection !== null}
      title={p ? M.receipt : M.rentalDetails}
      closeLabel={M.close}
      onClose={() => s.setSelection(null)}
    >
      {s.selection?.kind === "rental" ? (
        <>
          <QueryFeedback
            pending={s.detail.isPending}
            error={s.detail.isError}
            retry={() => void s.detail.refetch()}
          />
          {rental ? (
            <>
              <Card title={rental.storageUnit?.code ?? M.unassigned} compact outlined>
                <Row label={M.rentalCode} value={rental.id} />
                <Row label={M.bookingCode} value={rental.bookingCode} />
                <Row
                  label={M.paymentStatus}
                  value={rental.status === "ACTIVE" ? M.active : M.closed}
                />
                <Row
                  label={M.facility}
                  value={`${rental.facility.name}
${rental.facility.address}`}
                />
                <Row
                  label={M.type}
                  value={`${rental.unitType.name} (${rental.unitType.sizeLabel})`}
                />
                <Row label={M.start} value={dateTime(rental.startAt)} />
                <Row label={M.end} value={dateTime(rental.endAt)} />
                {rental.closedAt ? (
                  <Row label={M.closedOn} value={dateTime(rental.closedAt)} />
                ) : null}
                <Row label={M.customer} value={rental.customer.name ?? M.unknown} />
                <Row label={M.email} value={rental.customer.email} />
                <Row label={M.phone} value={rental.customer.phone ?? M.unknown} />
              </Card>
              {rental.settlement ? (
                <Card title={M.settlement} compact outlined>
                  <Row
                    label={M.deposit}
                    value={storageMoney(
                      rental.settlement.depositAmount,
                      rental.settlement.currency,
                    )}
                  />
                  <Row
                    label={M.deduction}
                    value={storageMoney(
                      rental.settlement.deductionAmount,
                      rental.settlement.currency,
                    )}
                  />
                  <Row
                    label={M.refund}
                    value={storageMoney(rental.settlement.refundAmount, rental.settlement.currency)}
                  />
                  <Row
                    label={M.debt}
                    value={storageMoney(rental.settlement.debtAmount, rental.settlement.currency)}
                  />
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {p && transaction ? (
        <>
          <Notice>{M.receiptHint}</Notice>
          <Card title={M.receipt} compact outlined>
            <Row label={M.paymentCode} value={p.paymentCode ?? p.id} />
            <Row label={M.paymentStatus} value={M.paymentStatuses[p.status]} />
            <Row label={M.amount} value={storageMoney(p.totalAmount, p.currency)} />
            <Row label={M.paymentType} value={M.paymentTypes[p.type]} />
            <Row
              label={M.provider}
              value={p.provider === "sepay" ? M.sepay : (p.provider ?? M.unknown)}
            />
            <Row label={M.createdAt} value={dateTime(p.createdAt)} />
            {p.paidAt ? <Row label={M.paymentDate} value={dateTime(p.paidAt)} /> : null}
            {p.refundAmount !== null ? (
              <Row label={M.refundedAmount} value={storageMoney(p.refundAmount, p.currency)} />
            ) : null}
            {p.refundedAt ? <Row label={M.refundedAt} value={dateTime(p.refundedAt)} /> : null}
            {p.refundReason ? (
              <Row label={M.refundReason} value={M.refundReasons[p.refundReason] ?? M.unknown} />
            ) : null}
            <Row label={M.unitCode} value={transaction.rental.storageUnit?.code ?? M.unassigned} />
            <Row label={M.facility} value={transaction.rental.facility.name} />
            <Row label={M.bookingCode} value={transaction.rental.bookingCode} />
          </Card>
        </>
      ) : null}
    </DetailSheet>
  );
}
