"use client";

import { CUSTOMER_WORKSPACE as C } from "@metastorage/shared";
import { AlertCircle, ArrowRight, CreditCard, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { TRANSACTION_MESSAGES as M } from "./transactions.messages";
import { type TransactionView, useCustomerTransactions } from "./use-customer-transactions";

export function CustomerTransactionsScreen() {
  const [view, setView] = useState<TransactionView>("all");
  const [page, setPage] = useState(1);
  const query = useCustomerTransactions(view);
  const pageSize = 6;
  const safePage = Math.min(page, Math.max(1, Math.ceil(query.transactions.length / pageSize)));
  const visibleTransactions = query.transactions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={M.eyebrow} title={M.title} description={M.description} />
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {(["all", "current", "history"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => {
              setView(item);
              setPage(1);
            }}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${view === item ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-ink"}`}
          >
            {item === "all" ? M.all : item === "current" ? M.current : M.history}
          </button>
        ))}
      </div>
      <p className="m-0 text-sm leading-6 text-muted">{M.loadedHistory}</p>
      {query.loading ? <LoadingState variant="table" /> : null}
      {query.error && !query.transactions.length ? (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-red-800">
            <AlertCircle size={18} />
            {M.loadFailed}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.retry()}
            loading={query.refreshing}
          >
            <RotateCcw size={16} />
            {M.retry}
          </Button>
        </Card>
      ) : null}
      {!query.loading && !query.error && query.transactions.length === 0 ? (
        <Card className="grid min-h-48 place-items-center text-center text-slate-600">
          {M.noTransactions}
        </Card>
      ) : null}
      {query.transactions.length > 0 ? (
        <div className="grid gap-3">
          {visibleTransactions.map(({ rental, payment }) => (
            <Card
              key={`${rental.id}-${payment.id}`}
              className="space-y-4 border-slate-200/80 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
                    <CreditCard size={19} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold text-ink">
                      {rental.unitType.name} · {rental.facility.name}
                    </h2>
                    <p className="m-0 text-xs text-slate-600">
                      {M.paymentCode}: <span className="font-mono">{payment.paymentCode}</span>
                    </p>
                  </div>
                </div>
                <StatusBadge value={payment.status} />
              </div>
              <dl className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-600">{M.amount}</dt>
                  <dd className="font-bold text-primary">
                    {formatCurrency(Number(payment.totalAmount))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">
                    {payment.paidAt ? M.paidAt : M.createdAt}
                  </dt>
                  <dd className="text-sm font-semibold">
                    {formatDateTime(payment.paidAt ?? payment.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">{M.rental}</dt>
                  <dd className="text-sm font-semibold">{rental.bookingCode}</dd>
                </div>
              </dl>
              {payment.refundedAt && payment.refundAmount ? (
                <p className="m-0 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {M.refund}: <strong>{formatCurrency(Number(payment.refundAmount))}</strong> ·{" "}
                  {formatDateTime(payment.refundedAt)}
                </p>
              ) : null}
              {payment.source && <p>{C.source[payment.source]}</p>}
              <Link
                href={`${customerRoutes.supportNew}?bookingId=${rental.bookingId}&paymentId=${payment.id}`}
              >
                {C.newTicket}
              </Link>
              {payment.chargeRefunds?.map((refund) => (
                <p className="text-sm text-emerald-900" key={refund.id}>
                  {C.refund}: {formatCurrency(Number(refund.amount))} ? {refund.reference}
                </p>
              ))}
              {payment.returnRefunds.map((refund) => (
                <p
                  key={refund.id}
                  className="m-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                >
                  {M.returnRefund}: <strong>{formatCurrency(Number(refund.amount))}</strong> ·{" "}
                  {refund.reference}
                </p>
              ))}
              <Link
                href={customerRoutes.rental(rental.id)}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline"
              >
                {M.openRental}
                <ArrowRight size={15} />
              </Link>
            </Card>
          ))}
        </div>
      ) : null}
      {query.error && query.transactions.length ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p>{M.partialError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.retry()}
            loading={query.refreshing}
          >
            {M.retry}
          </Button>
        </div>
      ) : null}
      <ListPagination
        label={M.title}
        page={safePage}
        pageSize={pageSize}
        total={query.transactions.length}
        onPageChange={setPage}
      />
      {query.hasNext ? (
        <Button
          type="button"
          variant="outline"
          loading={query.fetchingMore}
          disabled={query.fetchingMore}
          onClick={() => void query.loadMore()}
          className="mx-auto flex"
        >
          {query.fetchingMore ? M.loadingMore : M.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
