"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SupportOperation } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { managementError, useTaskStaff } from "@/features/facility-management/hooks";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import type {
  ManagerFacilityTabProps,
  ManagerImageProps,
  ManagerSupportFormValues,
  ManagerTicketFormProps,
  ManagerTicketProps,
} from "./manager-tabs.types";
import { useManagerKey, useManagerTicket, useManagerTicketAction } from "./use-manager-tabs";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm";
const schema = z
  .object({
    action: z.enum(["ASSIGN", "REPLY", "NOTE", "ACCEPT", "REOPEN", "PRIORITY"]),
    content: z.string().trim().min(3, M.reasonRequired).max(5000),
    staffId: z.string(),
    priority: z.enum(["NORMAL", "HIGH"]),
  })
  .superRefine((v, ctx) => {
    if (v.action === "ASSIGN" && !v.staffId)
      ctx.addIssue({ code: "custom", path: ["staffId"], message: M.staffRequired });
  });
export function ManagerSupportScreen() {
  return (
    <ManagerTabFrame title={M.support} description={M.supportHint}>
      {(facilityId) => <Support facilityId={facilityId} />}
    </ManagerTabFrame>
  );
}
function Support({ facilityId }: ManagerFacilityTabProps) {
  const key = useManagerKey(),
    selected = useSearchParams().get("ticketId");
  const [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [overdue, setOverdue] = useState(false);
  const query = useQuery({
    queryKey: [...key, "tickets", facilityId, status, search, offset, overdue],
    queryFn: ({ signal }) =>
      api.facilityWorkspace.tickets(
        {
          facilityId,
          status: (status || undefined) as "OPEN" | "IN_PROGRESS" | "CLOSED" | undefined,
          search: search || undefined,
          offset,
          limit: 20,
          overdue,
        },
        signal,
      ),
    enabled: !selected,
  });
  if (selected) return <TicketDetail facilityId={facilityId} id={selected} />;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <input
          maxLength={200}
          className={field}
          aria-label={M.search}
          placeholder={M.search}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <select
          className={field}
          aria-label={M.status}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">{M.all}</option>
          {["OPEN", "IN_PROGRESS", "CLOSED"].map((s) => (
            <option key={s} value={s}>
              {M.statuses[s]}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setOffset(0);
            }}
          />
          {M.overdue}
        </label>
      </div>
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />
      ) : !query.data.items.length ? (
        <EmptyState title={M.empty} description={M.emptyHint} />
      ) : (
        <>
          <ul className="grid list-none gap-4 p-0 lg:grid-cols-2">
            {query.data.items.map((ticket) => (
              <li
                key={ticket.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    {M.categories[ticket.category]}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${ticket.priority === "HIGH" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-700"}`}
                  >
                    {ticket.priority === "HIGH" ? M.high : M.normal}
                  </span>
                </div>
                <h2 className="text-lg font-bold">{ticket.subject}</h2>
                <p className="text-sm text-slate-600">
                  {ticket.customerName} · {ticket.bookingCode}
                </p>
                <p className="text-sm font-medium">
                  {M.statuses[ticket.status]} · {ticket.assignedStaffName ?? M.unassigned}
                </p>
                <p className="text-xs text-slate-600">
                  {M.dueAt}: {formatDateTime(ticket.actionDueAt)}
                </p>
                <Link
                  href={`?ticketId=${encodeURIComponent(ticket.id)}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white"
                >
                  {M.view}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              {M.page(offset / 20 + 1, query.data.total)}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!offset} onClick={() => setOffset(offset - 20)}>
                {M.previous}
              </Button>
              <Button
                variant="outline"
                disabled={offset + 20 >= query.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                {M.next}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function TicketDetail({ facilityId, id }: ManagerTicketProps) {
  const [offset, setOffset] = useState(0);
  const query = useManagerTicket(id, offset);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError || query.data.ticket.facilityId !== facilityId)
    return <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />;
  const { ticket, messages } = query.data;
  return (
    <div className="space-y-5">
      <Link
        href="/facility-manager/support"
        className="inline-flex min-h-11 items-center font-semibold text-emerald-900"
      >
        {M.back}
      </Link>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-bold">{ticket.subject}</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">
            {M.statuses[ticket.status]}
          </span>
        </div>
        <p className="text-sm">
          {ticket.customerName} · {ticket.bookingCode} · {M.categories[ticket.category]}
        </p>
        <p className="text-sm text-slate-600">
          {M.assigned}: {ticket.assignedStaffName ?? M.unassigned}
        </p>
        <p className="text-sm text-slate-600">
          {M.dueAt}: {formatDateTime(ticket.actionDueAt)}
        </p>
        {ticket.closeReason && (
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
            {ticket.closeReason}
          </p>
        )}
        {ticket.category === "PAYMENT" && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{M.paymentHint}</p>
        )}
      </section>
      <TicketForm ticket={ticket} onSaved={() => setOffset(0)} />
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">{M.history}</h2>
        {messages.map((message) => (
          <article
            key={message.id}
            className={`space-y-2 rounded-xl border p-4 ${message.kind === "INTERNAL_NOTE" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50/50"}`}
          >
            <p className="text-xs font-semibold text-slate-600">
              {message.kind === "INTERNAL_NOTE"
                ? M.note
                : message.kind === "STAFF_REPORT"
                  ? M.report
                  : M.reply}{" "}
              · {message.authorName} · {formatDateTime(message.createdAt)}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            {message.attachments.map((image) => (
              <TicketImage
                key={image.id}
                ticketId={id}
                imageId={image.id}
                filename={image.filename}
                mimeType={image.mimeType}
              />
            ))}
          </article>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            {M.previous}
          </Button>
          <Button
            variant="outline"
            disabled={offset + 20 >= query.data.totalMessages}
            onClick={() => setOffset(offset + 20)}
          >
            {M.moreMessages}
          </Button>
        </div>
      </section>
    </div>
  );
}
function TicketForm({ ticket, onSaved }: ManagerTicketFormProps) {
  const mutation = useManagerTicketAction(ticket.id),
    staff = useTaskStaff(ticket.facilityId);
  const closed = ticket.status === "CLOSED",
    payment = ticket.category === "PAYMENT";
  const actions: ManagerSupportFormValues["action"][] = closed
    ? payment
      ? []
      : ["REOPEN"]
    : [
        "REPLY",
        "NOTE",
        "ASSIGN",
        ...(!payment ? ["PRIORITY" as const] : []),
        ...(!payment && ticket.latestReportId && ticket.status === "IN_PROGRESS"
          ? ["ACCEPT" as const]
          : []),
      ];
  const form = useForm<ManagerSupportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      action: closed ? "REOPEN" : "REPLY",
      content: "",
      staffId: ticket.assignedStaffId ?? "",
      priority: ticket.priority,
    },
  });
  const action = form.watch("action");
  const permitted = actions.includes(action),
    firstAction = actions[0];
  useEffect(() => {
    if (!permitted && firstAction) form.setValue("action", firstAction);
  }, [permitted, firstAction, form]);
  if (!actions.length) return null;
  return (
    <form
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (value) => {
        if (!actions.includes(value.action)) return;
        const base = { version: ticket.version };
        let input: SupportOperation;
        if (value.action === "REPLY" || value.action === "NOTE")
          input = { ...base, action: value.action, content: value.content };
        else if (value.action === "ASSIGN")
          input = { ...base, action: value.action, staffId: value.staffId, reason: value.content };
        else if (value.action === "PRIORITY")
          input = {
            ...base,
            action: value.action,
            priority: value.priority,
            reason: value.content,
          };
        else if (value.action === "ACCEPT")
          input = {
            ...base,
            action: value.action,
            reportId: ticket.latestReportId ?? "",
            reason: value.content,
          };
        else input = { ...base, action: "REOPEN", reason: value.content };
        try {
          const result = await mutation.mutateAsync(input);
          form.reset({
            action: result.ticket.status === "CLOSED" ? "REOPEN" : "REPLY",
            content: "",
            staffId: result.ticket.assignedStaffId ?? "",
            priority: result.ticket.priority,
          });
          onSaved?.();
        } catch {
          /* Preserve draft after validation or version conflicts. */
        }
      })}
    >
      <label className="grid gap-2 text-sm font-semibold">
        {M.action}
        <select className={field} {...form.register("action")}>
          {actions.map((value) => (
            <option key={value} value={value}>
              {M.actions[value]}
            </option>
          ))}
        </select>
      </label>
      {action === "ASSIGN" && (
        <label className="grid gap-2 text-sm font-semibold">
          {M.staff}
          <select className={field} {...form.register("staffId")}>
            <option value="">{M.selectStaff}</option>
            {staff.data?.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          {form.formState.errors.staffId && (
            <span role="alert" className="text-red-700">
              {form.formState.errors.staffId.message}
            </span>
          )}
        </label>
      )}
      {action === "PRIORITY" && (
        <label className="grid gap-2 text-sm font-semibold">
          {M.priority}
          <select className={field} {...form.register("priority")}>
            <option value="NORMAL">{M.normal}</option>
            <option value="HIGH">{M.high}</option>
          </select>
        </label>
      )}
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        {M.content}
        <textarea
          rows={4}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"
          {...form.register("content")}
        />
        {form.formState.errors.content && (
          <span role="alert" className="text-red-700">
            {form.formState.errors.content.message}
          </span>
        )}
      </label>
      {action === "NOTE" && <p className="text-sm text-amber-900 sm:col-span-2">{M.privateHint}</p>}
      {staff.isError && action === "ASSIGN" && (
        <ErrorState message={M.loadingError} onRetry={() => staff.refetch()} />
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {managementError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-sm text-emerald-900 sm:col-span-2">
          {M.saved}
        </p>
      )}
      <Button
        type="submit"
        disabled={mutation.isPending || (action === "ASSIGN" && !staff.data?.length)}
      >
        {M.submit}
      </Button>
    </form>
  );
}
function TicketImage({ ticketId, imageId, filename, mimeType }: ManagerImageProps) {
  const [open, setOpen] = useState(false),
    [source, setSource] = useState("");
  const key = useManagerKey();
  const query = useQuery({
    queryKey: [...key, "support-image", ticketId, imageId],
    queryFn: ({ signal }) => api.facilityWorkspace.ticketImage(ticketId, imageId, signal),
    enabled: open,
  });
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(new Blob([query.data], { type: mimeType }));
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [query.data, mimeType]);
  return (
    <div className="space-y-2">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {M.image}: {filename}
      </Button>
      {open &&
        (query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {M.noImages}
          </p>
        ) : source ? (
          <Image
            unoptimized
            width={800}
            height={600}
            src={source}
            alt={filename}
            className="max-h-80 max-w-full rounded-xl object-contain"
          />
        ) : null)}
    </div>
  );
}
