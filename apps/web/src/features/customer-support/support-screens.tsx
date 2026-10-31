"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportCreateInput,
  SupportCreateInputSchema,
  type SupportTicketQuery,
} from "@metastorage/contracts";
import { formatReference, CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  FileText,
  Headphones,
  Mail,
  Plus,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { Card, PageHeader } from "@/components/ui/display";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { SUPPORT_MESSAGES as SM } from "./support.messages";
import {
  useSupportContexts,
  useSupportPaymentContexts,
  useSupportTicket,
  useSupportTickets,
} from "./support-hooks";

export function CustomerSupportList() {
  const router = useRouter();
  const [status, setStatus] = useState<SupportTicketQuery["status"]>();
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const query = useSupportTickets({ status });
  const allTickets = query.data?.pages.flatMap((p) => p.items) ?? [];

  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      if (category && t.category !== category) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        formatReference(t.id, "YC").toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    });
  }, [allTickets, category, search]);

  const total = filteredTickets.length;
  const pagedTickets = filteredTickets.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus((val || undefined) as SupportTicketQuery["status"]);
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus(undefined);
    setCategory("");
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* 1. Header (Compact) */}
      <header className="shrink-0 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="mb-0.5 mt-0 text-xs font-semibold text-primary">{SM.eyebrow}</p>
          <h1 className="m-0 font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight">
            {SM.title}
          </h1>
          <p className="mb-0 mt-0.5 text-xs text-slate-600">{SM.description}</p>
        </div>

        <ShadcnButton
          className="shrink-0 bg-primary hover:bg-primary-dark text-xs h-9 font-semibold"
          onClick={() => router.push(customerRoutes.supportNew)}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {SM.newTicketAction}
        </ShadcnButton>
      </header>

      {/* 2. Compact Single-row Toolbar */}
      <section
        aria-label={SM.searchConfirm}
        className="shrink-0 flex flex-wrap items-center gap-2 rounded-card border border-line bg-white p-2 shadow-card min-h-12 relative z-20"
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
              placeholder={SM.searchPlaceholder}
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
            {SM.searchConfirm}
          </Button>
        </form>

        <DropdownSelect
          value={category}
          onChange={handleCategoryChange}
          placement="bottom"
          className="w-44 shrink-0"
          triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
          placeholder={SM.categoryFilter}
          options={[
            { value: "", label: SM.allCategories },
            ...SUPPORT_CATEGORIES.map((c) => ({
              value: c,
              label: SM.categories[c] ?? c,
            })),
          ]}
          maxVisibleItems={6}
        />

        <DropdownSelect
          value={status ?? ""}
          onChange={handleStatusChange}
          placement="bottom"
          className="w-40 shrink-0"
          triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
          placeholder={SM.statusFilter}
          options={[
            { value: "", label: SM.allStatuses },
            ...SUPPORT_STATUSES.map((s) => ({
              value: s,
              label: SM.statuses[s] ?? s,
            })),
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
            {SM.resetFilters}
          </Button>
        </div>
      </section>

      {/* 3. Table Content & Pagination */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
        {query.isPending ? (
          <LoadingState variant="table" />
        ) : query.isError ? (
          <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />
        ) : total === 0 ? (
          <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
            <Headphones className="mx-auto size-10 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-800">{SM.emptyTitle}</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">{SM.emptyDesc}</p>
            <ShadcnButton
              className="mt-4 bg-primary hover:bg-primary-dark text-xs h-9 font-semibold"
              onClick={() => router.push(customerRoutes.supportNew)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {SM.newTicketAction}
            </ShadcnButton>
          </section>
        ) : (
          <>
            <CustomerTable title={SM.tableTitle} headings={SM.tableHeadings}>
              {pagedTickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatReference(t.id, "YC")}
                    </span>
                  </td>
                  <td>
                    <strong className="text-slate-900 block truncate max-w-sm">{t.subject}</strong>
                  </td>
                  <td>
                    <span className="text-xs font-semibold text-slate-700">
                      {SM.categories[t.category] ?? t.category}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-slate-600">{formatDateTime(t.createdAt)}</span>
                  </td>
                  <td>
                    <Badge
                      className={
                        SM.statusClasses[t.status] ?? "border-slate-200 bg-slate-100 text-slate-700"
                      }
                    >
                      {SM.statuses[t.status] ?? t.status}
                    </Badge>
                  </td>
                  <td>
                    <Link
                      href={customerRoutes.supportTicket(t.id)}
                      scroll={false}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-soft rounded transition-colors"
                    >
                      <span>{SM.detailsAction}</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </CustomerTable>

            <div className="shrink-0 [&>nav]:shadow-2xs">
              <ListPagination
                label={SM.title}
                page={page}
                pageSize={pageSize}
                total={total}
                unitLabel={SM.unitLabel}
                onPageChange={(nextPage) => setPage(nextPage)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CustomerSupportCreate() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const urlCategory = params.get("category");
  const initialCategory =
    urlCategory && (SUPPORT_CATEGORIES as readonly string[]).includes(urlCategory)
      ? (urlCategory as SupportCreateInput["category"])
      : "PAYMENT";
  const urlBookingId = params.get("reservationId") ?? "";
  const urlSubject = params.get("subject") ?? "";

  const form = useForm<SupportCreateInput>({
    resolver: zodResolver(SupportCreateInputSchema),
    defaultValues: {
      reservationId: urlBookingId,
      paymentId: params.get("paymentId") ?? undefined,
      category: initialCategory,
      subject: urlSubject,
      content: "",
      idempotencyKey: crypto.randomUUID(),
    },
  });
  const category = form.watch("category");
  const reservationId = form.watch("reservationId");
  const contexts = useSupportContexts(category);
  const payments = useSupportPaymentContexts(reservationId ?? "", category === "PAYMENT");
  const create = useMutation({
    mutationFn: api.support.create,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["support-tickets"] });
      // Open the canonical route so the popup is backed by the list, not the submitted form.
      window.location.replace(customerRoutes.supportTicket(result.ticket.id));
    },
  });
  const previous = useRef("");
  const submit = form.handleSubmit((input) => {
    const signature = JSON.stringify({ ...input, idempotencyKey: undefined });
    if (previous.current && previous.current !== signature)
      input.idempotencyKey = crypto.randomUUID();
    previous.current = signature;
    form.setValue("idempotencyKey", input.idempotencyKey);
    create.mutate(input);
  });
  const bookingItems = contexts.data?.pages.flatMap((p) => p.items) ?? [];
  const paymentItems = payments.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <PageHeader
        title={M.newTicket}
        action={
          <Link
            href={customerRoutes.support}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={15} />
            <span>Quay lại</span>
          </Link>
        }
      />
      <Card className="w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={submit} className="grid gap-5">
          {/* Category Dropdown */}
          <div className="grid gap-1.5">
            <label
              htmlFor="support-category"
              className="text-xs sm:text-sm font-bold text-slate-700"
            >
              {M.category} <span className="text-rose-500">*</span>
            </label>
            <Select
              value={category}
              onValueChange={(val) => {
                form.setValue("category", val as typeof category);
                form.setValue("reservationId", "");
                form.setValue("paymentId", undefined);
              }}
            >
              <SelectTrigger
                id="support-category"
                className="h-11 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-800"
              >
                <SelectValue placeholder={M.category} />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {M.categories[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category && (
              <p role="alert" className="text-xs text-rose-600 font-medium">
                {form.formState.errors.category.message}
              </p>
            )}
          </div>

          {/* Booking Context Dropdown */}
          <div className="grid gap-1.5">
            <label
              htmlFor="support-booking"
              className="text-xs sm:text-sm font-bold text-slate-700"
            >
              {M.booking} <span className="text-rose-500">*</span>
            </label>
            <Select
              value={reservationId || "none"}
              onValueChange={(val) => {
                form.setValue("reservationId", val === "none" ? "" : val);
                form.setValue("paymentId", undefined);
              }}
            >
              <SelectTrigger
                id="support-booking"
                className="h-11 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-800"
              >
                <SelectValue placeholder={M.choose} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- {M.choose} --</SelectItem>
                {bookingItems.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {formatReference(b.bookingCode ?? b.id, "BK")} · {b.facility.name} · {b.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contexts.isPending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Spinner size="sm" variant="brand" />
                <span>{M.loading}</span>
              </div>
            )}
            {contexts.isError && (
              <ErrorState
                message={customerApiError(contexts.error)}
                onRetry={() => contexts.refetch()}
              />
            )}
            {contexts.hasNextPage && (
              <Button
                type="button"
                variant="outline"
                className="justify-self-start text-xs h-8"
                disabled={contexts.isFetchingNextPage}
                onClick={() => contexts.fetchNextPage()}
              >
                {M.more}
              </Button>
            )}
            {form.formState.errors.reservationId && (
              <p role="alert" className="text-xs text-rose-600 font-medium">
                {form.formState.errors.reservationId.message}
              </p>
            )}
          </div>

          {/* Optional Payment Context Dropdown */}
          {category === "PAYMENT" && (
            <div className="grid gap-1.5">
              <label
                htmlFor="support-payment"
                className="text-xs sm:text-sm font-bold text-slate-700"
              >
                {M.optionalPayment}
              </label>
              <Select
                value={form.watch("paymentId") || "none"}
                onValueChange={(val) => {
                  form.setValue("paymentId", val === "none" ? undefined : val);
                }}
              >
                <SelectTrigger
                  id="support-payment"
                  className="h-11 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-800"
                >
                  <SelectValue placeholder={M.choose} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- {M.choose} --</SelectItem>
                  {paymentItems.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.paymentCode} · {p.status} · {p.amount} {p.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {payments.isError && (
                <ErrorState
                  message={customerApiError(payments.error)}
                  onRetry={() => payments.refetch()}
                />
              )}
              {payments.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  className="justify-self-start text-xs h-8"
                  disabled={payments.isFetchingNextPage}
                  onClick={() => payments.fetchNextPage()}
                >
                  {M.more}
                </Button>
              )}
            </div>
          )}

          {/* Subject Input */}
          <div className="grid gap-1.5">
            <label
              htmlFor="support-subject"
              className="text-xs sm:text-sm font-bold text-slate-700"
            >
              {M.subject} <span className="text-rose-500">*</span>
            </label>
            <input
              id="support-subject"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 transition focus:border-[#165f4d] focus:outline-none focus:ring-2 focus:ring-[#165f4d]/20 placeholder:text-slate-400"
              placeholder="Nhập tiêu đề yêu cầu hỗ trợ..."
              {...form.register("subject")}
              maxLength={200}
            />
            {form.formState.errors.subject && (
              <p role="alert" className="text-xs text-rose-600 font-medium">
                {form.formState.errors.subject.message}
              </p>
            )}
          </div>

          {/* Content Textarea */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="support-content"
                className="text-xs sm:text-sm font-bold text-slate-700"
              >
                {M.content} <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400">
                {form.watch("content")?.length || 0} / 5000 ký tự
              </span>
            </div>
            <textarea
              id="support-content"
              className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 transition focus:border-[#165f4d] focus:outline-none focus:ring-2 focus:ring-[#165f4d]/20 placeholder:text-slate-400"
              placeholder="Mô tả chi tiết nội dung cần hỗ trợ..."
              {...form.register("content")}
              rows={5}
              maxLength={5000}
            />
            {form.formState.errors.content && (
              <p role="alert" className="text-xs text-rose-600 font-medium">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>

          {create.isError && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
            >
              {customerApiError(create.error)}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => router.push(customerRoutes.support)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#165f4d] hover:bg-[#0f493b] px-6 text-sm font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending ? (
                <>
                  <Spinner size="sm" variant="button" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>{M.save}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function CustomerSupportDetail({
  ticketId,
  inDialog = false,
}: {
  ticketId: string;
  inDialog?: boolean;
}) {
  const detail = useSupportTicket(ticketId);
  if (detail.isPending) return <LoadingState variant="detail" />;
  if (detail.isError)
    return <ErrorState message={customerApiError(detail.error)} onRetry={() => detail.refetch()} />;
  const ticket = detail.data.ticket;
  return (
    <div className={inDialog ? "min-w-0 space-y-5" : "mx-auto w-full max-w-5xl space-y-6 pb-6"}>
      {!inDialog && (
        <Link
          href={customerRoutes.support}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} />
          {SM.backToList}
        </Link>
      )}
      <header className="space-y-4">
        {!inDialog && (
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            {SM.detailEyebrow}
          </p>
        )}
        <h2 className="break-words text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
          {ticket.subject}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline" className={SM.statusClasses[ticket.status]}>
            <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-current" />
            {SM.statuses[ticket.status]}
          </Badge>
          <span className="text-slate-600">{SM.categories[ticket.category]}</span>
        </div>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
              <FileText aria-hidden="true" size={18} />
            </span>
            <h2 className="text-base font-semibold text-slate-900">{SM.submittedContent}</h2>
          </div>
          <p className="whitespace-pre-wrap break-words px-5 py-6 text-sm leading-7 text-slate-700 sm:px-6 sm:text-base">
            {ticket.description?.trim() ? ticket.description : SM.emptyContent}
          </p>
          <dl className="space-y-4 border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
            <div>
              <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <CalendarDays aria-hidden="true" size={14} />
                {SM.submittedAt}
              </dt>
              <dd className="mt-1.5 text-sm text-slate-700">{formatDateTime(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">{SM.ticketReference}</dt>
              <dd className="mt-1.5 break-all font-mono text-xs leading-5 text-slate-600">
                {formatReference(ticket.id, "YC")}
              </dd>
            </div>
          </dl>
        </section>
        <aside className="min-w-0 space-y-5">
          <section
            role="status"
            className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5"
          >
            <span className="mb-4 grid size-10 place-items-center rounded-xl border border-emerald-100 bg-white text-primary">
              <Mail aria-hidden="true" size={20} />
            </span>
            <h2 className="font-semibold text-emerald-950">{SM.nextStep}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">{SM.followUpHint}</p>
          </section>
          {(ticket.reservationId || ticket.rentalId) && (
            <Card className="rounded-2xl p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">{SM.relatedRecords}</h2>
              <div className="space-y-2">
                {ticket.reservationId && (
                  <Link
                    href={customerRoutes.reservation(ticket.reservationId)}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-primary hover:bg-emerald-50"
                  >
                    {SM.relatedBooking}
                    <ArrowUpRight aria-hidden="true" size={16} className="shrink-0" />
                  </Link>
                )}
                {ticket.rentalId && (
                  <Link
                    href={customerRoutes.rental(ticket.rentalId)}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-primary hover:bg-emerald-50"
                  >
                    {SM.relatedRental}
                    <ArrowUpRight aria-hidden="true" size={16} className="shrink-0" />
                  </Link>
                )}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
