"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Edit, RefreshCw, Search, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/cn";
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { type OperationsPriceDraft, OperationsPriceDraftSchema } from "../operations.schema";
import { formatDateTimeVn, formatMoney } from "../operations.utils";
import { OperationsDialog } from "../operations-parts";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";

export function OperationsPricingView() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const {
    configQuery,
    updatePriceMutation,
    conflictError,
    mutationError,
    setConflictError,
    setMutationError,
    reloadData,
  } = useOperationsPricing();

  const [editingItem, setEditingItem] = useState<{
    unitTypeId: string;
    name: string;
    code: string;
    monthlyPrice: number;
    baseVersion: number;
  } | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);

  const priceForm = useForm<OperationsPriceDraft>({
    resolver: zodResolver(OperationsPriceDraftSchema),
  });

  const { data, isPending, refetch } = configQuery;

  if (isPending) return <LoadingState label={M.loading} variant="table" />;
  if (!data) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  const prices = data.prices.filter((price) =>
    `${price.name} ${price.code}`
      .toLocaleLowerCase("vi")
      .includes(searchQuery.trim().toLocaleLowerCase("vi")),
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(prices.length / 10)));

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

  function handleOpenEdit(price: {
    unitTypeId: string;
    name: string;
    code: string;
    monthlyPrice: number;
  }) {
    if (!data) return;
    setFeedback(null);
    setConflictError(null);
    setMutationError(null);
    setEditingItem({ ...price, baseVersion: data.version });
    priceForm.reset({ monthlyPrice: price.monthlyPrice });
  }

  async function handleSavePrice(values: OperationsPriceDraft) {
    if (!editingItem || !data) return;
    setFeedback(null);
    setMutationError(null);
    setConflictError(null);

    try {
      await updatePriceMutation.mutateAsync({
        unitTypeId: editingItem.unitTypeId,
        expectedVersion: editingItem.baseVersion,
        monthlyPrice: values.monthlyPrice,
      });
      setFeedback(M.pricingUpdated);
      setEditingItem(null);
    } catch {
      // 409 Conflict and other errors are captured in mutation state
    }
  }

  async function handleConflictReload() {
    try {
      const latest = await reloadData();
      setEditingItem((item) => (item ? { ...item, baseVersion: latest.version } : null));
      setFeedback(R.compareVersion);
    } catch {
      setMutationError(R.reloadError);
    }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Configuration Metadata Bar */}
      <section className="shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{M.pricingConfigTitle}</h2>
          <p className="m-0 text-xs text-slate-500 mt-0.5">{M.priceScope}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-800">
            {M.currentVersion}: <strong className="font-bold text-primary">v{data.version}</strong>
          </div>
          <div className="text-slate-500">
            {M.updatedAtLabel}: {formatDateTimeVn(data.updatedAt)}
          </div>
          <div className="text-slate-500 font-mono">
            {M.updatedByLabel}:{" "}
            <span className="font-medium text-slate-800">{data.updatedBy ?? "Hệ thống"}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2.5 text-xs inline-flex items-center gap-1.5"
            onClick={() => void handleConflictReload()}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Làm mới</span>
          </Button>
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

      {/* Search Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Input
              type="search"
              placeholder="Tìm theo tên hoặc mã loại kho..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
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
        <div className="text-xs text-slate-500 font-medium">
          Tổng số: <strong className="text-slate-900">{prices.length}</strong> loại kho
        </div>
      </div>

      {/* Pricing Table */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                Tên loại kho
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                Mã loại
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                Giá thuê tháng
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4">
                Trạng thái
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 py-2.5 px-4 text-right">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-xs text-slate-500">
                  {searchQuery
                    ? "Không tìm thấy loại kho nào khớp với từ khóa tìm kiếm."
                    : M.noPriceMatch}
                </TableCell>
              </TableRow>
            ) : (
              prices.slice((safePage - 1) * 10, safePage * 10).map((price) => (
                <TableRow key={price.unitTypeId} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium text-xs text-slate-900 py-2.5 px-4 whitespace-nowrap">
                    {price.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 py-2.5 px-4 whitespace-nowrap">
                    {price.code}
                  </TableCell>
                  <TableCell className="font-bold tabular-nums text-xs text-slate-900 py-2.5 px-4 whitespace-nowrap">
                    {formatMoney(price.monthlyPrice)}
                  </TableCell>
                  <TableCell className="py-2.5 px-4 whitespace-nowrap">
                    <Badge
                      className={cn(
                        "text-[11px] font-medium border px-2 py-0.5",
                        price.isActive
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200",
                      )}
                    >
                      {price.isActive ? M.active : M.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 px-4 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2.5 text-xs inline-flex items-center gap-1.5"
                      aria-label={`Chỉnh giá thuê loại kho ${price.name}`}
                      onClick={() => handleOpenEdit(price)}
                    >
                      <Edit size={12} aria-hidden="true" />
                      <span>Chỉnh giá</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="shrink-0 pt-1">
        <ListPagination
          label={M.pricingConfigTitle}
          page={safePage}
          pageSize={10}
          total={prices.length}
          unitLabel="loại kho"
          onPageChange={setPage}
        />
      </div>

      {/* Edit Price Modal Dialog */}
      {editingItem && (
        <OperationsDialog
          title={`Chỉnh giá thuê: ${editingItem.name}`}
          onClose={() => setEditingItem(null)}
        >
          <form
            noValidate
            className="grid gap-4"
            onSubmit={priceForm.handleSubmit(handleSavePrice)}
          >
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-ink">
                Loại kho: {editingItem.name} ({editingItem.code})
              </p>
              <p className="mt-1">
                Phiên bản cấu hình kỳ vọng: <strong>v{editingItem.baseVersion}</strong>
              </p>
            </div>

            <p className="text-xs text-slate-600">
              {R.latestPrice(
                formatMoney(
                  data.prices.find((item) => item.unitTypeId === editingItem.unitTypeId)
                    ?.monthlyPrice,
                ),
                data.version,
              )}
            </p>
            {feedback && (
              <p role="status" className="text-xs text-primary">
                {feedback}
              </p>
            )}
            {mutationError && (
              <p
                role="alert"
                className="m-0 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-800 border border-rose-200"
              >
                {mutationError}
              </p>
            )}

            {conflictError && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900"
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <span>{M.conflictTitle}</span>
                </div>
                <p className="mt-1 text-xs">{conflictError}</p>
                <p className="mt-1.5 text-xs font-medium text-amber-950">
                  Phiên bản mới nhất trên máy chủ là <strong>v{data.version}</strong>. Bản nháp của
                  bạn được giữ nguyên để đối chiếu.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 text-xs h-7 px-2"
                  onClick={handleConflictReload}
                >
                  {M.conflictReload}
                </Button>
              </div>
            )}

            <FieldShell
              label="Giá thuê một tháng (VND)"
              error={priceForm.formState.errors.monthlyPrice?.message}
            >
              <Input
                type="number"
                min={0}
                step={1000}
                {...priceForm.register("monthlyPrice", { valueAsNumber: true })}
                autoFocus
              />
            </FieldShell>

            <div className="mt-3 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>
                {M.cancel}
              </Button>
              <Button type="submit" loading={updatePriceMutation.isPending}>
                {M.savePricing}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
    </div>
  );
}
