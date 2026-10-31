"use client";
import { formatReference } from "@metastorage/shared";

import { ArrowRight, CreditCard, HelpCircle, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { TRANSACTION_MESSAGES as M } from "./transactions.messages";
import { type TransactionView, useCustomerTransactions } from "./use-customer-transactions";

export function CustomerTransactionsScreen() {
  const [view, setView] = useState<TransactionView>("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const query = useCustomerTransactions(view);

  const filteredTransactions = useMemo(() => {
    return query.transactions.filter(({ rental, payment }) => {
      if (statusFilter && payment.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        formatReference(payment.paymentCode, "TT").toLowerCase().includes(q) ||
        rental.bookingCode.toLowerCase().includes(q) ||
        formatReference(rental.bookingCode, "BK").toLowerCase().includes(q) ||
        rental.facility.name.toLowerCase().includes(q) ||
        rental.unitType.name.toLowerCase().includes(q)
      );
    });
  }, [query.transactions, search, statusFilter]);

  const total = filteredTransactions.length;
  const pagedTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleViewChange = (newView: string) => {
    setView(newView as TransactionView);
    setPage(1);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setView("all");
    setStatusFilter("");
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* 1. Header (Compact) */}
      <header className="shrink-0">
        <p className="mb-0.5 mt-0 text-xs font-semibold text-primary">{M.eyebrow}</p>
        <h1 className="m-0 font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight">
          {M.title}
        </h1>
        <p className="mb-0 mt-0.5 text-xs text-slate-600">{M.description}</p>
      </header>

      {/* 2. Compact Single-row Toolbar */}
      <section
        aria-label={M.searchConfirm}
        className="shrink-0 flex items-center gap-2 rounded-card border border-line bg-white p-2 shadow-card min-h-12 relative z-20"
      >
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-1.5 flex-1 min-w-44 max-w-xs shrink-0"
        >
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={searchInput}
              placeholder={M.searchPlaceholder}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2 text-xs text-ink placeholder:text-muted outline-none transition focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5 shrink-0"
            icon={<Search size={14} aria-hidden="true" />}
          >
            {M.searchConfirm}
          </Button>
        </form>

        <DropdownSelect
          value={view}
          onChange={handleViewChange}
          placement="bottom"
          className="w-40 shrink-0"
          triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
          placeholder={M.viewFilter}
          options={[
            { value: "all", label: M.all },
            { value: "current", label: M.current },
            { value: "history", label: M.history },
          ]}
          maxVisibleItems={6}
        />

        <DropdownSelect
          value={statusFilter}
          onChange={handleStatusChange}
          placement="bottom"
          className="w-40 shrink-0"
          triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
          placeholder={M.statusFilter}
          options={[
            { value: "", label: M.allStatuses },
            { value: "SUCCEEDED", label: M.paid },
            { value: "PENDING", label: M.pending },
            { value: "REFUND_PENDING", label: M.refundPending },
            { value: "REFUNDED", label: M.refunded },
            { value: "FAILED", label: M.failed },
          ]}
          maxVisibleItems={6}
        />

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Button
            variant="outline"
            className="h-9 min-h-9 px-2.5 text-xs font-semibold gap-1.5"
            icon={<RotateCcw size={14} aria-hidden="true" />}
            onClick={handleResetFilters}
          >
            {M.resetFilters}
          </Button>
        </div>
      </section>

      {/* 3. Table Content & Pagination */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
        {query.loading ? (
          <LoadingState variant="table" />
        ) : query.error && query.transactions.length === 0 ? (
          <ErrorState message={M.loadFailed} onRetry={() => void query.retry()} />
        ) : total === 0 ? (
          <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
            <CreditCard className="mx-auto size-10 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-800">{M.emptyTitle}</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">{M.emptyDesc}</p>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              className="mt-4 text-xs font-semibold"
            >
              {M.resetFilters}
            </Button>
          </section>
        ) : (
          <>
            <CustomerTable title={M.tableTitle} headings={M.tableHeadings}>
              {pagedTransactions.map(({ rental, payment }) => (
                <tr key={`${rental.id}-${payment.id}`}>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {payment.paymentCode
                          ? formatReference(payment.paymentCode, "TT")
                          : payment.type === "DEBT_COLLECTION"
                            ? M.debtCollection
                            : payment.type === "DEPOSIT_REFUND"
                              ? M.returnRefund
                              : formatReference(payment.id, "TT")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="font-semibold text-slate-900">{rental.unitType.name}</div>
                    <div className="text-xs text-slate-500">
                      {rental.facility.name}
                      {rental.storageUnit?.code ? ` · ${rental.storageUnit.code}` : ""}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-primary text-xs">
                        {formatCurrency(Number(payment.totalAmount))}
                      </span>
                      {payment.refundedAt && payment.refundAmount ? (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded w-fit border border-amber-200">
                          {M.refundBadge(formatCurrency(Number(payment.refundAmount)))}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className="text-xs text-slate-700">
                      {formatDateTime(payment.paidAt ?? payment.createdAt)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                        payment.status === "SUCCEEDED"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : payment.status === "REFUNDED"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : payment.status === "PENDING" || payment.status === "REFUND_PENDING"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {payment.status === "SUCCEEDED"
                        ? M.paid
                        : payment.status === "REFUNDED"
                          ? M.refunded
                          : payment.status === "PENDING" || payment.status === "REFUND_PENDING"
                            ? payment.status === "REFUND_PENDING"
                              ? M.refundPending
                              : M.pending
                            : M.failed}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={customerRoutes.rental(rental.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <span>{M.openRental}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                      <span className="text-slate-300">|</span>
                      <Link
                        href={`${customerRoutes.supportNew}?bookingId=${rental.bookingId}&paymentId=${payment.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-primary transition-colors"
                      >
                        <HelpCircle className="size-3" />
                        <span>{M.supportAction}</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </CustomerTable>

            <div className="shrink-0 [&>nav]:shadow-2xs">
              <ListPagination
                label={M.title}
                page={page}
                pageSize={pageSize}
                total={total}
                unitLabel={M.unitLabel}
                onPageChange={(nextPage) => setPage(nextPage)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
