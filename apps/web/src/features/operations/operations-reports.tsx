import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import { operationsRentalSamples } from "./operations.mock";
import type { OperationsReportProps } from "./operations.types";
import { formatPercentage } from "./operations.utils";
import { OperationsMetric, OperationsTable } from "./operations-parts";

export function OperationsReports({
  section,
  facilities,
  totals,
  unitTypeId,
}: Readonly<OperationsReportProps>) {
  if (section === "reports" || section === "dashboard") {
    const samples = operationsRentalSamples.filter(
      (item) =>
        facilities.some((facility) => facility.id === item.facilityId) &&
        (unitTypeId === "all" || item.unitTypeId === unitTypeId),
    );
    return (
      <div className="grid min-w-0 gap-6">
        {section === "dashboard" && (
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <OperationsMetric label={M.rent} value={formatCurrency(totals.rentalCollected)} />
            <OperationsMetric
              label={M.occupancy}
              value={formatPercentage(totals.occupancy)}
              detail={M.ratio}
            />
            <OperationsMetric label={M.deposit} value={formatCurrency(totals.depositHeld)} />
          </div>
        )}
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          {(["revenue", "utilization"] as const).map((key) => (
            <section
              key={key}
              className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
            >
              <h2 className="text-xl font-bold text-primary">{M.titles[key]}</h2>
              <p className="my-4 text-sm text-slate-600">{M.reportCards[key]}</p>
              <Link href={routes[key]} className={buttonClassName("primary")}>
                {M.view}
              </Link>
            </section>
          ))}
        </div>
        <section className="min-w-0">
          <h2 className="mb-2 text-xl font-bold">{M.rentalSummary}</h2>
          <p className="mb-5 text-sm text-slate-600">{M.rentalHelp}</p>
          <OperationsTable label={M.rentalSummary} headings={M.rentalHeadings}>
            {samples.map((sample) => (
              <tr key={sample.id}>
                <th scope="row" className="px-5 py-4">
                  {sample.id}
                </th>
                <td className="px-5 py-4">
                  {facilities.find((item) => item.id === sample.facilityId)?.name}
                </td>
                <td className="whitespace-nowrap px-5 py-4">{formatDate(sample.expiresAt)}</td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      sample.status === "overdue"
                        ? "bg-rose-50 text-rose-900"
                        : sample.status === "expiring"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-primary-soft text-primary",
                    )}
                  >
                    {M.rentalStatuses[sample.status]}
                  </span>
                </td>
              </tr>
            ))}
          </OperationsTable>
        </section>
      </div>
    );
  }
  const capacity = section === "utilization";
  const metrics = capacity
    ? ([
        [M.occupied, totals.occupied],
        [M.available, totals.available],
        [M.reserved, totals.reserved],
        [M.maintenance, totals.maintenance],
      ] as const)
    : ([
        [M.rent, formatCurrency(totals.rentalCollected)],
        [M.deposit, formatCurrency(totals.depositHeld)],
      ] as const);
  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <OperationsMetric key={label} label={label} value={value} />
        ))}
      </div>
      <section className="rounded-card border border-outline-variant bg-primary-soft p-5 text-primary">
        {capacity && (
          <h2 className="text-lg font-bold">
            {M.occupancy}: {formatPercentage(totals.occupancy)} ({totals.occupied}/{totals.total})
          </h2>
        )}
        <p className="m-0 text-sm">{capacity ? M.capacityHelp : M.revenueHelp}</p>
        {capacity && <p className="mb-0 mt-2 text-sm font-semibold">{M.ratio}</p>}
      </section>
      <OperationsTable
        label={M.titles[capacity ? "utilization" : "revenue"]}
        headings={capacity ? M.capacityHeadings : M.revenueHeadings}
      >
        {facilities.map((item) => (
          <tr key={item.id}>
            <th scope="row" className="min-w-48 px-5 py-4 font-semibold">
              {item.name}
            </th>
            {(capacity
              ? (["total", "occupied", "available", "reserved", "maintenance"] as const)
              : (["rentalCollected", "depositHeld"] as const)
            ).map((field) => (
              <td key={field} className="whitespace-nowrap px-5 py-4 tabular-nums">
                {capacity ? item[field] : formatCurrency(item[field])}
              </td>
            ))}
            <td className="min-w-40 px-5 py-4 text-primary">
              <strong className="tabular-nums">
                {formatPercentage(
                  capacity
                    ? (item.occupied / item.total) * 100
                    : totals.rentalCollected
                      ? (item.rentalCollected / totals.rentalCollected) * 100
                      : 0,
                )}
              </strong>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${capacity ? (item.occupied / item.total) * 100 : totals.rentalCollected ? (item.rentalCollected / totals.rentalCollected) * 100 : 0}%`,
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </OperationsTable>
    </div>
  );
}
