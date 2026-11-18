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
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OperationalBadge } from "@/components/ui/operational";
import { useToast } from "@/components/ui/toast";
import { customerRoutes } from "@/config/routes";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RENTAL_MESSAGES as M } from "./rentals.messages";

export interface PaymentDetailDialogProps {
  payment: RentalPaymentItem | null;
  isOpen: boolean;
  onClose: () => void;
  rentalId?: string;
  bookingCode?: string;
  unitTypeName?: string;
  facilityName?: string;
}

export function PaymentDetailDialog({
  payment,
  isOpen,
  onClose,
  rentalId,
  bookingCode,
  unitTypeName,
  facilityName,
}: PaymentDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!payment) return null;

  const isRefund = payment.type === "DEPOSIT_REFUND";
  const displayCode = payment.paymentCode
    ? formatReference(payment.paymentCode, "TT")
    : formatReference(payment.id, "TT");

  const typeLabel = isRefund ? M.depositRefund : M.paymentCharge;

  const providerLabel = payment.provider
    ? payment.provider.toUpperCase() === "PAYOS"
      ? "Cổng thanh toán PayOS (QR VietQR)"
      : payment.provider.toUpperCase() === "VNPAY"
        ? "Cổng thanh toán VNPAY"
        : payment.provider
    : "Chuyển khoản QR ngân hàng";

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      showToast("Đã sao chép mã giao dịch", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

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
                ? `Thanh toán thành công lúc ${formatDateTime(payment.paidAt)}`
                : `Tạo lúc ${formatDateTime(payment.createdAt)}`}
            </p>
          </div>

          {/* Details Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailCode}</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                <span>{displayCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Sao chép mã"
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
              <span className="text-slate-500 font-medium">{M.paymentDetailStatus}</span>
              <OperationalBadge
                value={payment.status}
                label={M.paymentStatuses[payment.status] ?? payment.status}
              />
            </div>

            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailPaidAt}</span>
              <span className="font-medium text-slate-700">
                {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailCreatedAt}</span>
              <span className="font-medium text-slate-700">
                {formatDateTime(payment.createdAt)}
              </span>
            </div>

            {bookingCode && (
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-500 font-medium">Mã đơn đặt kho</span>
                <span className="font-mono font-semibold text-slate-800">{bookingCode}</span>
              </div>
            )}

            {facilityName && (
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-500 font-medium">Cơ sở lưu kho</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[220px]">
                  {facilityName}
                </span>
              </div>
            )}

            {unitTypeName && (
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-500 font-medium">Loại kho</span>
                <span className="font-semibold text-slate-800 text-right">{unitTypeName}</span>
              </div>
            )}

            <div className="flex items-center justify-between p-3">
              <span className="text-slate-500 font-medium">{M.paymentDetailSystemId}</span>
              <span
                className="font-mono text-[11px] text-slate-400 truncate max-w-[200px]"
                title={payment.id}
              >
                {payment.id}
              </span>
            </div>
          </div>

          {/* Refund block if applicable */}
          {payment.refundAmount && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-900">
                <span>{M.paymentDetailRefundAmount}</span>
                <span>+{formatCurrency(Number(payment.refundAmount))}</span>
              </div>
              {payment.refundedAt && (
                <div className="flex items-center justify-between text-amber-800/80 text-[11px]">
                  <span>{M.paymentDetailRefundedAt}</span>
                  <span>{formatDateTime(payment.refundedAt)}</span>
                </div>
              )}
              {payment.refundReason && (
                <div className="flex items-center justify-between text-amber-800/80 text-[11px]">
                  <span>{M.paymentDetailRefundReason}</span>
                  <span className="italic">{payment.refundReason}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`${customerRoutes.supportNew}?paymentId=${payment.id}${rentalId ? `&rentalId=${rentalId}` : ""}`}
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
