"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

export function useManagerOverview(facilityId: string) {
  const actorId = useAuthStore((state) => state.session?.user.id);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 5);
  const period = { from: start.toISOString().slice(0, 10), to: today, facilityId };
  const overview = useQuery({
    queryKey: ["manager-overview", actorId, period],
    queryFn: ({ signal }) => {
      signal.throwIfAborted();
      return api.reports.getOverview(period);
    },
    enabled: Boolean(actorId && facilityId),
  });
  const monthly = useQuery({
    queryKey: ["manager-monthly", actorId, period],
    queryFn: () => api.reports.getMonthlyRevenue(period),
    enabled: Boolean(actorId && facilityId),
  });
  return { overview, monthly };
}
