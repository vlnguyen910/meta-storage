"use client";

import {
  type PolicyViolationFee,
  UpdatePolicyViolationFeeCatalogSchema,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertCircle, AlertTriangle, CheckCircle2, Coins, Plus, Save, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";

export function OperationsFeesView() {
  const { showToast } = useToast();
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
      showToast(M.policyFeeSaved, "success");
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
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-slate-200/90 shadow-2xs">
        <CardHeader className="p-4 pb-3 flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-[#e8f3ef] text-[#165f4d] shrink-0">
                <Coins className="size-4" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                {M.policyFeesTitle}
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold px-2 py-0.5"
              >
                {M.policyFeesVersion} v{catalog.version}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-xs text-slate-500 max-w-2xl">
              Cấu hình các mức phí vi phạm quy định (như hỏng hóc, vi phạm vệ sinh) áp dụng trong
              quy trình trả kho & nghiệm thu.
            </CardDescription>
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
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-[#165f4d] hover:bg-[#0f493b] text-white cursor-pointer shadow-2xs transition-colors"
          >
            <Plus className="size-4" />
            {M.policyFeeAdd}
          </Button>
        </CardHeader>
      </Card>

      {/* Conflict banner */}
      {policyConflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 font-medium shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>{M.policyFeeConflict}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => setReloadConfirmOpen(true)}
            className="h-8 px-3 text-xs font-semibold border-amber-300 bg-white hover:bg-amber-100 text-amber-900 cursor-pointer"
          >
            {M.policyFeeReload}
          </Button>
        </div>
      )}

      {/* Validation warning */}
      {!catalogInput.success && (
        <div
          role="alert"
          className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-2xs"
        >
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{M.policyFeeInvalid}</span>
        </div>
      )}

      {/* Save error */}
      {save.isError && !policyConflict && (
        <div
          role="alert"
          className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-2xs"
        >
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{M.policyFeeSaveError}</span>
        </div>
      )}

      {/* Save success */}
      {save.isSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-2xs"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{M.saved}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/95 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[24%]">
                {M.policyFeeCode}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[36%]">
                {M.policyFeeName}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[22%]">
                {M.policyFeeAmount}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[12%] text-center">
                {M.policyFeeActive}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[6%] text-center">
                {M.actions}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500 text-xs">
                  {M.policyFeeEmpty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item, index) => (
                <TableRow
                  key={item.code || index}
                  className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Code */}
                  <TableCell className="py-2.5 px-4">
                    <input
                      id={`policy-fee-code-${index}`}
                      aria-label={M.policyFeeCode}
                      placeholder={M.policyFeeCodePlaceholder}
                      value={item.code}
                      disabled={save.isPending}
                      onChange={(e) => update(index, { code: e.target.value.toUpperCase() })}
                      className="w-full h-8 px-2.5 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] focus:outline-none transition-all disabled:opacity-50"
                    />
                  </TableCell>

                  {/* Name */}
                  <TableCell className="py-2.5 px-4">
                    <input
                      id={`policy-fee-name-${index}`}
                      aria-label={M.policyFeeName}
                      placeholder={M.policyFeeNamePlaceholder}
                      value={item.name}
                      disabled={save.isPending}
                      onChange={(e) => update(index, { name: e.target.value })}
                      className="w-full h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] focus:outline-none transition-all disabled:opacity-50"
                    />
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="py-2.5 px-4">
                    <div className="relative">
                      <input
                        id={`policy-fee-amount-${index}`}
                        aria-label={M.policyFeeAmount}
                        type="number"
                        min="0"
                        step="1000"
                        value={item.amount}
                        disabled={save.isPending}
                        onChange={(e) => update(index, { amount: Number(e.target.value) })}
                        className="w-full h-8 pl-2.5 pr-8 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] focus:outline-none transition-all disabled:opacity-50 tabular-nums"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                        ₫
                      </span>
                    </div>
                  </TableCell>

                  {/* Active checkbox */}
                  <TableCell className="py-2.5 px-4 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        disabled={save.isPending}
                        onChange={(e) => update(index, { isActive: e.target.checked })}
                        className="size-4 rounded border-slate-300 text-[#165f4d] focus:ring-[#165f4d] cursor-pointer disabled:opacity-50"
                      />
                    </label>
                  </TableCell>

                  {/* Delete button */}
                  <TableCell className="py-2.5 px-4 text-center">
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={M.policyFeeRemove}
                      disabled={save.isPending}
                      onClick={() => {
                        save.reset();
                        setItems(rows.filter((_, i) => i !== index));
                      }}
                      className="size-8 p-0 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/50 cursor-pointer disabled:opacity-50"
                      icon={<Trash2 className="size-3.5" />}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Save Action Footer */}
      <div className="flex items-center justify-end pt-1">
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={save.isPending || items === null || policyConflict || !catalogInput.success}
          onClick={() => save.mutate()}
          className="h-10 px-5 text-xs font-semibold gap-2 bg-[#165f4d] hover:bg-[#0f493b] text-white cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
        >
          <Save className="size-4" />
          {save.isPending ? M.policyFeeSaving : M.policyFeeSave}
        </Button>
      </div>

      {/* Reload Confirmation Dialog */}
      <AlertDialog open={reloadConfirmOpen} onOpenChange={setReloadConfirmOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              {M.policyFeeReload}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              {M.policyFeeReloadConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline" className="h-9 px-4 text-xs font-semibold border-slate-200">
                {M.cancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="primary"
                disabled={query.isFetching}
                onClick={() => {
                  setReloadConfirmOpen(false);
                  void reloadCatalog();
                }}
                className="h-9 px-4 text-xs font-semibold bg-[#165f4d] hover:bg-[#0f493b] text-white"
              >
                {query.isFetching ? M.policyFeeReloading : M.policyFeeReload}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
