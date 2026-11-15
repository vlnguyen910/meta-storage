"use client";

import { createNotificationStream } from "@metastorage/api-client";
import { WorkUpdateNotificationSchema } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

export function CustomerAppointmentsRealtime() {
  const userId = useAuthStore((s) =>
    s.session?.user.role === UserRole.STORAGE_CUSTOMER ? s.session.user.id : null,
  );
  const ready = useAuthStore((s) => s.authReady);
  const client = useQueryClient();
  useEffect(() => {
    if (isMockMode || !ready || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["customer-appointments", `${userId}:CUSTOMER`] });
      void client.invalidateQueries({ queryKey: ["appointments", `${userId}:CUSTOMER`] });
    };
    const stream = createNotificationStream({
      createSocket: () => new WebSocket(api.notifications.webSocketUrl(window.location.origin)),
      onOpen: refresh,
      onMessage: (data) => {
        let value: unknown;
        try {
          value = JSON.parse(String(data));
        } catch {
          return;
        }
        const parsed = WorkUpdateNotificationSchema.safeParse(value);
        if (
          !parsed.success ||
          parsed.data.type !== "CUSTOMER_APPOINTMENT_UPDATED" ||
          parsed.data.recipientId !== userId ||
          timer
        )
          return;
        timer = setTimeout(() => {
          timer = undefined;
          refresh();
        }, 150);
      },
    });
    const online = () => {
      if (navigator.onLine) void stream.connect();
    };
    const offline = () => stream.disconnect();
    const visible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        online();
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    online();
    return () => {
      stream.dispose();
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId, ready, client]);
  return null;
}
