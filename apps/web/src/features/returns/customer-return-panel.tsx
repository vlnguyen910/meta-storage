"use client";

import { CalendarDays, ChevronRight, MessageSquare, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useRentalReturns } from "./hooks";
import { ReturnStatusBadge } from "./return-status-badge";
import { RETURNS_MESSAGES as M } from "./returns.messages";

export function CustomerReturnPanel({
  rentalId,
  rentalStatus,
}: {
  rentalId: string;
  rentalStatus: string;
}) {
  const query = useRentalReturns(rentalId);
  if (query.isLoading) return <LoadingState variant="content" />;
  if (query.isError) return <ErrorState message={M.loadError} onRetry={() => query.refetch()} />;
  const requests = query.data ?? [];
  const openRequest = requests.find((request) =>
    ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"].includes(request.status),
  );
  const canRequest = ["ACTIVE", "RETURN_PENDING", "OVERDUE"].includes(rentalStatus) && !openRequest;
  return (
    <Card className="mt-6 rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
            <RotateCcw size={20} />
          </div>
          <div>
            <h2 className="m-0 text-xl font-bold text-ink">{M.sectionTitle}</h2>
            <p className="mb-0 mt-1 text-sm text-muted">{M.sectionDescription}</p>
          </div>
        </div>
        {canRequest && (
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-xs transition hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={customerRoutes.newReturn(rentalId)}
          >
            <Plus size={16} />
            {M.newRequest}
          </Link>
        )}
      </div>
      {requests.length === 0 ? (
        <p className="mb-0 mt-5 text-sm text-muted">{M.noRequest}</p>
      ) : (
        <ul className="mt-5 grid list-none gap-3 p-0">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={customerRoutes.returnRequest(request.id)}
                className="group flex min-h-14 flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 transition-all hover:border-primary/50 hover:shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-center gap-3.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-emerald-50 group-hover:text-primary">
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-ink">
                      {new Date(request.startsAt).toLocaleString("vi-VN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: request.timezone,
                      })}
                    </strong>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <MessageSquare size={12} className="shrink-0 text-slate-400" />
                      <span>{request.reason}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ReturnStatusBadge status={request.status} />
                  <ChevronRight
                    size={17}
                    className="text-slate-400 transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
