import { createNotificationStream } from "@metastorage/api-client";
import { WorkUpdateNotificationSchema } from "@metastorage/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { WEB_BASE_URL } from "../../lib/runtime-config";

// React Native accepts connection headers; the DOM constructor's typings omit this overload.
const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, protocols: string[], options: { headers: Record<string, string> }): WebSocket;
};

export function useWorkRealtime(userId?: string, role?: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (!userId || (role !== "CUSTOMER" && role !== "FACILITY_STAFF")) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const prefixes =
        role === "CUSTOMER"
          ? ["customer-home-appointments", "customer-home-appointment", "customer-appointments"]
          : [
              "mobile-staff-bookings",
              "mobile-staff-tasks",
              "mobile-staff-task",
              "mobile-appointments",
              "mobile-appointment-tasks",
              "mobile-inspection",
            ];
      for (const key of prefixes) void client.invalidateQueries({ queryKey: [key, userId] });
    };
    const stream = createNotificationStream({
      createSocket: async () => {
        const url = api.notifications.webSocketUrl(WEB_BASE_URL);
        if (Platform.OS === "web") return new WebSocket(url);
        const cookie = await authClient.getCookie();
        if (!cookie) throw new Error("No authenticated notification session");
        return new NativeWebSocket(url, [], {
          headers: { Cookie: cookie, Origin: "metastorage://" },
        });
      },
      onOpen: refresh,
      onMessage: (data) => {
        let value: unknown;
        try {
          value = JSON.parse(String(data));
        } catch {
          return;
        }
        const parsed = WorkUpdateNotificationSchema.safeParse(value);
        if (!parsed.success || parsed.data.recipientId !== userId || timer) return;
        if (
          parsed.data.type !==
          (role === "CUSTOMER" ? "CUSTOMER_APPOINTMENT_UPDATED" : "STAFF_WORK_UPDATED")
        )
          return;
        timer = setTimeout(() => {
          timer = undefined;
          refresh();
        }, 150);
      },
    });
    const resume = () => {
      if (Platform.OS !== "web" || navigator.onLine) void stream.connect();
    };
    const offline = () => stream.disconnect();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        resume();
      } else stream.disconnect();
    });
    if (Platform.OS === "web") {
      window.addEventListener("online", resume);
      window.addEventListener("offline", offline);
    }
    if (!AppState.currentState || AppState.currentState === "active") resume();
    return () => {
      stream.dispose();
      clearTimeout(timer);
      subscription.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("online", resume);
        window.removeEventListener("offline", offline);
      }
    };
  }, [userId, role, client]);
}
