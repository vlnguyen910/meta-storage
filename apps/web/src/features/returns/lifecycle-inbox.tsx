"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { integrationError } from "./integration-utils";
import { useFlow3Identity } from "./use-flow3-identity";

export function LifecycleInbox() {
  const identity = useFlow3Identity();
  const [open, setOpen] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["lifecycle-notifications", identity],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.inbox(pageParam, signal),
    getNextPageParam: (last, pages) => (last.length === 20 ? pages.length * 20 : undefined),
    enabled: open,
    refetchOnWindowFocus: true,
  });
  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-slate-900 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-white text-sky-700 shadow-sm">
            <Bell size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold">{F3.notifications}</h2>
            <p className="m-0 text-xs text-slate-600">
              Cập nhật mới về vận hành và hồ sơ cần xử lý.
            </p>
          </div>
        </div>
        <Button variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
          <span>{open ? F3.close : "Xem thông báo"}</span>
        </Button>
      </div>
      {open && (
        <>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {F3.refresh}
          </Button>
          {query.isPending ? (
            <LoadingState variant="table" />
          ) : query.isError && !query.data ? (
            <ErrorState message={integrationError(query.error)} onRetry={() => query.refetch()} />
          ) : (
            <ul className="space-y-3">
              {!query.data?.pages.flat().length && <li>{F3.noNotifications}</li>}
              {query.data?.pages.flat().map((item) => (
                <li key={item.id} className="border-t border-slate-200 pt-3">
                  <strong>{item.subject}</strong>
                  <p className="text-sm whitespace-pre-wrap break-words">{item.body}</p>
                  <time className="text-xs text-slate-600" dateTime={item.occurredAt}>
                    {new Date(item.occurredAt).toLocaleString("vi-VN")}
                  </time>
                </li>
              ))}
            </ul>
          )}
          {query.isError && query.data && <p role="alert">{F3.error}</p>}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {F3.loadMore}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
