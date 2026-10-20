"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsOverview } from "../hooks/use-operations-overview";
import { useOperationsRevenue } from "../hooks/use-operations-revenue";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { formatDateTimeVn, formatMoney, getDefaultPeriod } from "../operations.utils";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
import { FacilityRevenueChart } from "./charts/facility-revenue-chart";
import { FacilityUtilizationDonutChart } from "./charts/facility-utilization-donut-chart";
import { OperationsFinancialChart } from "./charts/operations-financial-chart";

export function OperationsDashboardView() {
  const [showPreview, setShowPreview] = useState(false);
  const period = getDefaultPeriod();
  const [from, setFrom] = useState(period.from),
    [to, setTo] = useState(period.to);
  const [facilityId, setFacilityId] = useState("all"),
    [unitTypeId, setUnitTypeId] = useState("all");
  const { facilities, unitTypes } = useOperationsCatalogOptions();
  const filter = { from, to, facilityId, unitTypeId };
  const query = useOperationsOverview(filter);
  const preview = useOperationsRevenue({ ...filter, limit: 5, offset: 0 });
  const data = query.data;
  const reportParams = new URLSearchParams({ from, to });
  if (facilityId !== "all") reportParams.set("facilityId", facilityId);
  if (unitTypeId !== "all") reportParams.set("unitTypeId", unitTypeId);
  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-3 rounded-card border border-outline-variant bg-white p-5 sm:grid-cols-2 lg:grid-cols-5">
        <FieldShell label={M.fromDateLabel}>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </FieldShell>
        <FieldShell label={M.toDateLabel}>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </FieldShell>
        <FieldShell label={M.facilityFilter}>
          <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="all">{M.allFacilities}</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FieldShell>
        <FieldShell label={M.unitTypeFilter}>
          <Select value={unitTypeId} onChange={(e) => setUnitTypeId(e.target.value)}>
            <option value="all">{M.allUnitTypes}</option>
            {unitTypes.map((t) => (
              <option key={t.unitTypeId} value={t.unitTypeId}>
                {t.name}
              </option>
            ))}
          </Select>
        </FieldShell>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const p = getDefaultPeriod();
            setFrom(p.from);
            setTo(p.to);
            setFacilityId("all");
            setUnitTypeId("all");
          }}
        >
          {M.reset}
        </Button>
      </section>
      {query.isPending ? (
        <LoadingState label={M.loading} />
      ) : query.isError || !data ? (
        <ErrorState message={M.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <p className="text-xs text-slate-600">
            {M.periodDisplay(data.period.from, data.period.to)}
          </p>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <OperationsFinancialChart metrics={data.summary.financial} />
            <FacilityUtilizationDonutChart metrics={data.summary.inventory} />
          </div>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-white p-4 text-sm">
            <div>
              <span className="block text-xs text-slate-600">{R.held}</span>
              <strong>
                {data.summary.financial.depositHeld === null
                  ? R.unknown
                  : formatMoney(data.summary.financial.depositHeld)}
              </strong>
            </div>
            <Link
              className="min-h-11 py-2 font-semibold text-primary underline"
              href={`${routes.reports}?tab=refunds`}
            >
              {R.pending}: {formatMoney(data.attention.refunds.amount)} (
              {data.attention.refunds.count})
            </Link>
            <span className="text-xs text-slate-500">
              {R.current} · {formatDateTimeVn(data.asOf)}
            </span>
          </section>
          {data.attention.dataQuality.hasIssues && (
            <Link
              className="min-h-11 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              href={`${routes.reports}?tab=reconciliation`}
            >
              {R.unknown} · {M.actionViewReconciliation}
            </Link>
          )}
        </>
      )}
      <details
        className="rounded-card border border-outline-variant bg-white p-4"
        onToggle={(event) => setShowPreview(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">
          {R.facilityPreview}
        </summary>
        {showPreview &&
          (preview.isPending ? (
            <LoadingState label={M.loading} />
          ) : preview.isError || !preview.data ? (
            <ErrorState message={M.error} onRetry={() => void preview.refetch()} />
          ) : (
            <FacilityRevenueChart
              items={preview.data.items}
              totalFacilities={preview.data.total}
              limit={5}
            />
          ))}
        <Link
          href={`${routes.revenue}?${reportParams}`}
          className="inline-block min-h-11 py-3 text-sm font-semibold text-primary underline"
        >
          {M.titles.revenue}
        </Link>
      </details>
    </div>
  );
}
