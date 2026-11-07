"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { authStore } from "@/features/auth/auth-store";

const privateRoots = new Set([
  "facility-flow",
  "customer-booking",
  "customer-bookings",
  "reservations",
  "appointments",
  "appointment-tasks",
  "appointment-inspections",
  "appointment-units",
  "appointment-staff",
  "unit-types",
  "returns",
  "rentals",
  "rental-payments",
  "rental-documents",
  "return-policy",
  "system-settings",
  "lifecycle-notifications",
  "booking-tracking",
  "facilities",
  "bookings",
  "check-ins",
]);
export function PrivateDataBoundary() {
  const client = useQueryClient();
  useEffect(() => {
    return authStore.subscribe((state, previous) => {
      const key = (session: typeof state.session) =>
        `${session?.user.id ?? ""}:${session?.user.role ?? ""}`;
      if (key(state.session) === key(previous.session)) return;
      if (previous.session?.user.id) {
        try {
          sessionStorage.removeItem(
            `metastorage.reservation-checkout:v2:${previous.session.user.id}`,
          );
        } catch {
          /* Storage can be unavailable in private browsing. */
        }
      }
      const filters = {
        predicate: (query: { queryKey: readonly unknown[] }) =>
          privateRoots.has(String(query.queryKey[0])),
      };
      // Removing an actively observed query can leave it permanently pending.
      // Reset active observers so they fetch under the new identity with no old data.
      void client.cancelQueries(filters).then(() => {
        client.removeQueries({ ...filters, type: "inactive" });
        return client.resetQueries({ ...filters, type: "active" });
      });
    });
  }, [client]);
  return null;
}
