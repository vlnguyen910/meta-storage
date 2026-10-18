"use client";

import { AlertTriangle, Edit, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { formatDateTimeVn, formatMoney } from "../operations.utils";
import { OperationsDialog, OperationsTable } from "../operations-parts";

interface EditPriceFormValues {
  monthlyPrice: number;
}

export function OperationsPricingView() {
  const { configQuery, updatePriceMutation, conflictError, reloadData } = useOperationsPricing();

  const [editingItem, setEditingItem] = useState<{
    unitTypeId: string;
    name: string;
    monthlyPrice: number;
  } | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);

  const priceForm = useForm<EditPriceFormValues>();

  const { data, isPending, isError, refetch } = configQuery;

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !data) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  function handleOpenEdit(price: { unitTypeId: string; name: string; monthlyPrice: number }) {
    setFeedback(null);
    setEditingItem(price);
    priceForm.reset({ monthlyPrice: price.monthlyPrice });
  }

  async function handleSavePrice(values: EditPriceFormValues) {
    if (!editingItem || !data) return;
    try {
      await updatePriceMutation.mutateAsync({
        unitTypeId: editingItem.unitTypeId,
        expectedVersion: data.version,
        monthlyPrice: values.monthlyPrice,
      });
      setFeedback(M.pricingUpdated);
      setEditingItem(null);
    } catch {
      // Conflict error or other errors are handled in mutation state
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
            {M.currentVersion}: <strong className="font-bold text-primary">{data.version}</strong>
          </div>
          <div className="text-slate-500">
            {M.updatedAtLabel}: {formatDateTimeVn(data.updatedAt)}
          </div>
          <div className="text-slate-500">
            {M.updatedByLabel}:{" "}
            <span className="font-medium text-slate-800">{data.updatedBy ?? "Hệ thống"}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            icon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={reloadData}
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

      {conflictError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>{M.conflictTitle}</span>
          </div>
          <p className="mt-1 text-sm">{conflictError}</p>
          <Button type="button" variant="outline" className="mt-3 text-xs" onClick={reloadData}>
            {M.conflictReload}
          </Button>
        </div>
      )}

      {/* Pricing Table */}
      <OperationsTable label={M.titles.pricing} headings={M.priceHeadings}>
        {data.prices.map((price) => (
          <tr key={price.unitTypeId} className="hover:bg-slate-50/50">
            <th scope="row" className="px-5 py-4 font-semibold text-primary whitespace-nowrap">
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
                icon={<Edit size={14} aria-hidden="true" />}
                onClick={() =>
                  handleOpenEdit({
                    unitTypeId: price.unitTypeId,
                    name: price.name,
                    monthlyPrice: price.monthlyPrice,
                  })
                }
                aria-label={M.editPriceLabel(price.name)}
              >
                {M.edit}
              </Button>
            </td>
          </tr>
        ))}
      </OperationsTable>

      {/* Edit Price Dialog */}
      {editingItem && (
        <OperationsDialog
          title={M.editPriceLabel(editingItem.name)}
          onClose={() => setEditingItem(null)}
        >
          <form
            noValidate
            className="grid gap-4"
            onSubmit={priceForm.handleSubmit(handleSavePrice)}
          >
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p className="m-0">
                Phiên bản áp dụng: <strong className="font-bold text-ink">{data.version}</strong>
              </p>
              <p className="m-0 mt-1">
                Giá hiện tại:{" "}
                <strong className="font-bold text-ink">
                  {formatMoney(editingItem.monthlyPrice)}
                </strong>
              </p>
            </div>

            {conflictError && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <p className="font-bold">{M.conflictTitle}</p>
                <p className="mt-1">{conflictError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 text-xs"
                  onClick={reloadData}
                >
                  {M.conflictReload}
                </Button>
              </div>
            )}

            <FieldShell label={M.newPrice} error={priceForm.formState.errors.monthlyPrice?.message}>
              <Input
                type="number"
                min={0}
                step={1000}
                {...priceForm.register("monthlyPrice", {
                  valueAsNumber: true,
                  required: M.required,
                  min: { value: 0, message: M.nonnegative },
                })}
                autoFocus
              />
            </FieldShell>

            <div className="mt-2 flex flex-wrap justify-end gap-3">
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
