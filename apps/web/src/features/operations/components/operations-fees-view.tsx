"use client";

import {
  type PolicyViolationFee,
  UpdatePolicyViolationFeeCatalogSchema,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";

export function OperationsFeesView() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["policy-violation-fees"],
    queryFn: api.inspections.policyFees,
  });
  const [items, setItems] = useState<PolicyViolationFee[] | null>(null);
  const [policyConflict, setPolicyConflict] = useState(false);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api.inspections.updatePolicyFees({
        expectedVersion: query.data?.version ?? 0,
        items: (items ?? []).map(({ code, name, amount, isActive }) => ({
          code,
          name,
          amount,
          isActive,
        })),
      }),
    onSuccess: (data) => {
      setItems(null);
      setPolicyConflict(false);
      void client.setQueryData(["policy-violation-fees"], data);
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) setPolicyConflict(true);
    },
  });
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError) return <ErrorState message={M.error} onRetry={() => query.refetch()} />;
  const catalog = query.data;
  const rows = items ?? catalog.items;
  const catalogInput = UpdatePolicyViolationFeeCatalogSchema.safeParse({
    expectedVersion: catalog.version,
    items: rows.map(({ code, name, amount, isActive }) => ({ code, name, amount, isActive })),
  });
  function update(index: number, patch: Partial<PolicyViolationFee>) {
    save.reset();
    setItems(
      (items ?? catalog.items).map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  async function reloadCatalog() {
    const refreshed = await query.refetch();
    if (!refreshed.error) {
      setItems(null);
      setPolicyConflict(false);
      save.reset();
    }
  }
  return (
    <section className="space-y-4 rounded-card border border-line bg-white p-4 shadow-card sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[Space_Grotesk] text-xl font-semibold">{M.policyFeesTitle}</h1>
          <p className="text-sm text-muted">
            {M.policyFeesVersion} {catalog.version}
          </p>
        </div>
        <Button
          variant="primary"
          disabled={save.isPending}
          onClick={() => {
            save.reset();
            setItems([
              ...rows,
              { code: `NEW_FEE_${rows.length + 1}`, name: "", amount: 0, isActive: true },
            ]);
          }}
        >
          <Plus size={16} />
          {M.policyFeeAdd}
        </Button>
      </header>
      <div className="space-y-3">
        {rows.map((item, index) => (
          <div
            key={item.code}
            className="grid gap-3 rounded-card border border-line p-3 sm:grid-cols-[1fr_2fr_1fr_auto_auto] sm:items-end"
          >
            <label
              htmlFor={`policy-fee-code-${index}`}
              className="grid gap-1 text-xs font-semibold text-muted"
            >
              {M.policyFeeCode}
              <Input
                id={`policy-fee-code-${index}`}
                aria-label={M.policyFeeCode}
                placeholder={M.policyFeeCode}
                value={item.code}
                disabled={save.isPending}
                onChange={(e) => update(index, { code: e.target.value.toUpperCase() })}
              />
            </label>
            <label
              htmlFor={`policy-fee-name-${index}`}
              className="grid gap-1 text-xs font-semibold text-muted"
            >
              {M.policyFeeName}
              <Input
                id={`policy-fee-name-${index}`}
                aria-label={M.policyFeeName}
                placeholder={M.policyFeeName}
                value={item.name}
                disabled={save.isPending}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
            <label
              htmlFor={`policy-fee-amount-${index}`}
              className="grid gap-1 text-xs font-semibold text-muted"
            >
              {M.policyFeeAmount}
              <Input
                id={`policy-fee-amount-${index}`}
                aria-label={M.policyFeeAmount}
                type="number"
                min="0"
                step="1"
                value={item.amount}
                disabled={save.isPending}
                onChange={(e) => update(index, { amount: Number(e.target.value) })}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.isActive}
                disabled={save.isPending}
                onChange={(e) => update(index, { isActive: e.target.checked })}
              />
              {M.policyFeeActive}
            </label>
            <Button
              variant="outline"
              aria-label={M.policyFeeRemove}
              disabled={save.isPending}
              onClick={() => {
                save.reset();
                setItems(rows.filter((_, i) => i !== index));
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      {!catalogInput.success && (
        <p role="alert" className="text-sm text-danger">
          {M.policyFeeInvalid}
        </p>
      )}
      {save.isError && !policyConflict && (
        <p role="alert" className="text-sm text-danger">
          {M.policyFeeSaveError}
        </p>
      )}
      {policyConflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>{M.policyFeeConflict}</span>
          <Button variant="outline" onClick={() => setReloadConfirmOpen(true)}>
            {M.policyFeeReload}
          </Button>
        </div>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-emerald-800">
          {M.saved}
        </p>
      )}
      <Button
        variant="primary"
        disabled={save.isPending || items === null || policyConflict || !catalogInput.success}
        onClick={() => save.mutate()}
      >
        <Save size={16} />
        {save.isPending ? M.policyFeeSaving : M.policyFeeSave}
      </Button>
      <AlertDialog open={reloadConfirmOpen} onOpenChange={setReloadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{M.policyFeeReload}</AlertDialogTitle>
            <AlertDialogDescription>{M.policyFeeReloadConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{M.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="primary"
                disabled={query.isFetching}
                onClick={() => {
                  setReloadConfirmOpen(false);
                  void reloadCatalog();
                }}
              >
                {query.isFetching ? M.policyFeeReloading : M.policyFeeReload}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
