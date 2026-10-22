"use client";

import { Building2, ChevronRight, History } from "lucide-react";
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
      <fieldset className="mb-5 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{RENTAL_MESSAGES.viewLabel}</legend>
        {(["current", "history"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
            className={`min-h-11 rounded-md border px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${view === item ? "border-primary bg-primary text-white" : "border-line bg-white text-ink"}`}
          >
            {item === "current" ? RENTAL_MESSAGES.currentTab : RENTAL_MESSAGES.historyTab}
          </button>
        ))}
      </fieldset>
      {rentals.length === 0 ? (
        <Card className="grid min-h-48 place-items-center text-center">
          <div>
            <Building2 aria-hidden="true" className="mx-auto mb-3 text-primary" />
            <h2 className="text-xl font-bold">{RENTAL_MESSAGES.emptyTitle}</h2>
            <p className="mb-0 text-muted">{RENTAL_MESSAGES.emptyDescription}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rentals.map((rental) => (
            <Link
              key={rental.id}
              href={customerRoutes.rental(rental.id)}
              className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Card className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-5 transition hover:border-primary max-[700px]:grid-cols-1">
                <div>
                  <small className="text-muted">{rental.bookingCode}</small>
                  <h2 className="text-xl font-bold">
                    {rental.unitType.name} · {rental.unitType.sizeLabel}
                  </h2>
                  <p className="m-0 text-muted">{rental.facility.name}</p>
                </div>
                <div>
                  <small className="block text-muted">{RENTAL_MESSAGES.termLabel}</small>
                  <strong>
                    {formatDate(rental.startAt)} – {formatDate(rental.expectedEndAt)}
                  </strong>
                </div>
                <div>
                  <small className="block text-muted">{RENTAL_MESSAGES.unitLabel}</small>
                  <strong>{rental.physicalUnit?.code ?? RENTAL_MESSAGES.notAssigned}</strong>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={rental.status} />
                  <ChevronRight aria-hidden="true" className="text-muted" />
                </div>
              </Card>
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
