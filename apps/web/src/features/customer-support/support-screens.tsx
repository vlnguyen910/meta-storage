"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportCreateInput,
  SupportCreateInputSchema,
  type SupportImageInput,
  type SupportReplyInput,
  SupportReplyInputSchema,
  type SupportTicketQuery,
} from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ChevronRight, Headphones, Plus, RotateCcw, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { PageHeader } from "@/components/ui/display";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { readFileBase64 } from "@/features/returns/integration-utils";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { SUPPORT_MESSAGES as SM } from "./support.messages";
import {
  useSupportContexts,
  useSupportPaymentContexts,
  useSupportTicket,
  useSupportTickets,
} from "./support-hooks";

const field = "min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3";

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
      return t.id.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
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
      <header className="shrink-0 flex items-center justify-between gap-4">
        <div>
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
                      {t.id}
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
  const form = useForm<SupportCreateInput>({
    resolver: zodResolver(SupportCreateInputSchema),
    defaultValues: {
      bookingId: params.get("bookingId") ?? "",
      paymentId: params.get("paymentId") ?? undefined,
      category: "PAYMENT",
      subject: "",
      content: "",
      idempotencyKey: crypto.randomUUID(),
    },
  });
  const category = form.watch("category");
  const bookingId = form.watch("bookingId");
  const contexts = useSupportContexts(category);
  const payments = useSupportPaymentContexts(bookingId, category === "PAYMENT");
  const create = useMutation({
    mutationFn: api.support.create,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["support-tickets"] });
      router.replace(customerRoutes.supportTicket(result.ticket.id));
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
  return (
    <>
      <PageHeader title={M.newTicket} />
      <form onSubmit={submit} className="grid max-w-2xl gap-4">
        <label>
          {M.category}
          <select
            className={field}
            {...form.register("category")}
            onChange={(e) => {
              form.setValue("category", e.target.value as typeof category);
              form.setValue("bookingId", "");
              form.setValue("paymentId", undefined);
            }}
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option value={c} key={c}>
                {M.categories[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {M.booking}
          <select
            className={field}
            aria-label={M.booking}
            {...form.register("bookingId")}
            onChange={(e) => {
              form.setValue("bookingId", e.target.value);
              form.setValue("paymentId", undefined);
            }}
          >
            <option value="">{M.choose}</option>
            {contexts.data?.pages
              .flatMap((p) => p.items)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingCode ?? b.id} · {b.facility.name} · {b.status}
                </option>
              ))}
          </select>
        </label>
        {contexts.isPending && <p role="status">{M.loading}</p>}
        {contexts.isError && (
          <ErrorState
            message={customerApiError(contexts.error)}
            onRetry={() => contexts.refetch()}
          />
        )}
        {contexts.hasNextPage && (
          <Button
            type="button"
            disabled={contexts.isFetchingNextPage}
            onClick={() => contexts.fetchNextPage()}
          >
            {M.more}
          </Button>
        )}
        {category === "PAYMENT" && (
          <label>
            {M.optionalPayment}
            <select
              className={field}
              aria-label={M.optionalPayment}
              {...form.register("paymentId", { setValueAs: (v) => v || undefined })}
            >
              <option value="">{M.choose}</option>
              {payments.data?.pages
                .flatMap((p) => p.items)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.paymentCode} · {p.status} · {p.amount} {p.currency}
                  </option>
                ))}
            </select>
          </label>
        )}
        {payments.isError && (
          <ErrorState
            message={customerApiError(payments.error)}
            onRetry={() => payments.refetch()}
          />
        )}
        {payments.hasNextPage && (
          <Button
            type="button"
            disabled={payments.isFetchingNextPage}
            onClick={() => payments.fetchNextPage()}
          >
            {M.more}
          </Button>
        )}
        <label>
          {M.subject}
          <input className={field} {...form.register("subject")} maxLength={200} />
        </label>
        <label>
          {M.content}
          <textarea className={field} {...form.register("content")} rows={6} maxLength={5000} />
        </label>
        {Object.entries(form.formState.errors).map(([name, error]) => (
          <p role="alert" key={name}>
            {error.message}
          </p>
        ))}
        {create.isError && <p role="alert">{customerApiError(create.error)}</p>}
        <Button disabled={create.isPending}>{M.save}</Button>
      </form>
    </>
  );
}

function PrivateSupportImage({
  ticketId,
  imageId,
  filename,
}: {
  ticketId: string;
  imageId: string;
  filename: string;
}) {
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["support-image", identity, ticketId, imageId],
    queryFn: ({ signal }) => api.support.image(ticketId, imageId, signal),
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!query.data) return;
    const next = URL.createObjectURL(new Blob([query.data]));
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(undefined);
    };
  }, [query.data]);
  return query.isError ? (
    <ErrorState message={M.error} onRetry={() => query.refetch()} />
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <Image
        unoptimized
        className="max-h-48 max-w-full object-contain"
        src={url}
        alt={filename}
        width={240}
        height={180}
      />
    </a>
  ) : (
    <p>{M.loading}</p>
  );
}

export function CustomerSupportDetail({ ticketId }: { ticketId: string }) {
  const detail = useSupportTicket(ticketId);
  const identity = useFlow3Identity();
  const client = useQueryClient();
  const replyForm = useForm<SupportReplyInput>({
    resolver: zodResolver(SupportReplyInputSchema),
    defaultValues: { content: "", version: 0, idempotencyKey: crypto.randomUUID() },
  });
  const content = replyForm.watch("content");
  const setContent = (value: string) => replyForm.setValue("content", value);
  const [file, setFile] = useState<File>();
  const [notice, setNotice] = useState("");
  const replyCommand = useRef<SupportReplyInput | undefined>(undefined);
  const uploadCommand = useRef<{ messageId: string; input: SupportImageInput } | undefined>(
    undefined,
  );
  const messages = useInfiniteQuery({
    queryKey: ["support-messages", identity, ticketId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.messages(ticketId, { limit: 20, cursor: pageParam }, signal),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const refresh = async () => {
    await Promise.all([
      detail.refetch(),
      client.invalidateQueries({ queryKey: ["support-messages"] }),
      client.invalidateQueries({ queryKey: ["support-tickets"] }),
    ]);
  };
  const handleError = async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      replyCommand.current = undefined;
      uploadCommand.current = undefined;
      await refresh();
      setNotice(M.conflict);
    } else setNotice(customerApiError(error));
  };
  const reply = useMutation({
    mutationFn: async () => {
      if (!replyCommand.current || replyCommand.current.content !== content.trim()) {
        if (!detail.data) throw new Error();
        replyCommand.current = {
          content: content.trim(),
          version: detail.data.ticket.version,
          idempotencyKey: crypto.randomUUID(),
        };
      }
      const result = await api.support.reply(ticketId, replyCommand.current);
      replyCommand.current = undefined;
      setContent("");
      return result;
    },
    onSuccess: refresh,
    onError: handleError,
  });
  const upload = useMutation({
    mutationFn: async (messageId: string) => {
      if (!file) return;
      if (!uploadCommand.current) {
        if (!detail.data) throw new Error();
        uploadCommand.current = {
          messageId,
          input: {
            filename: file.name,
            mimeType: file.type as SupportImageInput["mimeType"],
            dataBase64: await readFileBase64(file),
            version: detail.data.ticket.version,
            idempotencyKey: crypto.randomUUID(),
          },
        };
      }
      await api.support.uploadImage(
        ticketId,
        uploadCommand.current.messageId,
        uploadCommand.current.input,
      );
      uploadCommand.current = undefined;
      setFile(undefined);
    },
    onSuccess: refresh,
    onError: handleError,
  });
  if (detail.isPending) return <LoadingState />;
  if (detail.isError)
    return <ErrorState message={customerApiError(detail.error)} onRetry={() => detail.refetch()} />;
  const closed = detail.data.ticket.status === "CLOSED";
  const busy = reply.isPending || upload.isPending;
  return (
    <>
      <PageHeader
        title={detail.data.ticket.subject}
        description={`${M.categories[detail.data.ticket.category]} · ${detail.data.ticket.status}`}
      />
      {notice && <p role="alert">{notice}</p>}
      <p>{M.imageHelp}</p>
      {!closed && (
        <label>
          {M.chooseImage}
          <input
            className={field}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (
                selected &&
                (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) ||
                  selected.size > 5 * 1024 * 1024)
              ) {
                setNotice(M.imageError);
                setFile(undefined);
                uploadCommand.current = undefined;
                e.target.value = "";
                return;
              }
              setFile(selected);
              uploadCommand.current = undefined;
            }}
          />
        </label>
      )}
      <div className="my-5 grid gap-4">
        {messages.isPending ? (
          <LoadingState />
        ) : messages.isError ? (
          <ErrorState
            message={customerApiError(messages.error)}
            onRetry={() => messages.refetch()}
          />
        ) : (
          messages.data.pages
            .flatMap((p) => p.items)
            .map((message) => (
              <article className="rounded-xl border bg-white p-5" key={message.id}>
                <strong>{message.authorName}</strong>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <time>{new Date(message.createdAt).toLocaleString("vi-VN")}</time>
                <div className="my-3 flex flex-wrap gap-3">
                  {message.attachments.map((a) => (
                    <PrivateSupportImage
                      key={a.id}
                      ticketId={ticketId}
                      imageId={a.id}
                      filename={a.filename}
                    />
                  ))}
                </div>
                {!closed && message.authorRole === "CUSTOMER" && (
                  <Button disabled={!file || busy} onClick={() => upload.mutate(message.id)}>
                    {M.image}
                  </Button>
                )}
              </article>
            ))
        )}
        {messages.hasNextPage && (
          <Button disabled={messages.isFetchingNextPage} onClick={() => messages.fetchNextPage()}>
            {M.more}
          </Button>
        )}
      </div>
      {closed ? (
        <p>{M.closed}</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice("");
            reply.mutate();
          }}
        >
          <label>
            {M.content}
            <textarea
              className={field}
              value={content}
              maxLength={5000}
              required
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <Button disabled={busy || !content.trim()}>{M.reply}</Button>
        </form>
      )}
    </>
  );
}
