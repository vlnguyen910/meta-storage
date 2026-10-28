"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type QuoteRenewal,
  QuoteRenewalSchema,
  type RentalChargeDispute,
  RentalChargeDisputeSchema,
} from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import {
  AlertCircle,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  History,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, StatusBadge } from "@/components/ui/display";
import { customerApiError } from "@/features/bookings/customer-error";
import { money } from "@/features/returns/integration-utils";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { useRentalFinance } from "./use-rental-finance";

export function CheckoutPostForm({
  checkoutUrl,
  fields,
}: {
  checkoutUrl: string;
  fields: Record<string, string | number>;
}) {
  return (
    <form action={checkoutUrl} method="POST">
      {Object.entries(fields).map(([name, value]) => (
        <input type="hidden" name={name} value={value} key={name} />
      ))}
      <Button className="min-h-11 rounded-xl bg-primary px-6 font-bold text-white shadow-xs transition hover:bg-primary-dark">
        {M.openCheckout}
      </Button>
    </form>
  );
}

export function RentalFinancePanel({
  rentalId,
  rentalStatus,
  rentalExpectedEndAt,
  hasActiveReturn = false,
  onActiveRenewalChange,
}: {
  rentalId: string;
  rentalStatus?: string;
  rentalExpectedEndAt?: string;
  hasActiveReturn?: boolean;
  onActiveRenewalChange?: (active: boolean) => void;
}) {
  const state = useRentalFinance(rentalId);
  const [showHistory, setShowHistory] = useState(false);

  const form = useForm<QuoteRenewal>({
    resolver: zodResolver(QuoteRenewalSchema),
    defaultValues: { months: 1, idempotencyKey: crypto.randomUUID() },
  });

  const renewal = state.renewal.data;
  const watchedMonths = form.watch("months");

  const isQuotedOrAwaiting = Boolean(
    (renewal && (renewal.status === "QUOTED" || renewal.status === "AWAITING_PAYMENT")) ||
      state.history.data?.pages
        .flat()
        .some(
          (item) =>
            (item.status === "QUOTED" || item.status === "AWAITING_PAYMENT") &&
            new Date(item.expiresAt).getTime() > Date.now(),
        ),
  );

  // Notify parent of active renewal state for mutual exclusivity
  useEffect(() => {
    onActiveRenewalChange?.(isQuotedOrAwaiting);
  }, [isQuotedOrAwaiting, onActiveRenewalChange]);

  // If there's an unexpired active renewal in history but renewalId is not in URL, select it
  useEffect(() => {
    if (!state.renewalId && state.history.data) {
      const activeItem = state.history.data.pages
        .flat()
        .find(
          (item) =>
            (item.status === "QUOTED" || item.status === "AWAITING_PAYMENT") &&
            new Date(item.expiresAt).getTime() > Date.now(),
        );
      if (activeItem) {
        state.selectRenewal(activeItem.id);
      }
    }
  }, [state.renewalId, state.history.data, state.selectRenewal]);

  const pending =
    state.quote.isPending ||
    state.accept.isPending ||
    state.pay.isPending ||
    state.dispute.isPending;

  const historyItems = state.history.data?.pages.flat() ?? [];
  const chargeItems = state.charges.data?.pages.flatMap((page) => page.items) ?? [];
  const openCharges = chargeItems.filter((c) => c.status === "OPEN");

  // Determine whether renewal can be shown
  const canShowRenewal =
    !hasActiveReturn && (!rentalStatus || rentalStatus === "ACTIVE" || isQuotedOrAwaiting);

  // If renewal cannot be shown and there are no charges, don't render anything
  if (!canShowRenewal && chargeItems.length === 0) {
    return null;
  }

  const predictedNewEndAt = rentalExpectedEndAt
    ? (() => {
        const d = new Date(rentalExpectedEndAt);
        d.setMonth(d.getMonth() + (Number(watchedMonths) || 1));
        return d;
      })()
    : null;

  return (
    <div className="mt-6 grid gap-6">
      {/* Renewal Section */}
      {canShowRenewal && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 shadow-2xs">
                <CalendarPlus size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-ink">Gia hạn thuê kho</h2>
                  {renewal && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        renewal.status === "QUOTED" &&
                          "border border-blue-200 bg-blue-50 text-blue-700",
                        renewal.status === "AWAITING_PAYMENT" &&
                          "border border-amber-200 bg-amber-50 text-amber-700",
                        renewal.status === "APPLIED" &&
                          "border border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {renewal.status === "QUOTED" && (
                        <>
                          <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
                          Đã có báo giá
                        </>
                      )}
                      {renewal.status === "AWAITING_PAYMENT" && (
                        <>
                          <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                          Chờ thanh toán
                        </>
                      )}
                      {renewal.status === "APPLIED" && (
                        <>
                          <CheckCircle2 size={13} />
                          Đã gia hạn thành công
                        </>
                      )}
                    </span>
                  )}
                </div>
                <p className="mb-0 mt-1 text-xs text-muted">
                  Kéo dài thời hạn lưu trữ kho dễ dàng, không gián đoạn dịch vụ
                </p>
              </div>
            </div>

            {renewal && (
              <button
                type="button"
                onClick={state.clearRenewal}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-ink"
              >
                <RotateCcw size={13} />
                <span>Tạo báo giá mới</span>
              </button>
            )}
          </div>

          {/* Active Quoted or Awaiting Payment View */}
          {renewal && (renewal.status === "QUOTED" || renewal.status === "AWAITING_PAYMENT") ? (
            <div className="pt-5 grid gap-5">
              <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-5 shadow-xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100/80 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Báo giá gia hạn (+{renewal.months} tháng)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={13} className="text-slate-400" />
                    Báo giá có hiệu lực đến:{" "}
                    <strong>
                      {new Date(renewal.expiresAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {new Date(renewal.expiresAt).toLocaleDateString("vi-VN")}
                    </strong>
                  </span>
                </div>

                {/* Date Comparison Grid */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                    <span className="block text-xs font-semibold uppercase text-slate-500">
                      Thời hạn hiện tại
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-800">
                      {new Date(renewal.oldEndAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>

                  <div className="hidden sm:grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <ArrowRight size={16} />
                  </div>

                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-3.5 shadow-2xs">
                    <span className="block text-xs font-bold uppercase text-emerald-700">
                      Thời hạn mới sau gia hạn
                    </span>
                    <span className="mt-1 block text-sm font-black text-emerald-800">
                      {new Date(renewal.newEndAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>

                {/* Price & Summary */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200/60 bg-white p-4 shadow-2xs">
                  <div>
                    <span className="block text-xs text-muted">Đơn giá thuê hàng tháng</span>
                    <span className="text-sm font-bold text-slate-700">
                      {money(renewal.monthlyRate)}/tháng
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-semibold uppercase text-emerald-800">
                      Tổng tiền gia hạn ({renewal.months} tháng)
                    </span>
                    <span className="text-2xl font-black text-emerald-600">
                      {money(renewal.amount)}
                    </span>
                  </div>
                </div>

                {/* Terms Box */}
                {renewal.terms && (
                  <div className="mb-4 rounded-xl border border-slate-200/80 bg-white/90 p-3.5 text-xs text-slate-600">
                    <strong className="block text-slate-800 mb-1">Điều khoản gia hạn:</strong>
                    <div className="max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-500">
                      {renewal.terms}
                    </div>
                  </div>
                )}

                {/* Failure Reason */}
                {renewal.failureReason && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
                    role="alert"
                  >
                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                    <span>{renewal.failureReason}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  {renewal.status === "QUOTED" && (
                    <Button
                      disabled={pending}
                      onClick={() => state.accept.mutate()}
                      className="min-h-11 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-xs transition hover:bg-primary-dark"
                    >
                      <Check size={16} />
                      <span>{M.accept}</span>
                    </Button>
                  )}

                  {renewal.status === "AWAITING_PAYMENT" && renewal.chargeId && (
                    <Button
                      disabled={pending}
                      onClick={() => {
                        if (renewal.chargeId) state.pay.mutate(renewal.chargeId);
                      }}
                      className="min-h-11 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700"
                    >
                      <CreditCard size={16} />
                      <span>Thanh toán ngay ({money(renewal.amount)})</span>
                    </Button>
                  )}

                  <button
                    type="button"
                    disabled={pending}
                    onClick={state.clearRenewal}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-ink"
                  >
                    <X size={14} />
                    <span>Hủy & Chọn lại thời gian</span>
                  </button>
                </div>
              </div>

              {/* Checkout Form */}
              {state.payment.data && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900">
                    <CreditCard size={18} />
                    <span>
                      {M.paymentStatus}: {state.payment.data.status}
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-blue-800">
                    {state.payment.data.status === "PENDING"
                      ? M.paymentPending
                      : `Trạng thái thanh toán: ${state.payment.data.status}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {state.payment.data.status === "PENDING" &&
                      state.payment.data.checkoutUrl &&
                      state.payment.data.checkoutFormFields && (
                        <CheckoutPostForm
                          checkoutUrl={state.payment.data.checkoutUrl}
                          fields={state.payment.data.checkoutFormFields}
                        />
                      )}
                    <Button
                      variant="outline"
                      disabled={state.payment.isFetching}
                      onClick={() => state.payment.refetch()}
                      className="rounded-xl border-blue-300 bg-white text-blue-800 hover:bg-blue-50"
                    >
                      {M.checkPayment}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : renewal?.status === "APPLIED" ? (
            /* Applied Success View */
            <div className="pt-5">
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <strong className="block text-sm font-bold">Gia hạn thành công!</strong>
                    <p className="mb-0 mt-1 text-xs leading-relaxed text-emerald-800">
                      Kho của bạn đã được gia hạn thành công đến ngày{" "}
                      <strong>{new Date(renewal.newEndAt).toLocaleDateString("vi-VN")}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={state.clearRenewal}
                  className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            /* Duration Picker Form */
            <div className="pt-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">
                Chọn khoảng thời gian muốn gia hạn:
              </p>

              {/* Quick Preset Month Pills */}
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                {[1, 3, 6, 12].map((m) => {
                  const isSelected = Number(watchedMonths) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => form.setValue("months", m)}
                      className={cn(
                        "min-h-10 rounded-xl px-4 text-sm font-bold transition-all",
                        isSelected
                          ? "bg-primary text-white shadow-xs ring-2 ring-primary/20 scale-102"
                          : "border border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100 hover:border-slate-300",
                      )}
                    >
                      {m} tháng
                    </button>
                  );
                })}

                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-xs text-muted">hoặc:</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="h-10 w-16 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    {...form.register("months", { valueAsNumber: true })}
                  />
                  <span className="text-xs font-medium text-slate-500">tháng</span>
                </div>
              </div>

              {/* Preview Notice */}
              {rentalExpectedEndAt && predictedNewEndAt && (
                <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/70 p-3.5 text-xs text-slate-600">
                  <Clock size={14} className="shrink-0 text-slate-400" />
                  <span>
                    Hiện tại đến <strong>{formatDate(rentalExpectedEndAt)}</strong>. Khi gia hạn
                    thêm <strong>{watchedMonths || 1} tháng</strong>, thời hạn mới dự kiến đến{" "}
                    <strong className="text-emerald-700">
                      {formatDate(predictedNewEndAt.toISOString())}
                    </strong>
                    .
                  </span>
                </div>
              )}

              {form.formState.errors.months && (
                <p role="alert" className="mb-3 text-xs font-semibold text-rose-600">
                  {form.formState.errors.months.message}
                </p>
              )}

              <Button
                type="button"
                disabled={pending || state.renewal.isFetching}
                onClick={form.handleSubmit((v) => state.quote.mutate(v.months))}
                className="min-h-11 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-xs transition hover:bg-primary-dark"
              >
                <Sparkles size={16} />
                <span>Lấy báo giá gia hạn ({watchedMonths || 1} tháng)</span>
              </Button>
            </div>
          )}

          {/* History Collapsible */}
          {historyItems.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-ink transition-colors"
              >
                <History size={14} className="text-slate-400" />
                <span>Lịch sử các lần gia hạn ({historyItems.length})</span>
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", showHistory && "rotate-180")}
                />
              </button>

              {showHistory && (
                <div className="mt-3 grid gap-2">
                  {historyItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => state.selectRenewal(item.id)}
                      className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-left text-xs transition hover:bg-slate-100/70"
                    >
                      <div className="flex items-center gap-2.5">
                        <StatusBadge value={item.status} />
                        <span className="font-semibold text-slate-700">+{item.months} tháng</span>
                        <span className="text-muted">
                          (Đến: {new Date(item.newEndAt).toLocaleDateString("vi-VN")})
                        </span>
                      </div>
                      <span className="font-bold text-emerald-700">{money(item.amount)}</span>
                    </button>
                  ))}

                  {state.history.hasNextPage && (
                    <Button
                      variant="outline"
                      disabled={state.history.isFetchingNextPage}
                      onClick={() => state.history.fetchNextPage()}
                      className="mt-1 min-h-9 rounded-xl px-3 text-xs"
                    >
                      {M.more}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {Object.entries({
            quote: state.quote,
            accept: state.accept,
            pay: state.pay,
            dispute: state.dispute,
            renewal: state.renewal,
            payment: state.payment,
          }).map(
            ([key, op]) =>
              op.isError && (
                <div
                  role="alert"
                  key={key}
                  className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
                >
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{customerApiError(op.error)}</span>
                </div>
              ),
          )}
        </Card>
      )}

      {/* Charges Section (only if charges exist) */}
      {chargeItems.length > 0 && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <CreditCard size={18} />
              </div>
              <h3 className="text-lg font-bold text-ink">{M.charges}</h3>
            </div>
            {openCharges.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {openCharges.length} khoản cần thanh toán
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            {chargeItems.map((c) => (
              <div
                className="grid gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-xs"
                key={c.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      {M.source[c.source] ?? c.source}
                    </span>
                    <StatusBadge value={c.status} />
                  </div>
                  <div className="text-right">
                    <span className="text-muted">{M.total}: </span>
                    <strong className="text-slate-800">{money(c.adjustedAmount)}</strong>
                    {c.status === "OPEN" && (
                      <span className="ml-2 font-bold text-rose-700">
                        (Còn lại: {money(c.outstandingAmount)})
                      </span>
                    )}
                  </div>
                </div>

                {c.evidence && <p className="mb-0 text-slate-600">{c.evidence}</p>}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-slate-500">
                    {M.dueDate}: {c.dueDate ?? M.noDueDate}
                  </span>
                  {c.status === "OPEN" && (
                    <Button
                      disabled={pending}
                      onClick={() => state.pay.mutate(c.id)}
                      className="min-h-9 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <CreditCard size={13} />
                      <span>{M.payment}</span>
                    </Button>
                  )}
                </div>

                {c.source === "EXTRA" && c.status === "OPEN" && (
                  <div className="mt-2 border-t border-slate-200/60 pt-2">
                    <ChargeDisputeForm
                      pending={pending}
                      onSubmit={(reason) => state.dispute.mutate({ chargeId: c.id, reason })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {state.charges.hasNextPage && (
            <Button
              variant="outline"
              disabled={state.charges.isFetchingNextPage}
              onClick={() => void state.charges.fetchNextPage()}
              className="mt-3 min-h-9 rounded-xl px-3 text-xs"
            >
              {M.more}
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

function ChargeDisputeForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (reason: string) => void;
}) {
  const form = useForm<RentalChargeDispute>({
    resolver: zodResolver(RentalChargeDisputeSchema),
    defaultValues: { reason: "" },
  });

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={form.handleSubmit((input) => onSubmit(input.reason))}
    >
      <div className="grow">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          <span>
            {M.dispute} ({M.reason}):
          </span>
          <textarea
            className="mt-1 block min-h-16 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Nhập lý do khiếu nại khoản phí này..."
            {...form.register("reason")}
            maxLength={4000}
          />
        </label>
      </div>
      {form.formState.errors.reason && (
        <p role="alert" className="w-full text-xs text-rose-600">
          {form.formState.errors.reason.message}
        </p>
      )}
      <Button variant="outline" disabled={pending} className="min-h-9 rounded-xl px-3 text-xs">
        {M.dispute}
      </Button>
    </form>
  );
}
