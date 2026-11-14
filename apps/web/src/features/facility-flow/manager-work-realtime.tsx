"use client";

import type { FacilityWorkUpdatedNotification } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

function isWorkUpdate(value: unknown): value is FacilityWorkUpdatedNotification {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<FacilityWorkUpdatedNotification>;
  return (
    event.type === "FACILITY_WORK_UPDATED" &&
    typeof event.id === "string" &&
    event.id.length > 0 &&
    typeof event.facilityId === "string" &&
    typeof event.occurredAt === "string" &&
    Number.isFinite(Date.parse(event.occurredAt))
  );
}

/** One connection for the FM workspace; list filters and open detail panels stay in place. */
export function ManagerWorkRealtime({ facilityId }: { facilityId: string }) {
  const managerId = useAuthStore((s) =>
    s.session?.user.role === UserRole.FACILITY_MANAGER ? s.session.user.id : null,
  );
  const ready = useAuthStore((s) => s.authReady);
  const client = useQueryClient();

  useEffect(() => {
    if (isMockMode || !ready || !managerId || !facilityId) return;
    let stopped = false;
    let denied = false;
    let socket: WebSocket | null = null;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const keys = [
        ["bookings"],
        ["flow5", managerId, UserRole.FACILITY_MANAGER, "tasks"],
        ["flow5", managerId, UserRole.FACILITY_MANAGER, "task"],
        ["flow5", managerId, UserRole.FACILITY_MANAGER, "staff"],
        ["facility-task-related-appointment", facilityId],
        ["facility-task-related-unit", facilityId],
        ["facility-task-related-rental", facilityId],
        ["manager-appointment-rental-detail", facilityId],
        ["facility-flow", "lookup"],
        ["facility-flow", "inspections"],
      ];
      for (const queryKey of keys) void client.invalidateQueries({ queryKey });
    };
    const schedule = () => {
      if (stopped || denied || !navigator.onLine) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30_000));
    };
    function connect() {
      if (stopped || denied || socket || !navigator.onLine) return;
      clearTimeout(reconnectTimer);
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
        // Events are ephemeral: always recover the authoritative state after reconnecting.
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
        if (!isWorkUpdate(event) || event.facilityId !== facilityId || refreshTimer) return;
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          refresh();
        }, 150);
      };
      current.onclose = ({ code }) => {
        if (stopped || socket !== current) return;
        socket = null;
        if (code === 1008) denied = true;
        else schedule();
      };
      current.onerror = () => {}; // Only close schedules a retry.
    }
    const offline = () => {
      clearTimeout(reconnectTimer);
      const current = socket;
      socket = null;
      current?.close();
    };
    const visible = () => {
      if (document.visibilityState !== "visible") return;
      refresh();
      connect();
    };
    window.addEventListener("online", connect);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      clearTimeout(refreshTimer);
      socket?.close();
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [managerId, ready, facilityId, client]);

  return null;
}
