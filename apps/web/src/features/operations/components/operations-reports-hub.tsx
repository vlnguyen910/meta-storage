"use client";

import axios from "axios";
import { ArrowRight, CheckCircle2, Download, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOperationsReconciliation } from "../hooks/use-operations-reconciliation";
import { useOperationsRefunds } from "../hooks/use-operations-refunds";
import { useOperationsRentals } from "../hooks/use-operations-rentals";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import type { OperationsManualRefundDraft } from "../operations.schema";
import { downloadCsv, formatDateTimeVn, formatDateVn, formatMoney } from "../operations.utils";
import { OperationsDialog, OperationsTable } from "../operations-parts";

export function OperationsReportsHub() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "rentals";
  const [activeTab, setActiveTab] = useState<"rentals" | "reconciliation" | "refunds">(
    initialTab === "reconciliation" || initialTab === "refunds" ? initialTab : "rentals",
  );

  return (
    <div className="grid min-w-0 gap-6">
      {/* Quick Jump Navigation Cards */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href={routes.revenue}
          className="flex items-center justify-between rounded-card border border-outline-variant bg-surface-container-lowest p-5 transition-shadow hover:shadow-md"
        >
          <div>
            <h3 className="text-base font-bold text-primary">{M.titles.revenue}</h3>
            <p className="m-0 text-xs text-slate-600 mt-1">{M.reportCards.revenue}</p>
          </div>
          <ArrowRight size={20} className="text-primary shrink-0 ml-3" />
        </Link>
        <Link
          href={routes.utilization}
          className="flex items-center justify-between rounded-card border border-outline-variant bg-surface-container-lowest p-5 transition-shadow hover:shadow-md"
        >
          <div>
            <h3 className="text-base font-bold text-primary">{M.titles.utilization}</h3>
            <p className="m-0 text-xs text-slate-600 mt-1">{M.reportCards.utilization}</p>
          </div>
          <ArrowRight size={20} className="text-primary shrink-0 ml-3" />
        </Link>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "rentals"}
          onClick={() => setActiveTab("rentals")}
          className={cn(
            "border-b-2 px-5 py-3 text-sm font-bold transition-colors",
            activeTab === "rentals"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-ink",
          )}
        >
          {M.tabRentalsTitle}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reconciliation"}
          onClick={() => setActiveTab("reconciliation")}
          className={cn(
            "border-b-2 px-5 py-3 text-sm font-bold transition-colors",
            activeTab === "reconciliation"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-ink",
          )}
        >
          {M.tabReconciliationTitle}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "refunds"}
          onClick={() => setActiveTab("refunds")}
          className={cn(
            "border-b-2 px-5 py-3 text-sm font-bold transition-colors",
            activeTab === "refunds"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-ink",
          )}
        >
          {M.tabRefundQueueTitle}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "rentals" && <RentalsTab />}
      {activeTab === "reconciliation" && <ReconciliationTab />}
      {activeTab === "refunds" && <RefundsQueueTab />}
    </div>
  );
}

function RentalsTab() {
  const [facilityId, setFacilityId] = useState("all");
  const [status, setStatus] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const query = useOperationsRentals({
    facilityId,
    status,
    limit: 50,
    offset: 0,
  });

  const { data, isPending, isError, refetch } = query;

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !data) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  async function handleExport() {
    try {
      setExporting(true);
      setExportError(null);
      const res = await api.reports.exportReport({
        type: "rentals",
        facilityId: facilityId === "all" ? undefined : facilityId,
        status: status === "all" ? undefined : status,
      });
      downloadCsv(res.data, res.filename);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        setExportError(M.exportErrorLimit);
      } else {
        setExportError(M.exportErrorGeneral);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Filters */}
      <section className="grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] sm:grid-cols-2 lg:grid-cols-4">
        <FieldShell label="Trạng thái hợp đồng">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            {data.byStatus.map((s) => (
              <option key={s.status} value={s.status}>
                {M.rentalStatuses[s.status] ?? s.status} ({s.count})
              </option>
            ))}
          </Select>
        </FieldShell>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            icon={<RotateCcw size={16} aria-hidden="true" />}
            onClick={() => {
              setFacilityId("all");
              setStatus("all");
            }}
          >
            {M.reset}
          </Button>
          <Button
            type="button"
            loading={exporting}
            icon={<Download size={16} aria-hidden="true" />}
            onClick={handleExport}
          >
            {M.export}
          </Button>
        </div>
      </section>

      {exportError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 border border-rose-200"
        >
          {exportError}
        </p>
      )}

      {/* Rentals Table */}
      {data.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 rounded-card border border-outline-variant bg-surface-container-lowest">
          {M.empty}
        </p>
      ) : (
        <OperationsTable label={M.rentalSummary} headings={M.rentalHeadings}>
          {data.items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/50">
              <th
                scope="row"
                className="px-5 py-4 font-mono text-xs font-semibold text-primary whitespace-nowrap"
              >
                {item.bookingCode ?? item.id.slice(0, 8)}
              </th>
              <td className="px-5 py-4 text-xs text-slate-700 font-medium whitespace-nowrap">
                {item.facilityName}
              </td>
              <td className="px-5 py-4 text-xs text-slate-700 whitespace-nowrap">
                {item.unitTypeName}
              </td>
              <td className="px-5 py-4 text-xs font-mono font-bold text-ink whitespace-nowrap">
                {item.unitCode}
              </td>
              <td className="px-5 py-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                {formatDateVn(item.startAt)}
              </td>
              <td className="px-5 py-4 text-xs text-slate-600 tabular-nums whitespace-nowrap font-medium">
                {formatDateVn(item.expectedEndAt)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    item.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : item.status === "OVERDUE"
                        ? "bg-rose-50 text-rose-800 border border-rose-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200",
                  )}
                >
                  {M.rentalStatuses[item.status] ?? item.status}
                </span>
              </td>
            </tr>
          ))}
        </OperationsTable>
      )}
    </div>
  );
}

function ReconciliationTab() {
  const query = useOperationsReconciliation({
    limit: 50,
    offset: 0,
  });

  const { data, isPending, isError, refetch } = query;

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !data) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <h3 className="text-base font-bold text-ink mb-1">{M.tabReconciliationTitle}</h3>
        <p className="m-0 text-xs text-slate-600">{M.reconciliationSummary}</p>
        <span className="mt-2 inline-block text-xs text-slate-400 font-medium">
          {M.asOfDisplay(formatDateTimeVn(data.asOf))}
        </span>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-8 text-center">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
          <h4 className="font-bold text-emerald-900">Không có giao dịch cần đối chiếu</h4>
          <p className="text-xs text-emerald-700 mt-1">
            Toàn bộ các khoản thu đã được ánh xạ khớp snapshot và currency VND chuẩn.
          </p>
        </div>
      ) : (
        <OperationsTable label={M.tabReconciliationTitle} headings={M.reconciliationHeadingsReal}>
          {data.items.map((item) => {
            const issues = [];
            if (item.missingSnapshot) issues.push(M.issueMissingSnapshot);
            if (item.unclassifiedDeposit) issues.push(M.issueUnclassifiedDeposit);
            if (item.unsupportedCurrency) issues.push(M.issueUnsupportedCurrency);

            return (
              <tr key={item.paymentId} className="hover:bg-slate-50/50">
                <th
                  scope="row"
                  className="px-5 py-4 font-mono text-xs text-primary whitespace-nowrap"
                >
                  {item.paymentId.slice(0, 8)}...
                </th>
                <td className="px-5 py-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {item.bookingId ? `${item.bookingId.slice(0, 8)}...` : "—"}
                </td>
                <td className="px-5 py-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {item.facilityId ? `${item.facilityId.slice(0, 8)}...` : "Chưa xác định"}
                </td>
                <td className="px-5 py-4 font-bold tabular-nums text-ink whitespace-nowrap">
                  {formatMoney(item.totalAmount)}
                </td>
                <td className="px-5 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                  {item.currency}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {item.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                  {formatDateTimeVn(item.paidAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {issues.map((issue) => (
                      <span
                        key={issue}
                        className="rounded-xs bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200"
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </OperationsTable>
      )}
    </div>
  );
}

function RefundsQueueTab() {
  const { query, confirmMutation } = useOperationsRefunds();
  const { data: refunds, isPending, isError, refetch } = query;

  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const form = useForm<OperationsManualRefundDraft>();

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !refunds) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  async function handleConfirmRefund(values: OperationsManualRefundDraft) {
    if (!confirmingPaymentId) return;
    try {
      await confirmMutation.mutateAsync({
        paymentId: confirmingPaymentId,
        reference: values.reference,
      });
      setFeedback(M.confirmRefundSuccess);
      setConfirmingPaymentId(null);
      form.reset();
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div>
          <h3 className="text-base font-bold text-ink">{M.tabRefundQueueTitle}</h3>
          <p className="m-0 text-xs text-slate-600 mt-1">
            Hàng chờ các khoản hoàn tiền trạng thái REFUND_PENDING cần xác nhận thủ công.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          icon={<RefreshCw size={14} aria-hidden="true" />}
          onClick={() => void refetch()}
        >
          Làm mới
        </Button>
      </div>

      {feedback && (
        <p
          role="status"
          className="m-0 rounded-xl bg-primary-soft p-4 text-sm font-semibold text-primary"
        >
          {feedback}
        </p>
      )}

      {refunds.length === 0 ? (
        <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-8 text-center">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
          <h4 className="font-bold text-emerald-900">Không có khoản hoàn nào đang chờ</h4>
          <p className="text-xs text-emerald-700 mt-1">
            Mọi yêu cầu hoàn tiền đã được xử lý hoặc không có nghĩa vụ tồn đọng.
          </p>
        </div>
      ) : (
        <OperationsTable label={M.tabRefundQueueTitle} headings={M.refundQueueHeadingsReal}>
          {refunds.map((refund) => (
            <tr key={refund.paymentId} className="hover:bg-slate-50/50">
              <th
                scope="row"
                className="px-5 py-4 font-mono text-xs text-primary whitespace-nowrap"
              >
                {refund.paymentId.slice(0, 8)}...
              </th>
              <td className="px-5 py-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                {refund.bookingId ? `${refund.bookingId.slice(0, 8)}...` : "—"}
              </td>
              <td className="px-5 py-4 font-bold tabular-nums text-rose-600 whitespace-nowrap">
                {formatMoney(refund.amount)}
              </td>
              <td className="px-5 py-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                {formatDateTimeVn(refund.paidAt)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap">
                <Button
                  type="button"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setFeedback(null);
                    setConfirmingPaymentId(refund.paymentId);
                  }}
                >
                  Xác nhận hoàn
                </Button>
              </td>
            </tr>
          ))}
        </OperationsTable>
      )}

      {/* Manual Refund Confirmation Dialog */}
      {confirmingPaymentId && (
        <OperationsDialog
          title={M.confirmRefundDialogTitle}
          onClose={() => setConfirmingPaymentId(null)}
        >
          <form noValidate className="grid gap-4" onSubmit={form.handleSubmit(handleConfirmRefund)}>
            <p className="text-xs text-slate-600">{M.confirmRefundPrompt}</p>

            <FieldShell label={M.refundReference} error={form.formState.errors.reference?.message}>
              <Input
                placeholder={M.referencePlaceholder}
                {...form.register("reference", {
                  required: M.required,
                  maxLength: { value: 128, message: "Tối đa 128 ký tự" },
                })}
                autoFocus
              />
            </FieldShell>
            <p className="text-xs text-slate-400 -mt-2">{M.refundReferenceHelp}</p>

            <div className="mt-2 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmingPaymentId(null)}>
                {M.cancel}
              </Button>
              <Button type="submit" loading={confirmMutation.isPending}>
                {M.confirmRefundAction}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
    </div>
  );
}
