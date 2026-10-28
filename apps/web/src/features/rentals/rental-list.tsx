"use client";

import {
  Box,
  Building2,
  CalendarDays,
  ChevronRight,
  History,
  MapPin,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { useMyRentals } from "./hooks";
import { RENTAL_MESSAGES } from "./rentals.messages";

export function RentalList() {
  const [view, setView] = useState<"current" | "history">("current");
  const query = useMyRentals(view);
  const rentals = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (query.isLoading) return <LoadingState variant="table" />;
  if (query.isError)
    return <ErrorState message={RENTAL_MESSAGES.loadFailed} onRetry={() => query.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="My Storage"
        title={view === "current" ? RENTAL_MESSAGES.currentTitle : RENTAL_MESSAGES.historyTitle}
        description={RENTAL_MESSAGES.description}
      />
      <div className="mb-6 inline-flex rounded-xl border border-slate-200/80 bg-slate-100 p-1 shadow-inner">
        <fieldset className="flex flex-wrap gap-1 border-0 p-0">
          <legend className="sr-only">{RENTAL_MESSAGES.viewLabel}</legend>
          {(["current", "history"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={view === item}
              onClick={() => setView(item)}
              className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                view === item
                  ? "bg-white font-bold text-primary shadow-xs"
                  : "text-slate-600 hover:text-ink"
              }`}
            >
              {item === "current" ? RENTAL_MESSAGES.currentTab : RENTAL_MESSAGES.historyTab}
            </button>
          ))}
        </fieldset>
      </div>
      {rentals.length === 0 ? (
        <Card className="grid min-h-48 place-items-center text-center">
          <div>
            <Building2 aria-hidden="true" className="mx-auto mb-3 text-primary" />
            <h2 className="text-xl font-bold">{RENTAL_MESSAGES.emptyTitle}</h2>
            <p className="mb-0 text-muted">{RENTAL_MESSAGES.emptyDescription}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3.5">
          {rentals.map((rental) => (
            <Link
              key={rental.id}
              href={customerRoutes.rental(rental.id)}
              className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md md:flex-row md:items-center md:justify-between md:p-6">
                <div className="flex items-start gap-4">
                  <div className="hidden size-12 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white sm:grid">
                    <Warehouse size={22} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-slate-200/70 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                        {rental.bookingCode}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold text-ink transition-colors group-hover:text-primary">
                      {rental.unitType.name} · {rental.unitType.sizeLabel}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin size={14} className="shrink-0 text-slate-400" />
                      <span>{rental.facility.name}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 md:flex md:items-center md:gap-8 md:border-t-0 md:pt-0">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
                      <CalendarDays size={13} className="text-slate-400" />
                      {RENTAL_MESSAGES.termLabel}
                    </span>
                    <p className="text-sm font-semibold text-ink">
                      {formatDate(rental.startAt)} – {formatDate(rental.endAt)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
                      <Box size={13} className="text-slate-400" />
                      {RENTAL_MESSAGES.unitLabel}
                    </span>
                    <p className="font-mono text-sm font-bold text-ink">
                      {rental.storageUnit?.code ? (
                        <span className="rounded-md border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-slate-800">
                          {rental.storageUnit.code}
                        </span>
                      ) : (
                        <span className="text-xs font-normal text-muted italic">
                          {RENTAL_MESSAGES.notAssigned}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                  <StatusBadge value={rental.status} />
                  <div className="grid size-9 place-items-center rounded-full bg-slate-50 text-slate-400 transition-all group-hover:bg-primary group-hover:text-white">
                    <ChevronRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-5 font-semibold text-primary disabled:opacity-60"
        >
          {query.isFetchingNextPage ? (
            <Spinner variant="brand" size="sm" />
          ) : (
            <History className="size-4" aria-hidden="true" />
          )}
          {query.isFetchingNextPage ? RENTAL_MESSAGES.loadingMore : RENTAL_MESSAGES.loadMore}
        </button>
      )}
      {query.isFetchNextPageError && (
        <p role="alert" className="mt-3 text-center text-danger">
          {RENTAL_MESSAGES.loadMoreFailed}
        </p>
      )}
    </>
  );
}
