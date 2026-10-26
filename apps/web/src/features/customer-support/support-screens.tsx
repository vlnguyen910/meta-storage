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
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  LifeBuoy,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Tag,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { readFileBase64 } from "@/features/returns/integration-utils";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SUPPORT_UI_MESSAGES as M } from "./support.messages";
import type {
  CustomerSupportDetailProps,
  PrivateSupportImageProps,
  SupportCategory,
  SupportStatus,
} from "./support.types";
import {
  useSupportContexts,
  useSupportPaymentContexts,
  useSupportTicket,
  useSupportTickets,
} from "./support-hooks";

function getStatusBadgeConfig(status: SupportStatus) {
  switch (status) {
    case "OPEN":
      return {
        label: M.statusLabels.OPEN,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200/90 hover:bg-emerald-100/60",
      };
    case "IN_PROGRESS":
      return {
        label: M.statusLabels.IN_PROGRESS,
        className: "bg-amber-50 text-amber-700 border-amber-200/90 hover:bg-amber-100/60",
      };
    default:
      return {
        label: M.statusLabels.CLOSED,
        className: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/60",
      };
  }
}

function getCategoryBadgeConfig(category: SupportCategory) {
  const label = M.categories[category as keyof typeof M.categories] || category;
  switch (category) {
    case "PAYMENT":
      return { label, className: "bg-purple-50 text-purple-700 border-purple-200/80" };
    case "UNIT":
      return { label, className: "bg-rose-50 text-rose-700 border-rose-200/80" };
    case "LOCK":
      return { label, className: "bg-amber-50 text-amber-700 border-amber-200/80" };
    case "ACCESS_CODE":
      return { label, className: "bg-teal-50 text-teal-700 border-teal-200/80" };
    case "STORED_ITEMS":
      return { label, className: "bg-blue-50 text-blue-700 border-blue-200/80" };
    default:
      return { label, className: "bg-slate-50 text-slate-700 border-slate-200" };
  }
}

const PAGE_SIZE = 8;

/* =========================================================================
   MÀN HÌNH 1: DANH SÁCH YÊU CẦU HỖ TRỢ (/customer/support/)
   ========================================================================= */
export function CustomerSupportList() {
  const [status, setStatus] = useState<SupportTicketQuery["status"]>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useSupportTickets({ status });

  const allTickets = useMemo(() => {
    return query.data?.pages.flatMap((p) => p.items) ?? [];
  }, [query.data]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTickets;
    return allTickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (M.categories[t.category as keyof typeof M.categories] &&
          M.categories[t.category as keyof typeof M.categories].toLowerCase().includes(q)),
    );
  }, [allTickets, search]);

  const totalItems = filteredTickets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pagedTickets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTickets.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, currentPage]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden gap-4">
      {/* 1. Header cố định */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{M.support}</h1>
            <p className="text-xs text-slate-500">
              Quản lý và theo dõi các yêu cầu hỗ trợ kỹ thuật và dịch vụ
            </p>
          </div>
        </div>

        <Link
          href={customerRoutes.supportNew}
          className={buttonClassName(
            "primary",
            "inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold shadow-sm",
          )}
        >
          <Plus className="size-4" />
          <span>{M.newTicket}</span>
        </Link>
      </div>

      {/* 2. Filter/Tìm kiếm trên 1 hàng gọn gàng */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs shrink-0">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={M.searchPlaceholder}
            className="pl-9 h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="w-full sm:w-56 shrink-0">
          <Select
            value={status ?? ""}
            onChange={(e) => {
              setStatus((e.target.value || undefined) as typeof status);
              setPage(1);
            }}
            className="h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
          >
            <option value="">{M.allStatuses}</option>
            {SUPPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {M.statusLabels[s] || s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* 3. Nội dung chính có cuộn (flex-1 overflow-y-auto) */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-2.5">
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />
        ) : filteredTickets.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 border-slate-200 bg-white/70">
            <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
              <Inbox className="size-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {search || status ? M.emptySearch : M.emptyTickets}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md">
              {search || status
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn trạng thái đang lọc."
                : M.emptyTicketsDesc}
            </p>
            {!search && !status && (
              <Link
                href={customerRoutes.supportNew}
                className={buttonClassName("primary", "mt-5 text-sm gap-2")}
              >
                <Plus className="size-4" />
                <span>{M.newTicket}</span>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid gap-2.5">
            {pagedTickets.map((ticket) => {
              const statusCfg = getStatusBadgeConfig(ticket.status);
              const catCfg = getCategoryBadgeConfig(ticket.category);
              return (
                <Link
                  key={ticket.id}
                  href={customerRoutes.supportTicket(ticket.id)}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/90 bg-white hover:border-primary/50 hover:shadow-md transition-all duration-150 cursor-pointer"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        #{ticket.id.slice(0, 8)}
                      </span>
                      <Badge className={catCfg.className}>{catCfg.label}</Badge>
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">
                      {ticket.subject}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="size-3.5 text-slate-400" />
                      <time dateTime={ticket.createdAt}>
                        {new Date(ticket.createdAt).toLocaleString("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-slate-50 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-slate-400">
                      <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Footer Pagination ghim cố định ở đáy */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs shrink-0 text-sm">
        <span className="text-xs sm:text-sm text-slate-600 font-medium">
          {totalItems > 0
            ? `Hiển thị ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                currentPage * PAGE_SIZE,
                totalItems,
              )} trong số ${totalItems} yêu cầu`
            : "0 yêu cầu"}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 min-h-8 px-2.5 text-xs gap-1 border-slate-200"
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Trước</span>
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={cn(
                    "size-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center",
                    num === currentPage
                      ? "bg-primary text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {num}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => {
                if (currentPage >= totalPages && query.hasNextPage) {
                  query.fetchNextPage();
                }
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              className="h-8 min-h-8 px-2.5 text-xs gap-1 border-slate-200"
            >
              <span className="hidden sm:inline">Sau</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MÀN HÌNH 2: TẠO YÊU CẦU HỖ TRỢ MỚI (/customer/support/new)
   ========================================================================= */
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
  const content = form.watch("content");
  const subject = form.watch("subject");

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
    if (previous.current && previous.current !== signature) {
      input.idempotencyKey = crypto.randomUUID();
    }
    previous.current = signature;
    form.setValue("idempotencyKey", input.idempotencyKey);
    create.mutate(input);
  });

  const categoryId = useId();
  const bookingFieldId = useId();
  const paymentFieldId = useId();
  const subjectId = useId();
  const contentId = useId();

  return (
    <div className="flex flex-col h-full w-full items-center justify-center overflow-y-auto p-2 sm:p-4">
      <div className="w-full max-w-3xl mb-2 flex items-center justify-between">
        <Link
          href={customerRoutes.support}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>{M.backToList}</span>
        </Link>
      </div>

      <Card className="w-full max-w-3xl border border-slate-200/90 bg-white shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <Plus className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">{M.newTicket}</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 mt-1">
                {M.createSubtitle}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={submit}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Cột 1 (Hàng 1): Select Nhóm yêu cầu */}
              <div className="grid gap-1.5">
                <label
                  htmlFor={categoryId}
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  {M.category} <span className="text-danger">*</span>
                </label>
                <Select
                  id={categoryId}
                  className="h-11 min-h-11 text-sm bg-white border-slate-200"
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
                </Select>
                {form.formState.errors.category?.message && (
                  <span className="text-xs text-danger font-medium">
                    {form.formState.errors.category.message}
                  </span>
                )}
              </div>

              {/* Cột 2 (Hàng 1): Select Booking */}
              <div className="grid gap-1.5">
                <label
                  htmlFor={bookingFieldId}
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  {M.booking} <span className="text-danger">*</span>
                </label>
                <Select
                  id={bookingFieldId}
                  aria-label={M.booking}
                  className="h-11 min-h-11 text-sm bg-white border-slate-200"
                  {...form.register("bookingId")}
                  onChange={(e) => {
                    form.setValue("bookingId", e.target.value);
                    form.setValue("paymentId", undefined);
                  }}
                >
                  <option value="">{M.bookingSelectPlaceholder}</option>
                  {contexts.data?.pages
                    .flatMap((p) => p.items)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bookingCode ?? b.id} · {b.facility.name} ({b.status})
                      </option>
                    ))}
                </Select>
                {form.formState.errors.bookingId?.message && (
                  <span className="text-xs text-danger font-medium">
                    {form.formState.errors.bookingId.message}
                  </span>
                )}
              </div>

              {/* Hàng 2: Select Giao dịch (nếu là PAYMENT) & Tiêu đề */}
              {category === "PAYMENT" ? (
                <>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor={paymentFieldId}
                      className="text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      {M.optionalPayment}
                    </label>
                    <Select
                      id={paymentFieldId}
                      aria-label={M.optionalPayment}
                      className="h-11 min-h-11 text-sm bg-white border-slate-200"
                      {...form.register("paymentId", {
                        setValueAs: (v) => v || undefined,
                      })}
                    >
                      <option value="">{M.paymentSelectPlaceholder}</option>
                      {payments.data?.pages
                        .flatMap((p) => p.items)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.paymentCode} · {p.status} ({p.amount} {p.currency})
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <label
                      htmlFor={subjectId}
                      className="text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      {M.subject} <span className="text-danger">*</span>
                    </label>
                    <Input
                      id={subjectId}
                      className="h-11 min-h-11 text-sm bg-white border-slate-200"
                      placeholder={M.subjectPlaceholder}
                      {...form.register("subject")}
                      maxLength={200}
                    />
                    {form.formState.errors.subject?.message && (
                      <span className="text-xs text-danger font-medium">
                        {form.formState.errors.subject.message}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid gap-1.5 col-span-1 md:col-span-2">
                  <label
                    htmlFor={subjectId}
                    className="text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    {M.subject} <span className="text-danger">*</span>
                  </label>
                  <Input
                    id={subjectId}
                    className="h-11 min-h-11 text-sm bg-white border-slate-200"
                    placeholder={M.subjectPlaceholder}
                    {...form.register("subject")}
                    maxLength={200}
                  />
                  {form.formState.errors.subject?.message && (
                    <span className="text-xs text-danger font-medium">
                      {form.formState.errors.subject.message}
                    </span>
                  )}
                </div>
              )}

              {/* Hàng 3 (col-span-2): Textarea Nội dung (cao cố định 160px để không phá vỡ 100vh) */}
              <div className="grid gap-1.5 col-span-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={contentId}
                    className="text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    {M.content} <span className="text-danger">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {content?.length || 0}/5000 ký tự
                  </span>
                </div>
                <Textarea
                  id={contentId}
                  className="h-[160px] min-h-[160px] max-h-[160px] resize-none text-sm bg-white border-slate-200 leading-relaxed"
                  placeholder={M.contentPlaceholder}
                  {...form.register("content")}
                  maxLength={5000}
                />
                {form.formState.errors.content?.message && (
                  <span className="text-xs text-danger font-medium">
                    {form.formState.errors.content.message}
                  </span>
                )}
              </div>
            </div>

            {/* Error alerts */}
            {create.isError && (
              <div
                role="alert"
                className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-danger text-xs font-medium"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{customerApiError(create.error)}</span>
              </div>
            )}
          </CardContent>

          {/* Hành động: Nút gửi ở dưới cùng của Card (căn phải) có icon Send */}
          <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Link
              href={customerRoutes.support}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              {M.cancel}
            </Link>

            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending || !subject?.trim() || !content?.trim()}
              loading={create.isPending}
              className="gap-2 px-6 h-11"
            >
              <Send className="size-4" />
              <span>{M.save}</span>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

/* =========================================================================
   COMPONENTS CHO MÀN HÌNH 3: XỬ LÝ ẢNH RIÊNG TƯ
   ========================================================================= */
function PrivateSupportImage({ ticketId, imageId, filename }: PrivateSupportImageProps) {
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

  if (query.isError) {
    return (
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-50 text-danger text-xs">
        <AlertCircle className="size-3.5" />
        <span>Lỗi tải ảnh</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex size-20 items-center justify-center rounded-lg bg-slate-100 animate-pulse text-xs text-slate-400">
        Đang tải...
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block overflow-hidden rounded-xl border border-slate-200/90 bg-slate-100 hover:shadow-md transition-all"
    >
      <Image
        unoptimized
        className="h-28 w-36 object-cover transition duration-200 group-hover:scale-105"
        src={url}
        alt={filename}
        width={144}
        height={112}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <span className="text-[10px] text-white font-semibold bg-black/60 px-2 py-0.5 rounded-full">
          Xem ảnh
        </span>
      </div>
    </a>
  );
}

/* =========================================================================
   MÀN HÌNH 3: CHI TIẾT YÊU CẦU & CHAT (/customer/support/[id])
   Thiết kế Messenger / Zendesk - Không scroll toàn trang
   ========================================================================= */
export function CustomerSupportDetail({ ticketId }: CustomerSupportDetailProps) {
  const detail = useSupportTicket(ticketId);
  const identity = useFlow3Identity();
  const client = useQueryClient();

  const replyForm = useForm<SupportReplyInput>({
    resolver: zodResolver(SupportReplyInputSchema),
    defaultValues: {
      content: "",
      version: 0,
      idempotencyKey: crypto.randomUUID(),
    },
  });

  const content = replyForm.watch("content");
  const setContent = (value: string) => replyForm.setValue("content", value);

  const [file, setFile] = useState<File>();
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    } else {
      setNotice(customerApiError(error));
    }
  };

  const reply = useMutation({
    mutationFn: async () => {
      if (!replyCommand.current || replyCommand.current.content !== content.trim()) {
        replyCommand.current = {
          content: content.trim(),
          version: detail.data?.ticket.version ?? 0,
          idempotencyKey: crypto.randomUUID(),
        };
      }
      const result = await api.support.reply(ticketId, replyCommand.current);
      replyCommand.current = undefined;

      // Nếu có kèm file ảnh thì tải lên luôn vào tin nhắn vừa tạo
      if (file) {
        const fileData = await readFileBase64(file);
        await api.support.uploadImage(ticketId, result.message.id, {
          filename: file.name,
          mimeType: file.type as SupportImageInput["mimeType"],
          dataBase64: fileData,
          version: result.ticket.version,
          idempotencyKey: crypto.randomUUID(),
        });
        setFile(undefined);
      }

      setContent("");
      return result;
    },
    onSuccess: async () => {
      await refresh();
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 150);
    },
    onError: handleError,
  });

  const upload = useMutation({
    mutationFn: async (messageId: string) => {
      if (!file) return;
      if (!uploadCommand.current) {
        uploadCommand.current = {
          messageId,
          input: {
            filename: file.name,
            mimeType: file.type as SupportImageInput["mimeType"],
            dataBase64: await readFileBase64(file),
            version: detail.data?.ticket.version ?? 0,
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

  // Tự động cuộn xuống dưới cùng khi có tin nhắn mới
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when messages update
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.data]);

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) {
    return <ErrorState message={customerApiError(detail.error)} onRetry={() => detail.refetch()} />;
  }

  const ticket = detail.data.ticket;
  const closed = ticket.status === "CLOSED";
  const busy = reply.isPending || upload.isPending;
  const statusCfg = getStatusBadgeConfig(ticket.status);
  const catCfg = getCategoryBadgeConfig(ticket.category);

  // Đảo thứ tự tin nhắn để tin nhắn cũ ở trên, tin mới ở dưới
  const allMessagesList =
    messages.data?.pages
      .flatMap((p) => p.items)
      .slice()
      .reverse() ?? [];

  return (
    <div className="grid grid-cols-12 h-full gap-4 min-h-0 overflow-hidden">
      {/* =========================================================================
          CỘT TRÁI (Ticket Info - col-span-12 md:col-span-4): h-full, thông tin ticket
          ========================================================================= */}
      <Card className="col-span-12 md:col-span-4 h-full flex flex-col border border-slate-200/90 bg-white shadow-sm rounded-2xl overflow-hidden min-h-0">
        {/* Header cột trái */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <Link
            href={customerRoutes.support}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors mb-2.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>{M.backToList}</span>
          </Link>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              <span>{M.ticketInfoTitle}</span>
            </h2>
            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              #{ticket.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Body cột trái (Scrollable nếu màn hình nhỏ) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 text-sm">
          {/* Trạng thái & Danh mục */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Trạng thái & Phân loại
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
              <Badge className={catCfg.className}>{catCfg.label}</Badge>
            </div>
          </div>

          {/* Người tạo */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {M.creator}
            </span>
            <div className="flex items-center gap-3">
              <Avatar className="size-9 bg-primary/10 border border-primary/20">
                <AvatarFallback className="text-primary font-bold">
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <strong className="block text-sm text-slate-800">{M.customerRole}</strong>
                <small className="text-xs text-slate-500 font-mono">
                  Mã ID: {ticket.id.slice(0, 8)}
                </small>
              </div>
            </div>
          </div>

          {/* Thời gian */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Thời gian
            </span>
            <div className="grid gap-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {M.createdAtLabel}:
                </span>
                <span className="font-medium">
                  {new Date(ticket.createdAt).toLocaleString("vi-VN", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <RefreshCw className="size-3.5" /> {M.updatedAtLabel}:
                </span>
                <span className="font-medium">
                  {new Date(ticket.updatedAt).toLocaleString("vi-VN", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Tóm tắt nội dung yêu cầu gốc */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              {M.originalContent}
            </span>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
              <strong className="block font-semibold text-slate-900">{ticket.subject}</strong>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                {allMessagesList[0]?.content || "Yêu cầu đã được khởi tạo trong hệ thống."}
              </p>
            </div>
          </div>

          {/* Thông báo nếu ticket đã đóng */}
          {closed && (
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <ShieldAlert className="size-4 text-slate-500 shrink-0 mt-0.5" />
              <span>{M.closedNotice}</span>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          CỘT PHẢI (Chat / Thread - col-span-12 md:col-span-8): Messenger/Zendesk UI
          ========================================================================= */}
      <Card className="col-span-12 md:col-span-8 h-full flex flex-col border border-slate-200/90 bg-slate-50/60 shadow-sm rounded-2xl overflow-hidden min-h-0">
        {/* Header cột phải: Tiêu đề ticket */}
        <div className="p-3.5 px-5 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0 shadow-2xs">
          <div className="min-w-0 pr-3">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {ticket.subject}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              <span>{M.chatSubtitle}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={refresh}
            title={M.refreshMessages}
            className="size-9 min-h-9 p-0 border-slate-200 text-slate-600 hover:text-primary shrink-0"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {/* Thông báo xung đột dữ liệu hoặc lỗi nếu có */}
        {notice && (
          <div
            role="alert"
            className="p-2.5 px-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between shrink-0"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="text-amber-600 hover:text-amber-900 p-1"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Body cột phải (Khu vực tin nhắn - flex-1 overflow-y-auto p-4) */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {messages.isPending ? (
            <LoadingState />
          ) : messages.isError ? (
            <ErrorState
              message={customerApiError(messages.error)}
              onRetry={() => messages.refetch()}
            />
          ) : (
            <>
              {messages.hasNextPage && (
                <div className="flex justify-center mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={messages.isFetchingNextPage}
                    onClick={() => messages.fetchNextPage()}
                    className="text-xs h-8 min-h-8 px-3 border-slate-200 bg-white"
                  >
                    {messages.isFetchingNextPage ? "Đang tải..." : M.loadMoreMessages}
                  </Button>
                </div>
              )}

              {allMessagesList.map((message) => {
                const isCustomer = message.authorRole === "CUSTOMER";
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%]",
                      isCustomer ? "ml-auto flex-row-reverse" : "mr-auto",
                    )}
                  >
                    {/* Avatar */}
                    <Avatar className="size-8 shrink-0 border border-slate-200 bg-white">
                      <AvatarFallback
                        className={cn(
                          "text-[11px] font-bold",
                          isCustomer ? "bg-primary text-white" : "bg-slate-800 text-white",
                        )}
                      >
                        {message.authorName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Bong bóng tin nhắn */}
                    <div className="flex flex-col space-y-1">
                      {/* Tên & vai trò */}
                      <div
                        className={cn(
                          "text-[11px] font-semibold text-slate-500 px-1",
                          isCustomer && "text-right",
                        )}
                      >
                        <span>{message.authorName}</span>
                        {!isCustomer && (
                          <span className="ml-1.5 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded">
                            {message.authorRole === "ADMIN" ? M.adminRole : M.staffRole}
                          </span>
                        )}
                      </div>

                      {/* Content bubble */}
                      <div
                        className={cn(
                          "rounded-2xl p-3.5 text-sm shadow-xs transition-all",
                          isCustomer
                            ? "bg-primary text-white rounded-br-xs"
                            : "bg-white text-slate-900 border border-slate-200/90 rounded-bl-xs",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                          {message.content}
                        </p>

                        {/* Thumbnail ảnh đính kèm */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-wrap gap-2">
                            {message.attachments.map((att) => (
                              <PrivateSupportImage
                                key={att.id}
                                ticketId={ticketId}
                                imageId={att.id}
                                filename={att.filename}
                              />
                            ))}
                          </div>
                        )}

                        {/* Nút đính kèm thêm ảnh vào tin nhắn của khách nếu ticket chưa đóng */}
                        {!closed && isCustomer && file && (
                          <div className="mt-2 pt-2 border-t border-white/20">
                            <Button
                              type="button"
                              variant="secondary"
                              className="text-xs h-7 min-h-7 px-2.5 bg-white/20 hover:bg-white/30 text-white border-0"
                              disabled={busy}
                              onClick={() => upload.mutate(message.id)}
                            >
                              Gắn ảnh vào tin này
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Thời gian gửi */}
                      <span
                        className={cn(
                          "text-[10px] text-slate-400 px-1",
                          isCustomer ? "text-right" : "text-left",
                        )}
                      >
                        {new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer cột phải (Khu vực nhập liệu - p-4 border-t) */}
        <div className="p-3 sm:p-4 border-t border-slate-200/80 bg-white shrink-0">
          {closed ? (
            <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-center text-xs sm:text-sm font-medium">
              {M.closed}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!content.trim() && !file) return;
                setNotice("");
                reply.mutate();
              }}
              className="space-y-2.5"
            >
              {/* Preview ảnh đính kèm nếu user vừa chọn */}
              {file && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  <Paperclip className="size-4 text-primary shrink-0" />
                  <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(undefined);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ml-auto text-slate-400 hover:text-danger p-1"
                    title={M.removeAttachment}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Hàng chứa: nút đính kèm ảnh, Textarea (~60px), nút gửi phản hồi */}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
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
                      e.target.value = "";
                      return;
                    }
                    setFile(selected);
                  }}
                />

                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  title={M.attachImage}
                  className="size-11 min-h-11 p-0 border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50 shrink-0 rounded-xl"
                >
                  <Paperclip className="size-5" />
                </Button>

                <Textarea
                  value={content}
                  maxLength={5000}
                  placeholder={M.replyPlaceholder}
                  disabled={busy}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (content.trim() || file) {
                        setNotice("");
                        reply.mutate();
                      }
                    }
                  }}
                  className="h-[58px] min-h-[58px] max-h-[120px] resize-none text-sm p-3 border-slate-200 bg-slate-50/50 focus:bg-white leading-relaxed rounded-xl flex-1"
                />

                <Button
                  type="submit"
                  variant="primary"
                  disabled={busy || (!content.trim() && !file)}
                  loading={busy}
                  className="h-[58px] min-h-[58px] px-5 rounded-xl gap-2 shrink-0 shadow-sm"
                >
                  <Send className="size-4" />
                  <span className="hidden sm:inline">{M.send}</span>
                </Button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>{M.imageHelp}</span>
                <span>{content.length}/5000</span>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
