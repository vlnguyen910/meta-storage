"use client";

import { type FacilitySupportTicket, SUPPORT_CATEGORIES } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronRight, RefreshCw, Search, UserRound, Warehouse } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OperationalBadge } from "@/components/ui/operational";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import { useManagerKey } from "./use-manager-tabs";

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const sentAt = (value: string) => `${timeFormatter.format(new Date(value))} · ${formatDate(value)}`;

export function ManagerSupportScreen() {
  return (
    <ManagerTabFrame title={M.support} description={M.supportHint}>
      {(facilityId) => <SupportList facilityId={facilityId} />}
    </ManagerTabFrame>
  );
}

function SupportList({ facilityId }: { facilityId: string }) {
  const key = useManagerKey();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [category, setCategory] = useState<(typeof SUPPORT_CATEGORIES)[number] | "ALL">("ALL");
  const opener = useRef<HTMLButtonElement | null>(null);
  const list = useInfiniteQuery({
    queryKey: [...key, "support", facilityId, category, appliedSearch],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.facilityList(
        facilityId,
        {
          limit: 20,
          cursor: pageParam,
          search: appliedSearch || undefined,
          category: category === "ALL" ? undefined : category,
        },
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 30000,
    enabled: !selected,
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  function openTicket(id: string, button: HTMLButtonElement) {
    opener.current = button;
    setSelected(id);
  }
  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 lg:flex-row lg:items-center lg:justify-between"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
        }}
      >
        <div className="flex min-w-0 flex-1 gap-2 lg:max-w-xl">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              size={16}
              className="absolute left-3 top-3.5 text-secondary"
            />
            <input
              aria-label={M.supportSearchLabel}
              placeholder={M.supportSearch}
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-secondary focus:outline-2 focus:outline-primary"
            />
          </div>
          <Button type="submit" className="shrink-0">
            {M.supportSearchAction}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label
            htmlFor="manager-support-category"
            className="text-xs font-semibold text-secondary"
          >
            {M.category}
          </label>
          <Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
            <SelectTrigger id="manager-support-category" aria-label={M.category} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{M.all}</SelectItem>
              {SUPPORT_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {M.categories[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto size-11 shrink-0 px-0 sm:w-auto sm:px-3"
            aria-label={M.supportRefresh}
            disabled={list.isFetching}
            onClick={() => void list.refetch()}
            icon={
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={list.isFetching ? "animate-spin" : ""}
              />
            }
          >
            <span className="hidden sm:inline">{M.supportRefresh}</span>
          </Button>
        </div>
      </form>
      {list.isPending ? (
        <LoadingState variant="table" />
      ) : list.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => void list.refetch()} />
      ) : !items.length ? (
        <EmptyState title={M.supportEmpty} description={M.supportEmptyHint} />
      ) : (
        <Card className="overflow-hidden border-line bg-surface text-ink shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
            <h2 className="text-sm font-semibold">{M.supportListTitle}</h2>
            <p className="text-xs text-secondary" aria-live="polite">
              {M.supportLoaded(items.length)}
            </p>
          </div>
          <div className="hidden xl:block">
            <Table className="table-fixed">
              <TableHeader className="bg-canvas/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[28%] pl-5 text-secondary">{M.supportRequest}</TableHead>
                  <TableHead className="w-[22%] text-secondary">{M.supportCustomerUnit}</TableHead>
                  <TableHead className="w-[13%] text-secondary">{M.category}</TableHead>
                  <TableHead className="w-[14%] text-secondary">{M.supportCreatedAt}</TableHead>
                  <TableHead className="w-[15%] text-secondary">{M.status}</TableHead>
                  <TableHead className="w-20 pr-5">
                    <span className="sr-only">{M.action}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ticket) => (
                  <TableRow key={ticket.id} className="border-line">
                    <TableCell className="w-[28%] whitespace-normal py-4 pl-5">
                      <p className="mb-1 font-mono text-xs tracking-wide text-secondary">
                        {formatReference(ticket.id, "YC")}
                      </p>
                      <p
                        className="line-clamp-2 break-words font-semibold text-ink"
                        title={ticket.subject}
                      >
                        {ticket.subject}
                      </p>
                    </TableCell>
                    <TableCell className="w-[23%] whitespace-normal py-4">
                      <p className="break-words font-medium text-ink">{ticket.customer.name}</p>
                      <p className="mt-1 text-xs text-secondary">
                        {ticket.unitCode ?? M.supportNoUnit}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-normal py-4 text-sm">
                      {M.categories[ticket.category]}
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      <time dateTime={ticket.createdAt}>
                        {timeFormatter.format(new Date(ticket.createdAt))}
                      </time>
                      <p className="mt-1 text-xs text-secondary">{formatDate(ticket.createdAt)}</p>
                    </TableCell>
                    <TableCell className="py-4">
                      <TicketStatus ticket={ticket} />
                    </TableCell>
                    <TableCell className="py-3 pr-5 text-right">
                      <Button
                        variant="ghost"
                        className="size-11 p-0 text-primary hover:bg-primary-soft"
                        aria-label={M.supportOpen(ticket.subject)}
                        title={M.view}
                        onClick={(event) => openTicket(ticket.id, event.currentTarget)}
                      >
                        <ChevronRight size={19} aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y divide-line xl:hidden">
            {items.map((ticket) => (
              <article key={ticket.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 font-mono text-xs tracking-wide text-secondary">
                      {formatReference(ticket.id, "YC")}
                    </p>
                    <h3 className="break-words text-sm font-semibold leading-6 text-ink">
                      {ticket.subject}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    className="size-11 shrink-0 p-0 text-primary hover:bg-primary-soft"
                    aria-label={M.supportOpen(ticket.subject)}
                    title={M.view}
                    onClick={(event) => openTicket(ticket.id, event.currentTarget)}
                  >
                    <ChevronRight size={19} aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-secondary">
                  <p className="break-words font-medium text-ink">{ticket.customer.name}</p>
                  <p className="break-words text-right">{ticket.unitCode ?? M.supportNoUnit}</p>
                  <p>{M.categories[ticket.category]}</p>
                  <time dateTime={ticket.createdAt} className="text-right">
                    {sentAt(ticket.createdAt)}
                  </time>
                </div>
                <TicketStatus ticket={ticket} />
              </article>
            ))}
          </div>
          {list.hasNextPage && (
            <div className="flex justify-center border-t border-line p-3">
              <Button
                variant="ghost"
                loading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {M.supportMore}
              </Button>
            </div>
          )}
        </Card>
      )}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && (
          <SupportDetail
            facilityId={facilityId}
            id={selected}
            restoreFocus={() => opener.current?.focus()}
          />
        )}
      </Sheet>
    </div>
  );
}

function TicketStatus({ ticket }: { ticket: FacilitySupportTicket }) {
  return (
    <OperationalBadge
      value={ticket.status}
      label={ticket.status === "OPEN" ? M.supportReceived : M.statuses[ticket.status]}
    />
  );
}

function SupportDetail({
  facilityId,
  id,
  restoreFocus,
}: {
  facilityId: string;
  id: string;
  restoreFocus: () => void;
}) {
  const key = useManagerKey();
  const detail = useQuery({
    queryKey: [...key, "support-detail", facilityId, id],
    queryFn: ({ signal }) => api.support.facilityDetail(facilityId, id, signal),
  });
  return (
    <SheetContent
      aria-describedby={undefined}
      className="max-w-none gap-0 p-0 md:max-w-[560px]"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
    >
      <SheetHeader className="shrink-0 border-b border-line px-5 py-5 pr-16 sm:px-6 sm:pr-16">
        <SheetTitle className="text-base font-bold">{M.supportDetailTitle}</SheetTitle>
        <p className="font-mono text-xs tracking-wide text-secondary">
          {formatReference(id, "YC")}
        </p>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        {detail.isPending ? (
          <LoadingState variant="table" />
        ) : detail.isError ? (
          <ErrorState message={M.loadingError} onRetry={() => void detail.refetch()} />
        ) : (
          <TicketContent ticket={detail.data} />
        )}
      </div>
    </SheetContent>
  );
}

function TicketContent({ ticket }: { ticket: FacilitySupportTicket }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <TicketStatus ticket={ticket} />
        <h3 className="break-words text-xl font-semibold leading-8 text-ink">{ticket.subject}</h3>
        <p className="text-xs text-secondary">
          {M.supportCreatedAt}: <time dateTime={ticket.createdAt}>{sentAt(ticket.createdAt)}</time>
        </p>
      </div>
      <section className="rounded-xl border border-line bg-primary-soft/40 p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary">
          <UserRound size={15} aria-hidden="true" />
          {M.customer}
        </h4>
        <p className="break-words text-sm font-semibold text-ink">{ticket.customer.name}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {[
            [M.contact, ticket.customer.phone ?? M.missing],
            [M.supportEmail, ticket.customer.email],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 space-y-1">
              <dt className="text-xs text-secondary">{label}</dt>
              <dd className="break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-3 border-b border-line pb-5">
        <h4 className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Warehouse size={15} aria-hidden="true" />
          {M.supportContext}
        </h4>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            [M.category, M.categories[ticket.category]],
            [M.unit, ticket.unitCode ?? M.supportNoUnit],
            [
              M.bookingCode,
              ticket.bookingCode ? formatReference(ticket.bookingCode, "BK") : M.missing,
            ],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 space-y-1">
              <dt className="text-xs text-secondary">{label}</dt>
              <dd className="break-words font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-ink">{M.supportDescription}</h4>
        <p className="whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas/60 p-4 text-sm leading-7 text-ink">
          {ticket.description}
        </p>
      </section>
    </div>
  );
}
