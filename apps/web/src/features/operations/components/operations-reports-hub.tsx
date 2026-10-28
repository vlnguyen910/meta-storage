"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type RentalStatus, RentalStatusSchema } from "@metastorage/contracts";
import axios from "axios";
import { ArrowRight, CheckCircle2, Download, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { OperationsDialog } from "../operations-parts";
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
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Top Bar: Tabs & Quick Links */}
      <section className="shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-lg border border-slate-200/80">
          <button
            type="button"
            onClick={() => setTab("rentals")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all",
              activeTab === "rentals"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            {M.tabRentalsTitle}
          </button>
          <button
            type="button"
            onClick={() => setTab("reconciliation")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all",
              activeTab === "reconciliation"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            {M.tabReconciliationTitle}
          </button>
          <button
            type="button"
            onClick={() => setTab("refunds")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all",
              activeTab === "refunds"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            {M.tabRefundQueueTitle}
          </button>
        </div>

        {/* Quick Links to Revenue & Utilization */}
        <div className="flex items-center gap-2">
          <Link
            href={routes.revenue}
            className="text-xs font-semibold text-slate-700 hover:text-primary px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white inline-flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <span>{M.titles.revenue}</span>
            <ArrowRight size={13} className="text-primary" />
          </Link>
          <Link
            href={routes.utilization}
            className="text-xs font-semibold text-slate-700 hover:text-primary px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white inline-flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <span>{M.titles.utilization}</span>
            <ArrowRight size={13} className="text-primary" />
          </Link>
        </div>
      </section>

      {/* Main Tab Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "rentals" && <RentalsTab />}
        {activeTab === "reconciliation" && <ReconciliationTab />}
        {activeTab === "refunds" && <RefundsQueueTab />}
      </div>
    </div>
  );
}

function RentalsTab() {
  const [facilityId, setFacilityId] = useState("all");
  const [unitTypeId, setUnitTypeId] = useState("all");
  const [status, setStatus] = useState<RentalStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  }

  function handleResetSearch() {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  function handleResetAll() {
    setFacilityId("all");
    setStatus("all");
    setUnitTypeId("all");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
    setExportError(null);
  }

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

  const items = (data?.items ?? []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.bookingCode?.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.facilityName.toLowerCase().includes(q) ||
      item.unitTypeName.toLowerCase().includes(q) ||
      item.unitCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Filters Toolbar */}
      <section className="shrink-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{R.rentalTitle}</h2>
            <p className="m-0 text-xs text-slate-500">{R.rentalHelp}</p>
          </div>
          {summary.data && (
            <div className="flex flex-wrap items-center gap-1.5">
              {summary.data.byStatus.map((item) => (
                <span
                  key={item.status}
                  className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
                >
                  <span className="text-slate-500">
                    {R.rentalStatuses[item.status] ?? item.status}:{" "}
                  </span>
                  <strong className="text-slate-900">{item.count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2.5 flex flex-wrap items-end gap-2.5">
          {/* Search Form with Submit Button */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 min-w-64 flex-1">
            <div className="relative flex-1">
              <Input
                type="search"
                placeholder="Tìm mã đặt chỗ, mã kho, cơ sở..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-8 text-xs pl-8 pr-3"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
            <Button
              type="submit"
              className="h-8 px-3 text-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <Search size={13} aria-hidden="true" />
              <span>Tìm kiếm</span>
            </Button>
            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetSearch}
                className="h-8 px-2 text-xs shrink-0 text-slate-600"
              >
                <X size={13} className="mr-1" />
                <span>Xóa lọc</span>
              </Button>
            )}
          </form>

          {/* Facility Select */}
          <div className="w-48">
            <span className="block text-xs font-semibold text-slate-700 mb-1">
              {M.facilityFilter}
            </span>
            <DropdownSelect
              value={facilityId}
              onChange={(newFacilityId) => {
                setFacilityId(newFacilityId);
                setPage(1);
              }}
              className="w-full"
              triggerClassName="h-8 w-full bg-white"
              options={[
                { value: "all", label: M.allFacilities },
                ...catalogFacilities.map((fac) => ({ value: fac.id, label: fac.name })),
              ]}
              maxVisibleItems={6}
            />
          </div>

          {/* Unit Type Select */}
          <div className="w-44">
            <span className="block text-xs font-semibold text-slate-700 mb-1">
              {M.unitTypeFilter}
            </span>
            <DropdownSelect
              value={unitTypeId}
              onChange={(newUnitTypeId) => {
                setUnitTypeId(newUnitTypeId);
                setPage(1);
              }}
              className="w-full"
              triggerClassName="h-8 w-full bg-white"
              options={[
                { value: "all", label: M.allUnitTypes },
                ...catalogUnitTypes.map((type) => ({ value: type.unitTypeId, label: type.name })),
              ]}
              maxVisibleItems={6}
            />
          </div>

          {/* Status Select */}
          <div className="w-44">
            <span className="block text-xs font-semibold text-slate-700 mb-1">
              {R.rentalStatus}
            </span>
            <DropdownSelect
              value={status}
              onChange={(newStatus) => {
                const parsedStatus = RentalStatusSchema.safeParse(newStatus);
                setStatus(parsedStatus.success ? parsedStatus.data : "all");
                setPage(1);
              }}
              className="w-full"
              triggerClassName="h-8 w-full bg-white"
              options={[
                { value: "all", label: "Tất cả trạng thái" },
                ...Array.from(
                  new Set([
                    ...(summary.data?.byStatus.map((item) => item.status) ?? []),
                    ...(status === "all" ? [] : [status]),
                  ]),
                ).map((value) => ({
                  value,
                  label: R.rentalStatuses[value] ?? value,
                })),
              ]}
              maxVisibleItems={6}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
              onClick={handleResetAll}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>{M.reset}</span>
            </Button>
            <Button
              type="button"
              loading={exporting}
              className="h-8 px-3 text-xs inline-flex items-center gap-1.5"
              onClick={handleExport}
            >
              <Download size={13} aria-hidden="true" />
              <span>{M.export}</span>
            </Button>
          </div>
        </div>
      </section>

      {exportError && (
        <div
          role="alert"
          className="shrink-0 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-800"
        >
          {exportError}
        </div>
      )}

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {isPending ? (
          <LoadingState label={M.loading} variant="table" />
        ) : isError || !data ? (
          <ErrorState message={M.error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-slate-500">
            {searchQuery
              ? "Không tìm thấy lượt thuê nào khớp với từ khóa tìm kiếm."
              : R.rentalEmpty}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Mã đặt chỗ
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Cơ sở
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Loại kho
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Mã ô kho
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Ngày bắt đầu
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Hạn thuê
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Trạng thái
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-mono text-xs font-semibold text-primary py-2.5 px-4 whitespace-nowrap">
                    {item.bookingCode ?? item.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-800 font-medium py-2.5 px-4 whitespace-nowrap">
                    {item.facilityName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 py-2.5 px-4 whitespace-nowrap">
                    {item.unitTypeName}
                  </TableCell>
                  <TableCell className="text-xs font-mono font-bold text-slate-900 py-2.5 px-4 whitespace-nowrap">
                    {item.unitCode}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 tabular-nums py-2.5 px-4 whitespace-nowrap">
                    {formatDateVn(item.startAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 tabular-nums py-2.5 px-4 whitespace-nowrap font-medium">
                    {formatDateVn(item.expectedEndAt)}
                  </TableCell>
                  <TableCell className="py-2.5 px-4 whitespace-nowrap">
                    <Badge
                      className={cn(
                        "text-[11px] font-medium border px-2 py-0.5",
                        item.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : item.status === "OVERDUE"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-amber-50 text-amber-800 border-amber-200",
                      )}
                    >
                      {R.rentalStatuses[item.status] ?? item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination Footer with Jump Support */}
      {data && (
        <div className="shrink-0 pt-1">
          <ListPagination
            label={M.rentalSummary}
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            unitLabel="lượt thuê"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function ReconciliationTab() {
  const [facilityId, setFacilityId] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { facilities: catalogFacilities } = useOperationsCatalogOptions();
  const offset = (page - 1) * PAGE_SIZE;

  const query = useOperationsReconciliation({
    facilityId: facilityId === "all" ? undefined : facilityId,
    limit: PAGE_SIZE,
    offset,
  });

  const { data, isPending, isError, refetch } = query;

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  }

  function handleResetSearch() {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  const items = (data?.items ?? []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.paymentId.toLowerCase().includes(q) ||
      Boolean(item.bookingId?.toLowerCase().includes(q)) ||
      Boolean(item.facilityId?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Header Info & Filters */}
      <section className="shrink-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{M.tabReconciliationTitle}</h3>
            <p className="m-0 text-xs text-slate-500">{M.reconciliationSummary}</p>
          </div>
          {data && (
            <span className="text-xs text-slate-500 font-medium">
              {M.asOfDisplay(formatDateTimeVn(data.asOf))}
            </span>
          )}
        </div>

        <div className="pt-2.5 flex flex-wrap items-end gap-2.5">
          {/* Search Form with Confirm Button */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 min-w-64 flex-1">
            <div className="relative flex-1">
              <Input
                type="search"
                placeholder="Tìm mã thanh toán, mã đặt chỗ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-8 text-xs pl-8 pr-3"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
            <Button
              type="submit"
              className="h-8 px-3 text-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <Search size={13} aria-hidden="true" />
              <span>Tìm kiếm</span>
            </Button>
            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetSearch}
                className="h-8 px-2 text-xs shrink-0 text-slate-600"
              >
                <X size={13} className="mr-1" />
                <span>Xóa lọc</span>
              </Button>
            )}
          </form>

          {/* Facility Select */}
          <div className="w-56">
            <span className="block text-xs font-semibold text-slate-700 mb-1">
              {M.facilityFilter}
            </span>
            <DropdownSelect
              value={facilityId}
              onChange={(newFacilityId) => {
                setFacilityId(newFacilityId);
                setPage(1);
              }}
              className="w-full"
              triggerClassName="h-8 w-full bg-white"
              options={[
                { value: "all", label: M.allFacilities },
                ...catalogFacilities.map((fac) => ({ value: fac.id, label: fac.name })),
              ]}
              maxVisibleItems={6}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
            onClick={() => void refetch()}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Làm mới</span>
          </Button>
        </div>
      </section>

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {isPending ? (
          <LoadingState label={M.loading} variant="table" />
        ) : isError || !data ? (
          <ErrorState message={M.error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6">
            <CheckCircle2 size={28} className="text-emerald-600 mb-2" />
            <h4 className="font-bold text-sm text-slate-800">Không có giao dịch cần đối chiếu</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Toàn bộ các khoản thu đã được ánh xạ khớp snapshot và currency chuẩn.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Mã giao dịch
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Mã đặt chỗ
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Cơ sở
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Số tiền
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Tiền tệ
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Trạng thái
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Thời điểm
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Vấn đề đối chiếu
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const issues = [];
                if (item.missingSnapshot) issues.push(M.issueMissingSnapshot);
                if (item.unclassifiedDeposit) issues.push(M.issueUnclassifiedDeposit);
                if (item.unsupportedCurrency) issues.push(M.issueUnsupportedCurrency);

                return (
                  <TableRow key={item.paymentId} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="font-mono text-xs text-primary py-2.5 px-4 whitespace-nowrap">
                      {item.paymentId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 py-2.5 px-4 whitespace-nowrap">
                      {item.bookingId ? `${item.bookingId.slice(0, 8)}...` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 py-2.5 px-4 whitespace-nowrap">
                      {item.facilityId ? `${item.facilityId.slice(0, 8)}...` : "Chưa xác định"}
                    </TableCell>
                    <TableCell className="font-bold tabular-nums text-xs text-slate-900 py-2.5 px-4 whitespace-nowrap">
                      {formatMoneyWithCurrency(item.totalAmount, item.currency)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600 py-2.5 px-4 whitespace-nowrap">
                      {item.currency}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 whitespace-nowrap">
                      <Badge className="text-[11px] font-medium bg-slate-100 text-slate-700 border-slate-200 px-2 py-0.5">
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 py-2.5 px-4 whitespace-nowrap">
                      {formatDateTimeVn(item.paidAt)}
                    </TableCell>
                    <TableCell className="py-2.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {issues.map((issue) => (
                          <Badge
                            key={issue}
                            className="text-[10px] font-medium bg-amber-50 text-amber-800 border-amber-200 px-1.5 py-0.2"
                          >
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination Footer with Jump Support */}
      {data && (
        <div className="shrink-0 pt-1">
          <ListPagination
            label={M.tabReconciliationTitle}
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            unitLabel="giao dịch"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function RefundsQueueTab() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  }

  function handleResetSearch() {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

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

  const filteredRefunds = (refunds ?? []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.paymentId.toLowerCase().includes(q) || Boolean(r.bookingId?.toLowerCase().includes(q));
  });

  const paginatedRefunds = filteredRefunds.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Header Bar */}
      <section className="shrink-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{M.tabRefundQueueTitle}</h3>
            <p className="m-0 text-xs text-slate-500">
              Hàng chờ các khoản hoàn tiền trạng thái REFUND_PENDING cần xác nhận đối soát.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              Tổng chờ: <strong className="text-slate-900">{filteredRefunds.length}</strong> yêu cầu
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
              onClick={() => void refetch()}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Làm mới</span>
            </Button>
          </div>
        </div>

        {/* Search Form with Confirm Button */}
        <div className="pt-2.5 flex items-center gap-2 max-w-md">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Input
                type="search"
                placeholder="Tìm mã thanh toán, mã đặt chỗ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-8 text-xs pl-8 pr-3"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
            <Button
              type="submit"
              className="h-8 px-3 text-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <Search size={13} aria-hidden="true" />
              <span>Tìm kiếm</span>
            </Button>
            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetSearch}
                className="h-8 px-2 text-xs shrink-0 text-slate-600"
              >
                <X size={13} className="mr-1" />
                <span>Xóa lọc</span>
              </Button>
            )}
          </form>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className="shrink-0 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-800"
        >
          {feedback}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="shrink-0 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-800"
        >
          {actionError}
        </div>
      )}

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {isPending ? (
          <LoadingState label={M.loading} variant="table" />
        ) : isError || !refunds ? (
          <ErrorState message={M.error} onRetry={() => void refetch()} />
        ) : filteredRefunds.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6">
            <CheckCircle2 size={28} className="text-emerald-600 mb-2" />
            <h4 className="font-bold text-sm text-slate-800">Không có khoản hoàn nào đang chờ</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? "Không tìm thấy yêu cầu hoàn tiền nào khớp với từ khóa tìm kiếm."
                : "Mọi yêu cầu hoàn tiền đã được xử lý hoặc không có nghĩa vụ tồn đọng."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Mã giao dịch
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Mã đặt chỗ
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Số tiền hoàn
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                  Thời điểm ghi nhận
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4 text-right">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRefunds.map((refund) => (
                <TableRow key={refund.paymentId} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-mono text-xs font-semibold text-primary py-2.5 px-4 whitespace-nowrap">
                    {refund.paymentId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700 py-2.5 px-4 whitespace-nowrap">
                    {refund.bookingId ? `${refund.bookingId.slice(0, 8)}...` : "—"}
                  </TableCell>
                  <TableCell className="font-bold tabular-nums text-xs text-rose-600 py-2.5 px-4 whitespace-nowrap">
                    {formatMoneyWithCurrency(refund.amount, refund.currency)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 tabular-nums py-2.5 px-4 whitespace-nowrap">
                    {formatDateTimeVn(refund.paidAt)}
                  </TableCell>
                  <TableCell className="py-2.5 px-4 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      className="h-7 px-2.5 text-xs inline-flex items-center gap-1.5"
                      onClick={() => {
                        setFeedback(null);
                        setActionError(null);
                        setConfirmingPaymentId(refund.paymentId);
                      }}
                    >
                      Xác nhận hoàn
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination Footer with Jump Support */}
      {refunds && (
        <div className="shrink-0 pt-1">
          <ListPagination
            label={M.tabRefundQueueTitle}
            page={page}
            pageSize={PAGE_SIZE}
            total={filteredRefunds.length}
            unitLabel="yêu cầu"
            onPageChange={setPage}
          />
        </div>
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
