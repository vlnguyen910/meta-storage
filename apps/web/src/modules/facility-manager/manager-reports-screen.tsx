"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { RENTAL_STATUSES, type ReportExportQuery } from "@metastorage/contracts";
import { Download, FileChartColumn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { OperationalSectionHeader, operationalField } from "@/components/ui/operational";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { managementError } from "@/features/facility-management/hooks";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import type { ManagerFacilityTabProps } from "./manager-tabs.types";
import { useManagerReport } from "./use-manager-tabs";

const schema = z
  .object({
    type: z.enum(["revenue", "revenue-monthly", "utilization", "rentals"]),
    from: z.string(),
    to: z.string(),
    status: z.enum(RENTAL_STATUSES).or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (["revenue", "revenue-monthly"].includes(v.type) && (!v.from || !v.to || v.to < v.from))
      ctx.addIssue({ code: "custom", path: ["to"], message: M.invalidPeriod });
  });
const field = operationalField;
export function ManagerReportsScreen() {
  return (
    <ManagerTabFrame title={M.reports} description={M.reportHint}>
      {(facilityId) => <ManagerReportsPanel facilityId={facilityId} />}
    </ManagerTabFrame>
  );
}
export function ManagerReportsPanel({ facilityId }: ManagerFacilityTabProps) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const defaults: z.input<typeof schema> = {
    type: "revenue" as const,
    from: `${today.slice(0, 7)}-01`,
    to: today,
    status: "",
  };
  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const [filters, setFilters] = useState<ReportExportQuery>({
    type: "revenue",
    facilityId,
    from: defaults.from,
    to: today,
  });
  const { report, download } = useManagerReport(filters);
  const type = form.watch("type"),
    financial = ["revenue", "revenue-monthly"].includes(type);
  return (
    <div className="space-y-5">
      <form
        onSubmit={form.handleSubmit((values) => {
          setFilters({
            type: values.type,
            facilityId,
            ...(financial ? { from: values.from, to: values.to } : {}),
            ...(values.type === "rentals" && values.status ? { status: values.status } : {}),
          });
          form.reset(values);
        })}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <label className="grid gap-2 text-sm font-semibold">
          {M.type}
          <select className={field} {...form.register("type")}>
            {Object.entries(M.reportTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {financial && (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              {M.from}
              <input type="date" className={field} {...form.register("from")} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              {M.to}
              <input type="date" className={field} {...form.register("to")} />
            </label>
          </>
        )}
        {type === "rentals" && (
          <label className="grid gap-2 text-sm font-semibold">
            {M.status}
            <select className={field} {...form.register("status")}>
              <option value="">{M.all}</option>
              {["ACTIVE", "RETURN_PENDING", "OVERDUE", "CLOSED"].map((s) => (
                <option key={s} value={s}>
                  {M.statuses[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={report.isFetching}>
            {M.apply}
          </Button>
        </div>
        {form.formState.errors.to && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {form.formState.errors.to.message}
          </p>
        )}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OperationalSectionHeader
          title={M.reportTypes[filters.type] ?? M.reports}
          icon={FileChartColumn}
        />
        <Button
          loading={download.isPending}
          title={form.formState.isDirty ? M.exportPendingFilters : M.export}
          disabled={
            download.isPending || form.formState.isDirty || report.isError || report.isPending
          }
          onClick={() => download.mutate()}
        >
          <Download size={16} aria-hidden="true" />
          {M.export}
        </Button>
      </div>
      {form.formState.isDirty && <p className="text-xs text-amber-800">{M.exportPendingFilters}</p>}
      {download.isError && (
        <p role="alert" className="text-sm text-red-700">
          {managementError(download.error)}
        </p>
      )}
      {report.isPending ? (
        <LoadingState variant="table" />
      ) : report.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => report.refetch()} />
      ) : !report.data.length ? (
        <EmptyState title={M.empty} description={M.emptyHint} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="p-4 text-left text-xs text-slate-600">{M.preview}</caption>
            <thead className="bg-slate-50">
              <tr>
                {[M.subject, M.result, M.detail].map((label) => (
                  <th key={label} className="px-5 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.data.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <th scope="row" className="px-5 py-4">
                    {row.label}
                  </th>
                  <td className="px-5 py-4 text-right font-medium tabular-nums">
                    {M.statuses[row.value] ?? row.value}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
