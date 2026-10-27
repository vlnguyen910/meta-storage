"use client";

import { Bell, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "./notification-list";
import { NOTIFICATIONS as M } from "./notifications.messages";
import type { NotificationInboxProps } from "./notifications.types";
import { useNotificationInbox } from "./use-notification-inbox";

export function NotificationInbox({ compact = false }: NotificationInboxProps) {
  const query = useNotificationInbox();
  if (query.isPending && !query.unavailable)
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-600"
      >
        <LoaderCircle
          size={18}
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {M.loading}
      </div>
    );
  if (query.isError && !query.items.length)
    return (
      <div className="space-y-3 p-5 text-center">
        <p role="alert" className="m-0 font-semibold text-slate-900">
          {M.error}
        </p>
        <p className="text-sm text-slate-600">{M.errorDetail}</p>
        <Button variant="outline" onClick={() => void query.refetch()} loading={query.isFetching}>
          {M.retry}
        </Button>
      </div>
    );
  return (
    <div>
      {!compact && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="m-0 text-sm font-bold text-slate-900">{M.latest}</h2>
          <Button
            variant="outline"
            icon={<RefreshCw size={15} aria-hidden="true" />}
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {M.refresh}
          </Button>
        </div>
      )}
      {query.items.length ? (
        <NotificationList
          items={compact ? query.items.slice(0, 8) : query.items}
          compact={compact}
        />
      ) : (
        <div className="px-5 py-12 text-center">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Bell size={25} aria-hidden="true" />
          </span>
          <p className="m-0 font-bold text-slate-900">{M.empty}</p>
          <p className="mx-auto mt-2 max-w-64 text-sm leading-6 text-slate-600">{M.emptyDetail}</p>
        </div>
      )}
      {query.isError && query.items.length > 0 && (
        <div className="m-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p role="alert">{M.partialError}</p>
          <Button variant="outline" onClick={() => void query.refetch()} loading={query.isFetching}>
            {M.retry}
          </Button>
        </div>
      )}
      {!compact && query.hasNextPage && (
        <div className="border-t border-slate-100 p-4">
          <Button
            variant="outline"
            className="w-full"
            loading={query.isFetchingNextPage}
            disabled={query.isFetching}
            onClick={() => void query.fetchNextPage()}
          >
            {M.loadMore}
          </Button>
        </div>
      )}
      {!compact && query.items.length > 0 && !query.hasNextPage && (
        <p className="m-0 border-t border-slate-100 px-5 py-5 text-center text-xs text-slate-500">
          {M.end}
        </p>
      )}
    </div>
  );
}
