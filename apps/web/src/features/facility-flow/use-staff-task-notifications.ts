"use client";

import type { StaffTaskAssignedNotification } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { bookingKeys } from "@/features/check-in/hooks";
import { api } from "@/lib/api";
import { STAFF_NOTIFICATIONS } from "./staff-task-notifications.messages";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline" | "unavailable";

function isTaskEvent(value: unknown): value is StaffTaskAssignedNotification {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<StaffTaskAssignedNotification>;
  return (
    event.type === "STAFF_TASK_ASSIGNED" &&
    typeof event.id === "string" &&
    event.id.length > 0 &&
    typeof event.recipientId === "string" &&
    typeof event.bookingId === "string" &&
    event.bookingId.length > 0 &&
    typeof event.occurredAt === "string" &&
    Number.isFinite(Date.parse(event.occurredAt))
  );
}

export function useStaffTaskNotifications() {
  const userId = useAuthStore((s) =>
    s.session?.user.role === UserRole.FACILITY_STAFF ? s.session.user.id : null,
  );
  const ready = useAuthStore((s) => s.authReady);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [received, setReceived] = useState(false);
  const [retry, setRetry] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly restarts the connection lifecycle.
  useEffect(() => {
    if (isMockMode || !ready || !userId) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let eventRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let denied = false;
    const seen = new Set<string>();
    let lastToastAt = 0;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    };
    const schedule = () => {
      if (stopped || denied || !navigator.onLine) return;
      setStatus("reconnecting");
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30000));
    };
    function connect() {
      if (stopped || socket) return;
      if (denied) {
        setStatus("unavailable");
        return;
      }
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      try {
        socket = new WebSocket(api.notifications.webSocketUrl(window.location.origin));
      } catch {
        schedule();
        return;
      }
      const current = socket;
      current.onopen = () => {
        if (stopped || socket !== current) return;
        attempts = 0;
        setStatus("connected");
        refresh();
      };
      current.onmessage = ({ data }) => {
        if (stopped || socket !== current) return;
        let event: unknown;
        try {
          event = JSON.parse(data);
        } catch {
          return;
        }
        if (!isTaskEvent(event) || event.recipientId !== userId || seen.has(event.id)) return;
        seen.add(event.id);
        if (seen.size > 100) seen.delete(seen.values().next().value as string);
        const historyKey = ["bookings", "notification-events", userId] as const;
        const history = queryClient.getQueryData<StaffTaskAssignedNotification[]>(historyKey) ?? [];
        if (history.some((item) => item.id === event.id)) return;
        // Keep only real events received in this session; the server has no Staff history API.
        queryClient.setQueryData(
          historyKey,
          [event, ...history]
            .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
            .slice(0, 100),
        );
        setReceived(true);
        // Keep bursts of assignments from stacking an unbounded column of toasts.
        if (Date.now() - lastToastAt >= 2000) {
          showToast(STAFF_NOTIFICATIONS.received);
          lastToastAt = Date.now();
        }
        // Coalesce assignment bursts while every event remains immediately visible in the inbox.
        if (!eventRefreshTimer) {
          eventRefreshTimer = setTimeout(() => {
            eventRefreshTimer = undefined;
            refresh();
          }, 200);
        }
      };
      current.onclose = ({ code }) => {
        if (stopped || socket !== current) return;
        socket = null;
        if (code === 1008) {
          denied = true;
          setStatus("unavailable");
          return;
        }
        if (!navigator.onLine) setStatus("offline");
        else schedule();
      };
      // The close event owns reconnection; an error must not schedule a second socket.
      current.onerror = () => {};
    }
    const offline = () => {
      clearTimeout(timer);
      const current = socket;
      socket = null;
      current?.close();
      setStatus("offline");
    };
    const online = () => {
      refresh();
      connect();
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        connect();
      }
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
      clearTimeout(eventRefreshTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId, ready, queryClient, showToast, retry]);

  return {
    enabled: !isMockMode && ready && !!userId,
    status,
    received,
    reconnect: () => {
      setStatus("connecting");
      setRetry((n) => n + 1);
    },
  };
}
