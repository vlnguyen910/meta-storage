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
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  History,
  Receipt,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEBT_MESSAGES as M } from "./debts.messages";

export function SettlementSummary({ settlement }: { settlement?: ReturnSettlement | null }) {
  if (!settlement) return null;
  return (
    <Card className="border-slate-200 bg-white shadow-2xs">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-emerald-50 text-emerald-800">
          <Receipt size={15} />
        </span>
        <h2 className="text-sm font-bold text-slate-900">{M.settlement}</h2>
      </CardHeader>
      <CardContent className="p-4">
        <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <dt className="text-[10px] font-semibold uppercase text-slate-400">{M.deposit}</dt>
            <dd className="mt-1 font-bold tabular-nums text-slate-900">
              {formatCurrency(Number(settlement.depositAmount))}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <dt className="text-[10px] font-semibold uppercase text-slate-400">{M.deductions}</dt>
            <dd className="mt-1 font-bold tabular-nums text-rose-600">
              {formatCurrency(Number(settlement.deductionAmount))}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <dt className="text-[10px] font-semibold uppercase text-slate-400">{M.refund}</dt>
            <dd className="mt-1 font-bold tabular-nums text-emerald-700">
              {formatCurrency(Number(settlement.refundAmount))}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <dt className="text-[10px] font-semibold uppercase text-slate-400">{M.debt}</dt>
            <dd className="mt-1 font-bold tabular-nums text-amber-700">
              {formatCurrency(Number(settlement.debtAmount))}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center justify-end text-[11px] text-slate-500">
          <span>{M.time}:</span>
          <span className="ml-1 font-medium text-slate-700">
            {formatDateTime(settlement.settledAt)}
          </span>
        </div>
      </CardContent>
    </Card>
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
    <Card className="overflow-hidden border-slate-200 bg-white shadow-2xs">
      <CardHeader className="flex flex-col items-stretch gap-3 space-y-0 border-b border-line bg-surface px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <Wallet size={16} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">{M.title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{M.description}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 text-xs font-semibold text-slate-700 sm:flex-row sm:items-center sm:gap-2">
          <span>{M.status}:</span>
          <DropdownSelect
            ariaLabel={M.status}
            value={status ?? ""}
            onChange={(val) => {
              setStatus((val || undefined) as DebtQuery["status"]);
              setPage(1);
              setSelectedId(undefined);
            }}
            options={[
              { value: "", label: M.all },
              ...Object.entries(M.statuses).map(([val, label]) => ({ value: val, label })),
            ]}
            className="w-full sm:w-48"
            triggerClassName="h-8.5 min-h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-normal text-slate-800"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {list.isPending ? (
          <div className="p-6">
            <LoadingState variant="table" />
          </div>
        ) : list.isError ? (
          <div className="p-6">
            <ErrorState message={M.loadError} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <>
            {!list.data.items.length ? (
              <p className="px-4 py-4 text-sm leading-6 text-slate-600">
                {rentalId && !status ? M.emptyRental : M.empty}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-slate-200 bg-slate-50/70">
                    <TableRow className="hover:bg-transparent border-0">
                      {!rentalId && (
                        <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                          {M.customerUnit}
                        </TableHead>
                      )}
                      <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                        {M.original}
                      </TableHead>
                      <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                        {M.paid}
                      </TableHead>
                      <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                        {M.remaining}
                      </TableHead>
                      <TableHead className="h-9 px-4 text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                        Trạng thái
                      </TableHead>
                      <TableHead className="h-9 px-4 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.data.items.map((debt) => {
                      const isExpanded = selectedId === debt.id;
                      return (
                        <DebtTableRow
                          key={debt.id}
                          debt={debt}
                          isExpanded={isExpanded}
                          onToggle={() => setSelectedId(isExpanded ? undefined : debt.id)}
                          isStaff={user?.role === "FACILITY_STAFF"}
                          showCustomer={!rentalId}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {list.data.total > 0 && (
              <div className="border-t border-slate-100 p-3 bg-slate-50/40">
                <ListPagination
                  label={M.title}
                  unitLabel={M.unitLabel}
                  page={page}
                  pageSize={10}
                  total={list.data.total}
                  onPageChange={setPage}
                  className="border-0 shadow-none bg-transparent p-0"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DebtTableRow({
  debt,
  isExpanded,
  onToggle,
  isStaff,
  showCustomer,
}: {
  debt: DebtRecord;
  isExpanded: boolean;
  onToggle: () => void;
  isStaff: boolean;
  showCustomer: boolean;
}) {
  return (
    <>
      <TableRow className={cn("transition-colors", isExpanded && "bg-slate-50/60")}>
        {showCustomer && (
          <TableCell className="px-4 py-3 align-middle">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-xs">{debt.customerName}</span>
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 font-mono text-[10px] text-emerald-800 px-1.5 py-0"
              >
                {debt.unitCode}
              </Badge>
            </div>
          </TableCell>
        )}
        <TableCell className="px-4 py-3 align-middle text-xs font-medium tabular-nums text-slate-600">
          {formatCurrency(Number(debt.originalAmount))}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle text-xs font-semibold tabular-nums text-emerald-700">
          {formatCurrency(Number(debt.paidAmount))}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle text-xs font-bold tabular-nums text-rose-600">
          {formatCurrency(Number(debt.remainingAmount))}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle text-center">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5",
              debt.status === "PAID"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : debt.status === "PARTIALLY_PAID"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-800",
            )}
          >
            {M.statuses[debt.status]}
          </Badge>
        </TableCell>
        <TableCell className="px-4 py-3 align-middle text-right">
          <Button
            type="button"
            variant="outline"
            aria-expanded={isExpanded}
            onClick={onToggle}
            className="min-h-0 h-8 px-2.5 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs gap-1.5"
          >
            <span>{isStaff ? M.show : M.view}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </Button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-slate-50/70 border-t-0">
          <TableCell colSpan={showCustomer ? 6 : 5} className="px-4 py-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <DebtHistory debt={debt} canCollect={isStaff} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DebtHistory({ debt, canCollect }: { debt: DebtRecord; canCollect: boolean }) {
  const { showToast } = useToast();
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
      showToast(M.confirmed, "success");
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
    <div className="space-y-4">
      {/* Receipts History */}
      <div>
        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 mb-2">
          <History size={14} className="text-slate-500" />
          <h3>{M.history}</h3>
        </div>

        {!detail.data.payments.length ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500">
            {M.noReceipts}
          </p>
        ) : (
          <div className="space-y-1.5">
            {detail.data.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded bg-emerald-100 text-emerald-800">
                    {payment.method === "CASH" ? <Banknote size={12} /> : <CreditCard size={12} />}
                  </span>
                  <div>
                    <span className="font-bold text-emerald-800">
                      {formatCurrency(Number(payment.totalAmount))}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2">
                      {payment.method === "CASH" ? M.cash : M.bankTransfer}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">{formatDateTime(payment.paidAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collect Payment Form for Staff */}
      {canCollect && Number(detail.data.remainingAmount) > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-700" />
              <span>Ghi nhận khoản thanh toán từ khách</span>
            </h4>
            <span className="text-xs text-slate-600">
              {M.remaining}:{" "}
              <strong className="text-rose-600 font-bold">
                {formatCurrency(Number(detail.data.remainingAmount))}
              </strong>
            </span>
          </div>

          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={form.handleSubmit((input) => collect.mutate(input))}
          >
            <label className="block text-xs font-semibold text-slate-700">
              <span className="block mb-1">{M.amount}</span>
              <input
                type="number"
                required
                min={1}
                max={Number(detail.data.remainingAmount)}
                step={1}
                className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary font-normal"
                disabled={collect.isPending}
                {...form.register("amount", { valueAsNumber: true })}
              />
            </label>

            <div className="block text-xs font-semibold text-slate-700">
              <span className="block mb-1">{M.method}</span>
              <Select
                value={form.watch("method")}
                onValueChange={(val) => {
                  form.setValue("method", val as "CASH" | "BANK_TRANSFER", {
                    shouldValidate: true,
                  });
                  form.resetField("reference");
                }}
                disabled={collect.isPending}
              >
                <SelectTrigger
                  id="debt-method-select"
                  aria-label={M.method}
                  className="h-8.5 min-h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 font-normal"
                >
                  <SelectValue placeholder={M.method} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{M.cash}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{M.bankTransfer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.watch("method") === "BANK_TRANSFER" && (
              <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
                <span className="block mb-1">{M.reference}</span>
                <input
                  required
                  placeholder="Nhập mã biên lai / tham chiếu giao dịch ngân hàng"
                  className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary font-normal"
                  maxLength={128}
                  disabled={collect.isPending}
                  {...form.register("reference", {
                    setValueAs: (value) => value?.trim() || undefined,
                  })}
                />
              </label>
            )}

            {Object.values(form.formState.errors).map((error) => (
              <p
                role="alert"
                className="text-xs font-semibold text-rose-600 sm:col-span-2"
                key={error.message}
              >
                {error.message}
              </p>
            ))}

            <div className="sm:col-span-2 flex justify-end pt-1">
              <Button
                type="submit"
                disabled={collect.isPending}
                loading={collect.isPending}
                className="min-h-0 h-8.5 px-4 text-xs font-bold"
              >
                {M.collect}
              </Button>
            </div>
          </form>
        </div>
      )}

      {collect.isError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-2"
        >
          <p className="font-medium">{M.paymentError}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-0 h-7 px-3 text-xs"
            onClick={() => void detail.refetch()}
          >
            {M.view}
          </Button>
        </div>
      )}

      {collect.isSuccess && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800"
        >
          {M.confirmed}
        </p>
      )}
    </div>
  );
}
