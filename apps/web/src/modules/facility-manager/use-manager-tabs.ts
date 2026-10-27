"use client";
import type { ReportExportQuery, SupportOperation } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import { managementError } from "@/features/facility-management/hooks";
import { downloadCsv } from "@/features/operations/operations.utils";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import type { ManagerReportRow } from "./manager-tabs.types";
export function useManagerKey() {
  const user = useAuthStore((s) => s.session?.user);
  return ["manager-tabs", user?.id, user?.role] as const;
}
export function useManagerReport(filters: ReportExportQuery) {
  const { showToast } = useToast();
  const key = useManagerKey();
  const report = useQuery({
    queryKey: [...key, "report", filters],
    enabled: Boolean(filters.facilityId),
    queryFn: async (): Promise<ManagerReportRow[]> => {
      const scope = { facilityId: filters.facilityId, limit: 100, offset: 0 };
      if (filters.type === "revenue-monthly")
        return (
          await api.reports.getMonthlyRevenue({
            facilityId: filters.facilityId,
            from: filters.from,
            to: filters.to,
          })
        ).items.map((r) => ({
          id: r.month,
          label: r.month,
          value: formatCurrency(Number(r.cashReceived)),
          detail: formatCurrency(Number(r.netCash)),
        }));
      // Preview is intentionally a page; CSV uses the backend export contract for the full selection.
      if (filters.type === "revenue")
        return (
          await api.reports.getRevenue({ ...scope, from: filters.from, to: filters.to })
        ).items.map((r) => ({
          id: r.facility.id,
          label: r.facility.name,
          value: formatCurrency(Number(r.metrics.cashReceived)),
          detail: formatCurrency(Number(r.metrics.netCash)),
        }));
      if (filters.type === "utilization")
        return (await api.reports.getUtilization(scope)).items.map((r) => ({
          id: r.facility.id,
          label: r.facility.name,
          value: `${r.metrics.occupiedUnits}/${r.metrics.activeUnits}`,
          detail: `${r.metrics.utilizationPercent ?? 0}%`,
        }));
      return (await api.reports.getRentals({ ...scope, status: filters.status })).items.map(
        (r) => ({
          id: r.id,
          label: `${r.bookingCode ?? r.id} · ${r.unitCode}`,
          value: r.status,
          detail: formatDate(r.expectedEndAt),
        }),
      );
    },
  });
  const download = useMutation({
    onSuccess: () => showToast(M.exportSaved, "success"),
    onError: (error) => showToast(managementError(error), "error"),
    mutationFn: async () => {
      const file = await api.reports.exportReport(filters);
      downloadCsv(file.data, file.filename);
    },
  });
  return { report, download };
}
export function useManagerTicket(id: string, offset: number) {
  const key = useManagerKey();
  return useQuery({
    queryKey: [...key, "ticket", id, offset],
    queryFn: ({ signal }) => api.facilityWorkspace.ticket(id, offset, signal),
    enabled: Boolean(id),
  });
}
export function useManagerTicketAction(id: string) {
  const { showToast } = useToast();
  const key = useManagerKey(),
    client = useQueryClient();
  return useMutation({
    mutationFn: (input: SupportOperation) => api.facilityWorkspace.ticketAction(id, input),
    onSuccess: (_result, input) => showToast(M.actionSuccess[input.action] ?? M.saved, "success"),
    onError: (error) => showToast(managementError(error), "error"),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: ["lifecycle-notifications"] });
    },
  });
}
