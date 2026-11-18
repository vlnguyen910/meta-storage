"use client";

import type { RentalPaymentItem } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  CreditCard,
  HelpCircle,
  ReceiptText,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OperationalBadge } from "@/components/ui/operational";
import { useToast } from "@/components/ui/toast";
import { customerRoutes } from "@/config/routes";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RENTAL_MESSAGES as M } from "./rentals.messages";

export interface PaymentDetailDialogProps {
  payment: RentalPaymentItem | null;
  isOpen: boolean;
  onClose: () => void;
  bookingCode?: string;
  unitTypeName?: string;
  facilityName?: string;
  storageUnitCode?: string | null;
  rentalPeriod?: { startAt: string; endAt: string };
}

export function PaymentDetailDialog({
  payment,
  isOpen,
  onClose,
  bookingCode,
  unitTypeName,
  facilityName,
  storageUnitCode,
  rentalPeriod,
}: PaymentDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!payment) return null;

  const isRefund = payment.type === "DEPOSIT_REFUND";
  const displayCode = payment.paymentCode
    ? formatReference(payment.paymentCode, "TT")
    : formatReference(payment.id, "TT");

  const typeLabel = isRefund
    ? M.depositRefund
    : payment.months
      ? `Thanh toán thuê kho (${payment.months} tháng)`
      : M.paymentCharge;

  const providerLabel = isRefund
    ? payment.method === "CASH"
      ? M.paymentMethodCash
      : payment.method === "BANK_TRANSFER"
        ? M.paymentMethodBankTransfer
        : M.paymentMethodUnknown
    : payment.provider
      ? payment.provider.toUpperCase() === "PAYOS"
        ? M.paymentProviderPayos
        : payment.provider.toUpperCase() === "VNPAY"
          ? M.paymentProviderVnpay
          : payment.provider.toLowerCase() === "sepay"
            ? M.paymentProviderSepay
            : payment.provider
      : payment.method === "CASH"
        ? M.paymentMethodCash
        : payment.method === "BANK_TRANSFER"
          ? M.paymentMethodBankTransfer
          : M.paymentMethodUnknown;

  const supportParams = new URLSearchParams({ paymentId: payment.id });
  if (payment.reservationId) supportParams.set("reservationId", payment.reservationId);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      showToast(M.paymentCodeCopied, "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const hasBreakdown =
    payment.rentalFeeAmount != null ||
    payment.depositAmount != null ||
    payment.vatAmount != null ||
    isRefund;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-slate-200">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary font-bold">
                <ReceiptText size={20} />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {M.paymentDetailTitle}
                </DialogTitle>
                <p className="text-xs text-slate-500">{M.paymentDetailDescription}</p>
              </div>
            </div>
            <OperationalBadge
              value={payment.status}
              label={M.paymentStatuses[payment.status] ?? payment.status}
            />
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Main Amount Card */}
          <div
            className={cn(
              "rounded-xl border p-4.5 text-center flex flex-col items-center justify-center gap-1",
              isRefund
                ? "border-amber-200 bg-gradient-to-b from-amber-50/60 to-white"
                : "border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white",
            )}
          >
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              {isRefund ? (
                <ArrowDownLeft size={14} className="text-amber-600" />
              ) : (
                <ArrowUpRight size={14} className="text-emerald-600" />
              )}
              {typeLabel}
            </span>
            <strong
              className={cn(
                "text-2xl sm:text-3xl font-extrabold tracking-tight",
                isRefund ? "text-amber-700" : "text-emerald-800",
              )}
            >
              {isRefund ? "+" : ""}
              {formatCurrency(Number(payment.totalAmount))}
            </strong>
            <p className="text-[11px] text-slate-400">
              {payment.paidAt
                ? M.paymentPaidAtLabel(formatDateTime(payment.paidAt))
                : M.paymentCreatedAtLabel(formatDateTime(payment.createdAt))}
            </p>
          </div>

          {/* Section 1: Chi tiết các khoản tiền (Breakdown) */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 text-xs">
            <div className="bg-slate-50/80 px-3.5 py-2 font-semibold text-slate-700 flex items-center justify-between">
              <span>{M.paymentDetailBreakdown}</span>
              <span className="text-[11px] font-normal text-slate-400">Đơn vị: VNĐ</span>
            </div>

            {isRefund ? (
              <>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-500 font-medium">Tiền đặt cọc ban đầu</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(Number(payment.depositAmount ?? payment.totalAmount))}
                  </span>
                </div>
                {payment.deductionAmount && Number(payment.deductionAmount) > 0 ? (
                  <div className="flex items-center justify-between p-3 text-rose-700">
                    <span className="font-medium">{M.paymentDeductionFee}</span>
                    <span className="font-semibold">
                      -{formatCurrency(Number(payment.deductionAmount))}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between p-3 bg-amber-50/40">
                  <span className="font-bold text-amber-900">{M.paymentActualRefund}</span>
                  <strong className="text-sm font-bold text-amber-700">
                    +{formatCurrency(Number(payment.refundAmount ?? payment.totalAmount))}
                  </strong>
                </div>
                {payment.refundReason && (
                  <div className="flex items-center justify-between p-3 text-slate-500 text-[11px]">
                    <span className="font-medium">{M.paymentDetailRefundReason}</span>
                    <span className="italic text-slate-700">{payment.refundReason}</span>
                  </div>
                )}
              </>
            ) : hasBreakdown ? (
              <>
                <div className="flex items-start justify-between p-3 gap-2">
                  <div>
                    <span className="text-slate-600 font-medium block">{M.paymentRentalFee}</span>
                    {payment.months && payment.monthlyRate ? (
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {payment.months} tháng × {formatCurrency(Number(payment.monthlyRate))}
                        /tháng
                      </span>
                    ) : null}
                  </div>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(Number(payment.rentalFeeAmount ?? payment.totalAmount))}
                  </span>
                </div>

                {payment.depositAmount && Number(payment.depositAmount) > 0 ? (
                  <div className="flex items-start justify-between p-3 gap-2">
                    <div>
                      <span className="text-slate-600 font-medium block">
                        {M.paymentDepositFee}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {M.paymentDepositFeeHint}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(Number(payment.depositAmount))}
                    </span>
                  </div>
                ) : null}

                {payment.vatAmount && Number(payment.vatAmount) > 0 ? (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-slate-600 font-medium">{M.paymentVatFee}</span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(Number(payment.vatAmount))}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between p-3 bg-emerald-50/40">
                  <span className="font-bold text-emerald-950">{M.paymentTotalAmount}</span>
                  <strong className="text-sm font-bold text-emerald-800">
                    {formatCurrency(Number(payment.totalAmount))}
                  </strong>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-600 font-medium">{M.paymentTotalAmount}</span>
                <strong className="text-sm font-bold text-slate-900">
                  {formatCurrency(Number(payment.totalAmount))}
                </strong>
              </div>
            )}
          </div>

          {/* Section 2: Thông tin dịch vụ thuê kho */}
          {(bookingCode || facilityName || unitTypeName || storageUnitCode || rentalPeriod) && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="bg-slate-50/80 px-3.5 py-2 font-semibold text-slate-700 flex items-center gap-1.5">
                <Warehouse size={13} className="text-slate-500" />
                <span>{M.paymentServiceInfo}</span>
              </div>

              {bookingCode && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-500 font-medium">{M.paymentBookingCode}</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatReference(bookingCode, "BK")}
                  </span>
                </div>
              )}

              {facilityName && (
                <div className="flex items-center justify-between p-3 gap-2">
                  <span className="text-slate-500 font-medium shrink-0">{M.paymentFacility}</span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[240px]">
                    {facilityName}
                  </span>
                </div>
              )}

              {unitTypeName && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-500 font-medium">{M.paymentUnitType}</span>
                  <span className="font-semibold text-slate-800 text-right">{unitTypeName}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3">
                <span className="text-slate-500 font-medium">{M.paymentStorageUnit}</span>
                {storageUnitCode ? (
                  <span className="font-mono font-bold text-emerald-700">{storageUnitCode}</span>
                ) : (
                  <span className="text-slate-400 italic">{M.paymentUnitPending}</span>
                )}
              </div>

              {rentalPeriod && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-500 font-medium">{M.paymentRentalPeriod}</span>
                  <span className="font-medium text-slate-700">
                    {formatDate(rentalPeriod.startAt)} – {formatDate(rentalPeriod.endAt)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Thông tin đối soát giao dịch ngân hàng */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailCode}</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                <span>{displayCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title={M.paymentCopyCode}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailMethod}</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CreditCard size={13} className="text-slate-400" />
                {providerLabel}
              </span>
            </div>

            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailPaidAt}</span>
              <span className="font-medium text-slate-700">
                {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailStatus}</span>
              <OperationalBadge
                value={payment.status}
                label={M.paymentStatuses[payment.status] ?? payment.status}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`${customerRoutes.supportNew}?${supportParams.toString()}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary transition-colors"
          >
            <HelpCircle size={14} />
            <span>{M.paymentDetailSupportAction}</span>
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-8.5 min-h-0 px-4 text-xs font-bold"
          >
            {M.paymentDetailClose}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
