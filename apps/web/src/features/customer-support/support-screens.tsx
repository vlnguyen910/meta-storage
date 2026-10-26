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
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { readFileBase64 } from "@/features/returns/integration-utils";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import {
  useSupportContexts,
  useSupportPaymentContexts,
  useSupportTicket,
  useSupportTickets,
} from "./support-hooks";

const field = "min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3";

export function CustomerSupportList() {
  const [status, setStatus] = useState<SupportTicketQuery["status"]>();
  const query = useSupportTickets({ status });
  return (
    <>
      <PageHeader
        title={M.support}
        action={<Link href={customerRoutes.supportNew}>{M.newTicket}</Link>}
      />
      <label>
        {M.history}
        <select
          className={field}
          value={status ?? ""}
          onChange={(e) => setStatus((e.target.value || undefined) as typeof status)}
        >
          <option value="">{M.choose}</option>
          {SUPPORT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <div className="my-5 grid gap-3">
          {!query.data.pages[0]?.items.length && <p>{M.empty}</p>}
          {query.data.pages
            .flatMap((p) => p.items)
            .map((t) => (
              <Link
                className="rounded-xl border bg-white p-5"
                key={t.id}
                href={customerRoutes.supportTicket(t.id)}
              >
                <strong>{t.subject}</strong>
                <p>
                  {M.categories[t.category]} · {t.status}
                </p>
              </Link>
            ))}
          {query.hasNextPage && (
            <Button disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              {M.more}
            </Button>
          )}
          {query.isFetchNextPageError && <p role="alert">{M.error}</p>}
        </div>
      )}
    </>
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
      if (!replyCommand.current || replyCommand.current.content !== content.trim())
        replyCommand.current = {
          content: content.trim(),
          version: detail.data!.ticket.version,
          idempotencyKey: crypto.randomUUID(),
        };
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
      if (!uploadCommand.current)
        uploadCommand.current = {
          messageId,
          input: {
            filename: file.name,
            mimeType: file.type as SupportImageInput["mimeType"],
            dataBase64: await readFileBase64(file),
            version: detail.data!.ticket.version,
            idempotencyKey: crypto.randomUUID(),
          },
        };
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
