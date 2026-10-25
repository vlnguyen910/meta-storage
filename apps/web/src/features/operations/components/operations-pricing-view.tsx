"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Edit, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { type OperationsPriceDraft, OperationsPriceDraftSchema } from "../operations.schema";
import { formatDateTimeVn, formatMoney } from "../operations.utils";
import { OperationsDialog, OperationsTable } from "../operations-parts";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";

export function OperationsPricingView() {
  const [search, setSearch] = useState("");
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
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(prices.length / 10)));

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
    <div className="grid min-w-0 gap-6">
      {/* Configuration Metadata Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div>
          <h2 className="text-base font-bold text-ink">{M.pricingConfigTitle}</h2>
          <p className="m-0 text-xs text-slate-600 mt-1">{M.priceScope}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-800">
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
            icon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={() => void handleConflictReload()}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {feedback && (
        <p
          role="status"
          className="m-0 rounded-xl bg-primary-soft p-4 text-sm font-semibold text-primary"
        >
          {feedback}
        </p>
      )}

      {/* Pricing Table */}
      <FieldShell label={M.priceSearch}>
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </FieldShell>
      {!prices.length && (
        <p role="status" className="rounded border border-line bg-white p-5 text-muted">
          {M.noPriceMatch}
        </p>
      )}
      <OperationsTable label={M.pricingConfigTitle} headings={M.priceHeadings}>
        {prices.slice((safePage - 1) * 10, safePage * 10).map((price) => (
          <tr key={price.unitTypeId} className="hover:bg-slate-50/50">
            <th scope="row" className="px-5 py-4 font-semibold text-ink whitespace-nowrap">
              {price.name}
            </th>
            <td className="px-5 py-4 text-slate-600 font-mono text-xs whitespace-nowrap">
              {price.code}
            </td>
            <td className="px-5 py-4 font-bold tabular-nums text-ink whitespace-nowrap">
              {formatMoney(price.monthlyPrice)}
            </td>
            <td className="px-5 py-4 whitespace-nowrap">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  price.isActive
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {price.isActive ? M.active : M.inactive}
              </span>
            </td>
            <td className="px-5 py-4 whitespace-nowrap">
              <Button
                type="button"
                variant="outline"
                className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
                aria-label={`Chỉnh giá thuê loại kho ${price.name}`}
                icon={<Edit size={13} aria-hidden="true" />}
                onClick={() => handleOpenEdit(price)}
              >
                Chỉnh giá
              </Button>
            </td>
          </tr>
        ))}
      </OperationsTable>
      <ListPagination
        label={M.pricingConfigTitle}
        page={safePage}
        pageSize={10}
        total={prices.length}
        onPageChange={setPage}
      />

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
