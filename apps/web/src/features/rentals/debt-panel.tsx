"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type DebtPaymentInput,
  DebtPaymentInputSchema,
  type DebtQuery,
  type DebtRecord,
  type ReturnSettlement,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/ui/list-pagination";
import { operationalField } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { DEBT_MESSAGES as M } from "./debts.messages";

export function SettlementSummary({ settlement }: { settlement?: ReturnSettlement | null }) {
  if (!settlement) return null;
  return (
    <section className="space-y-3 rounded-xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold">{M.settlement}</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          [M.deposit, settlement.depositAmount],
          [M.deductions, settlement.deductionAmount],
          [M.refund, settlement.refundAmount],
          [M.debt, settlement.debtAmount],
        ].map(([label, amount]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(Number(amount))}</dd>
          </div>
        ))}
        <div>
          <dt>{M.time}</dt>
          <dd>{formatDateTime(settlement.settledAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function DebtPanel({ rentalId }: { rentalId?: string }) {
  const user = useAuthStore((state) => state.session?.user);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DebtQuery["status"]>();
  const [selectedId, setSelectedId] = useState<string>();
  const list = useQuery({
    queryKey: ["debts", user?.id, rentalId, status, page],
    queryFn: () => api.debts.list({ rentalId, status, limit: 10, offset: (page - 1) * 10 }),
    enabled: Boolean(user),
  });
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{M.title}</h2>
        <label className="grid gap-1 text-sm">
          {M.status}
          <select
            className={operationalField}
            value={status ?? ""}
            onChange={(event) => {
              setStatus((event.target.value || undefined) as DebtQuery["status"]);
              setPage(1);
              setSelectedId(undefined);
            }}
          >
            <option value="">{M.all}</option>
            {Object.entries(M.statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <LoadingState variant="table" />
      ) : list.isError ? (
        <ErrorState message={M.loadError} onRetry={() => void list.refetch()} />
      ) : (
        <>
          {!list.data.items.length && <p className="text-sm text-slate-600">{M.empty}</p>}
          <ul className="divide-y divide-line">
            {list.data.items.map((debt) => (
              <li key={debt.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {debt.customerName} · {debt.unitCode}
                    </p>
                    <p className="text-sm">{M.statuses[debt.status]}</p>
                    <p className="text-sm">
                      {M.original}: {formatCurrency(Number(debt.originalAmount))} · {M.paid}:{" "}
                      {formatCurrency(Number(debt.paidAmount))}
                    </p>
                    <p className="text-sm">
                      {M.remaining}: <strong>{formatCurrency(Number(debt.remainingAmount))}</strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    aria-expanded={selectedId === debt.id}
                    onClick={() => setSelectedId(selectedId === debt.id ? undefined : debt.id)}
                  >
                    {user?.role === "FACILITY_STAFF" ? M.show : M.view}
                  </Button>
                </div>
                {selectedId === debt.id && (
                  <DebtHistory debt={debt} canCollect={user?.role === "FACILITY_STAFF"} />
                )}
              </li>
            ))}
          </ul>
          <ListPagination
            label={M.title}
            page={page}
            pageSize={10}
            total={list.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
function DebtHistory({ debt, canCollect }: { debt: DebtRecord; canCollect: boolean }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["debt", userId, debt.id],
    queryFn: () => api.debts.get(debt.id),
  });
  const form = useForm<DebtPaymentInput>({
    resolver: zodResolver(DebtPaymentInputSchema),
    defaultValues: { method: "CASH", idempotencyKey: crypto.randomUUID() },
  });
  const collect = useMutation({
    mutationFn: (input: DebtPaymentInput) => api.debts.collect(debt.id, input),
    onSuccess: async () => {
      form.reset({ method: "CASH", idempotencyKey: crypto.randomUUID() });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["debts"] }),
        client.invalidateQueries({ queryKey: ["debt", userId, debt.id] }),
        client.invalidateQueries({ queryKey: ["rental-payments"] }),
        client.invalidateQueries({ queryKey: ["facility-management"] }),
      ]);
    },
  });
  if (detail.isPending) return <LoadingState variant="detail" />;
  if (detail.isError)
    return <ErrorState message={M.loadError} onRetry={() => void detail.refetch()} />;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{M.history}</h3>
      {!detail.data.payments.length && <p className="text-sm text-slate-600">{M.noReceipts}</p>}
      <ul className="space-y-2 text-sm">
        {detail.data.payments.map((payment) => (
          <li key={payment.id}>
            {formatDateTime(payment.paidAt)} · {formatCurrency(Number(payment.totalAmount))} ·{" "}
            {payment.method === "CASH" ? M.cash : M.bankTransfer} {payment.reference}
          </li>
        ))}
      </ul>
      {canCollect && Number(detail.data.remainingAmount) > 0 && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((input) => collect.mutate(input))}
        >
          <label className="grid gap-1 text-sm">
            {M.amount}
            <input
              type="number"
              required
              min={1}
              max={Number(detail.data.remainingAmount)}
              step={1}
              className={operationalField}
              disabled={collect.isPending}
              {...form.register("amount", { valueAsNumber: true })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            {M.method}
            <select
              className={operationalField}
              disabled={collect.isPending}
              aria-label={M.method}
              {...form.register("method", { onChange: () => form.resetField("reference") })}
            >
              <option value="CASH">{M.cash}</option>
              <option value="BANK_TRANSFER">{M.bankTransfer}</option>
            </select>
          </label>
          {form.watch("method") === "BANK_TRANSFER" && (
            <label className="grid gap-1 text-sm">
              {M.reference}
              <input
                required
                className={operationalField}
                maxLength={128}
                disabled={collect.isPending}
                {...form.register("reference", {
                  setValueAs: (value) => value?.trim() || undefined,
                })}
              />
            </label>
          )}
          {Object.values(form.formState.errors).map((error) => (
            <p role="alert" className="text-sm text-danger" key={error.message}>
              {error.message}
            </p>
          ))}
          <Button type="submit" disabled={collect.isPending}>
            {M.collect}
          </Button>
        </form>
      )}
      {collect.isError && (
        <div role="alert" className="space-y-2 text-sm text-danger">
          <p>{M.paymentError}</p>
          <Button variant="outline" onClick={() => void detail.refetch()}>
            {M.view}
          </Button>
        </div>
      )}
      {collect.isSuccess && (
        <p role="status" className="text-sm text-primary">
          {M.confirmed}
        </p>
      )}
    </div>
  );
}
