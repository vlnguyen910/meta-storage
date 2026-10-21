"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsReconciliation } from "../hooks/use-operations-reconciliation";
import { useOperationsRefunds } from "../hooks/use-operations-refunds";
import { useOperationsRentals } from "../hooks/use-operations-rentals";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import {
  type OperationsManualRefundDraft,
  OperationsManualRefundDraftSchema,
} from "../operations.schema";
import {
  downloadCsv,
  formatDateTimeVn,
  formatDateVn,
  formatMoneyWithCurrency,
} from "../operations.utils";
import { OperationsDialog, OperationsTable } from "../operations-parts";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";

const PAGE_SIZE = 20;

export function OperationsReportsHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") ?? "rentals";

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${routes.reports}?${params.toString()}`);
  }

  return (
    <div className="grid min-w-0 gap-6">
      {/* Navigation Cards to Dedicated Reports */}
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
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant pb-2">
        <button
          type="button"
          onClick={() => setTab("rentals")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "rentals"
              ? "bg-primary text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {M.tabRentalsTitle}
        </button>
        <button
          type="button"
          onClick={() => setTab("reconciliation")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "reconciliation"
              ? "bg-primary text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {M.tabReconciliationTitle}
        </button>
        <button
          type="button"
          onClick={() => setTab("refunds")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "refunds"
              ? "bg-primary text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {M.tabRefundQueueTitle}
        </button>
      </div>

      {activeTab === "rentals" && <RentalsTab />}
      {activeTab === "reconciliation" && <ReconciliationTab />}
      {activeTab === "refunds" && <RefundsQueueTab />}
    </div>
  );
}

function RentalsTab() {
  const [facilityId, setFacilityId] = useState("all");
  const [unitTypeId, setUnitTypeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { facilities: catalogFacilities, unitTypes: catalogUnitTypes } =
    useOperationsCatalogOptions();
  const offset = (page - 1) * PAGE_SIZE;

  const query = useOperationsRentals({
    facilityId: facilityId === "all" ? undefined : facilityId,
    unitTypeId: unitTypeId === "all" ? undefined : unitTypeId,
    status: status === "all" ? undefined : status,
    limit: PAGE_SIZE,
    offset,
  });

  const { data, isPending, isError, refetch } = query;
  const summary = useOperationsRentals({ facilityId, unitTypeId, limit: 1, offset: 0 });

  async function handleExport() {
    try {
      setExporting(true);
      setExportError(null);
      const res = await api.reports.exportReport({
        type: "rentals",
        facilityId: facilityId === "all" ? undefined : facilityId,
        unitTypeId: unitTypeId === "all" ? undefined : unitTypeId,
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
      <div>
        <h2 className="text-lg font-bold">{R.rentalTitle}</h2>
        <p className="mt-1 text-sm text-slate-600">{R.rentalHelp}</p>
      </div>
      {summary.data && (
        <dl className="flex flex-wrap gap-4 rounded-card border border-outline-variant bg-white p-4 text-sm">
          {summary.data.byStatus.map((item) => (
            <div key={item.status}>
              <dt className="text-xs text-slate-600">
                {R.rentalStatuses[item.status] ?? item.status}
              </dt>
              <dd className="font-bold">{item.count}</dd>
            </div>
          ))}
        </dl>
      )}
      {/* Filters */}
      <section className="grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] sm:grid-cols-2 lg:grid-cols-4">
        <FieldShell label={M.facilityFilter}>
          <Select
            value={facilityId}
            onChange={(e) => {
              setFacilityId(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{M.allFacilities}</option>
            {catalogFacilities.map((fac) => (
              <option key={fac.id} value={fac.id}>
                {fac.name}
              </option>
            ))}
          </Select>
        </FieldShell>
        <FieldShell label={M.unitTypeFilter}>
          <Select
            value={unitTypeId}
            onChange={(event) => {
              setUnitTypeId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{M.allUnitTypes}</option>
            {catalogUnitTypes.map((type) => (
              <option key={type.unitTypeId} value={type.unitTypeId}>
                {type.name}
              </option>
            ))}
          </Select>
        </FieldShell>
        <FieldShell label={R.rentalStatus}>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            {Array.from(
              new Set([
                ...(summary.data?.byStatus.map((item) => item.status) ?? []),
                ...(status === "all" ? [] : [status]),
              ]),
            ).map((value) => (
              <option key={value} value={value}>
                {R.rentalStatuses[value] ?? value}
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
              setUnitTypeId("all");
              setPage(1);
              setExportError(null);
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

      {isPending ? (
        <LoadingState label={M.loading} variant="table" />
      ) : isError || !data ? (
        <ErrorState message={M.error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 rounded-card border border-outline-variant bg-surface-container-lowest">
          {R.rentalEmpty}
        </p>
      ) : (
        <>
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
                    {R.rentalStatuses[item.status] ?? item.status}
                  </span>
                </td>
              </tr>
            ))}
          </OperationsTable>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 text-xs text-slate-600">
            <div>
              Hiển thị {offset + 1} – {Math.min(offset + data.items.length, data.total)} trong tổng
              số <strong>{data.total}</strong> lượt thuê
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Trang trước</span>
              </Button>
              <span className="font-semibold text-ink px-2">
                Trang {page} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={offset + data.items.length >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2.5 text-xs"
              >
                <span>Trang sau</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReconciliationTab() {
  const [facilityId, setFacilityId] = useState("all");
  const [page, setPage] = useState(1);
  const { facilities: catalogFacilities } = useOperationsCatalogOptions();
  const offset = (page - 1) * PAGE_SIZE;

  const query = useOperationsReconciliation({
    facilityId: facilityId === "all" ? undefined : facilityId,
    limit: PAGE_SIZE,
    offset,
  });

  const { data, isPending, isError, refetch } = query;

  return (
    <div className="grid gap-6">
      {/* Header Info & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div>
          <h3 className="text-base font-bold text-ink mb-1">{M.tabReconciliationTitle}</h3>
          <p className="m-0 text-xs text-slate-600">{M.reconciliationSummary}</p>
          {data && (
            <span className="mt-2 inline-block text-xs text-slate-400 font-medium">
              {M.asOfDisplay(formatDateTimeVn(data.asOf))}
            </span>
          )}
        </div>
        <div className="w-56">
          <FieldShell label={M.facilityFilter}>
            <Select
              value={facilityId}
              onChange={(e) => {
                setFacilityId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{M.allFacilities}</option>
              {catalogFacilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name}
                </option>
              ))}
            </Select>
          </FieldShell>
        </div>
      </div>

      {isPending ? (
        <LoadingState label={M.loading} variant="table" />
      ) : isError || !data ? (
        <ErrorState message={M.error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-8 text-center">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
          <h4 className="font-bold text-emerald-900">Không có giao dịch cần đối chiếu</h4>
          <p className="text-xs text-emerald-700 mt-1">
            Toàn bộ các khoản thu đã được ánh xạ khớp snapshot và currency chuẩn.
          </p>
        </div>
      ) : (
        <>
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
                  {/* Currency-aware formatted amount - doesn't force USD to VND! */}
                  <td className="px-5 py-4 font-bold tabular-nums text-ink whitespace-nowrap">
                    {formatMoneyWithCurrency(item.totalAmount, item.currency)}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
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

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 text-xs text-slate-600">
            <div>
              Hiển thị {offset + 1} – {Math.min(offset + data.items.length, data.total)} trong tổng
              số <strong>{data.total}</strong> giao dịch cần đối chiếu
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Trang trước</span>
              </Button>
              <span className="font-semibold text-ink px-2">
                Trang {page} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={offset + data.items.length >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2.5 text-xs"
              >
                <span>Trang sau</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RefundsQueueTab() {
  const [page, setPage] = useState(1);
  const offset = (page - 1) * PAGE_SIZE;

  const { query, confirmMutation } = useOperationsRefunds();
  const { data: refunds, isPending, isError, refetch } = query;

  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const form = useForm<OperationsManualRefundDraft>({
    resolver: zodResolver(OperationsManualRefundDraftSchema),
    defaultValues: { reference: "" },
  });

  async function handleConfirmRefund(values: OperationsManualRefundDraft) {
    if (!confirmingPaymentId) return;
    setFeedback(null);
    setActionError(null);
    try {
      await confirmMutation.mutateAsync({
        paymentId: confirmingPaymentId,
        reference: values.reference,
      });
      setFeedback(M.confirmRefundSuccess);
      setConfirmingPaymentId(null);
      form.reset();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setActionError(err.response?.data?.message || err.message || "Lỗi khi xác nhận hoàn tiền");
      } else {
        setActionError("Lỗi kết nối máy chủ khi xử lý hoàn tiền");
      }
    }
  }

  const paginatedRefunds = refunds ? refunds.slice(offset, offset + PAGE_SIZE) : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div>
          <h3 className="text-base font-bold text-ink">{M.tabRefundQueueTitle}</h3>
          <p className="m-0 text-xs text-slate-600 mt-1">
            Hàng chờ các khoản hoàn tiền trạng thái REFUND_PENDING cần xác nhận đối soát chuyển
            khoản.
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

      {actionError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 border border-rose-200"
        >
          {actionError}
        </p>
      )}

      {isPending ? (
        <LoadingState label={M.loading} variant="table" />
      ) : isError || !refunds ? (
        <ErrorState message={M.error} onRetry={() => void refetch()} />
      ) : refunds.length === 0 ? (
        <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-8 text-center">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
          <h4 className="font-bold text-emerald-900">Không có khoản hoàn nào đang chờ</h4>
          <p className="text-xs text-emerald-700 mt-1">
            Mọi yêu cầu hoàn tiền đã được xử lý hoặc không có nghĩa vụ tồn đọng.
          </p>
        </div>
      ) : (
        <>
          <OperationsTable label={M.tabRefundQueueTitle} headings={M.refundQueueHeadingsReal}>
            {paginatedRefunds.map((refund) => (
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
                  {formatMoneyWithCurrency(refund.amount, refund.currency)}
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
                      setActionError(null);
                      setConfirmingPaymentId(refund.paymentId);
                    }}
                  >
                    Xác nhận hoàn
                  </Button>
                </td>
              </tr>
            ))}
          </OperationsTable>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 text-xs text-slate-600">
            <div>
              Hiển thị {offset + 1} – {Math.min(offset + paginatedRefunds.length, refunds.length)}{" "}
              trong tổng số <strong>{refunds.length}</strong> yêu cầu hoàn tiền
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Trang trước</span>
              </Button>
              <span className="font-semibold text-ink px-2">
                Trang {page} / {Math.max(1, Math.ceil(refunds.length / PAGE_SIZE))}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={offset + paginatedRefunds.length >= refunds.length}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2.5 text-xs"
              >
                <span>Trang sau</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Manual Refund Confirmation Dialog with Zod Form */}
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
                {...form.register("reference")}
                autoFocus
              />
            </FieldShell>
            <p className="text-xs text-slate-400 -mt-2">{M.refundReferenceHelp}</p>

            {actionError && <p className="text-xs text-rose-600 font-semibold">{actionError}</p>}

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
