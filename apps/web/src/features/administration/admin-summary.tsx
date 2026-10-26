"use client";
import { KeyRound, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { systemAdministratorRoutes as routes } from "@/config/routes";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import { useCustomerRegistrations } from "./use-customer-registrations";

export function AdminSummary() {
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const registrations = useCustomerRegistrations(year);
  const metrics = [
    {
      label: M.totalUsers,
      value: registrations.data?.summary.totalUsers,
      href: routes.users,
      icon: UsersRound,
    },
    {
      label: M.activeUsers,
      value: registrations.data?.summary.activeUsers,
      href: routes.users,
      icon: UserRoundCheck,
    },
    {
      label: M.lockedUsers,
      value: registrations.data?.summary.inactiveUsers,
      href: routes.users,
      icon: KeyRound,
    },
    {
      label: M.pendingAssignments,
      value: registrations.data?.summary.unassignedFacilityUsers,
      href: routes.facilityAssignments,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid min-w-0 gap-7">
      <section aria-label={M.totalUsers} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            href={metric.href}
            className="rounded-card outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
            key={metric.label}
          >
            <Card className="flex h-full min-h-40 flex-col justify-between rounded-card border-line bg-white p-6 shadow-card transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <p className="m-0 text-sm font-semibold text-slate-600">{metric.label}</p>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <metric.icon size={21} aria-hidden="true" />
                </span>
              </div>
              <p className="m-0 font-['Space_Grotesk'] text-[40px] font-bold leading-none tracking-tight text-ink">
                {metric.value?.toLocaleString("vi-VN") ?? "—"}
              </p>
            </Card>
          </Link>
        ))}
      </section>

      <Card
        aria-label={M.customerChart}
        className="min-w-0 rounded-card border-line bg-white p-5 shadow-card sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <div>
            <h2 className="m-0 font-['Space_Grotesk'] text-xl font-bold text-ink sm:text-2xl">
              {M.customerChart}
            </h2>
            <p className="mb-0 mt-1 text-sm text-slate-600">{M.customerChartDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {registrations.data && (
              <Badge className="border-emerald-200 bg-primary-soft px-3 py-1 text-primary">
                {registrations.data.items
                  .reduce((sum, item) => sum + item.count, 0)
                  .toLocaleString("vi-VN")}{" "}
                {M.customerChartValue.toLowerCase()}
              </Badge>
            )}
            <NativeSelect
              aria-label={M.customerChartYear}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="min-w-32 border-line bg-white text-ink focus-visible:border-primary focus-visible:ring-primary/25"
            >
              {(registrations.data?.years ?? [year]).map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {M.customerChartYearOption(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        {registrations.isLoading && (
          <p role="status" className="mt-6 text-sm text-slate-600">
            {M.customerChartLoading}
          </p>
        )}
        {registrations.isError && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span>{M.customerChartError}</span>
            <Button variant="outline" onClick={() => registrations.refetch()}>
              {M.customerChartRetry}
            </Button>
          </div>
        )}
        {registrations.data && (
          <>
            <div className="mt-5 rounded-xl border border-line bg-canvas p-3 sm:p-5">
              <ChartContainer
                config={{ count: { label: M.customerChartValue, color: "#165f4d" } }}
                className="h-[300px] w-full aspect-auto"
              >
                <LineChart
                  data={registrations.data.items}
                  margin={{ left: 0, right: 16 }}
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={M.customerChartMonthTick}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    minTickGap={12}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => M.customerChartMonth(String(label))}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            </div>
            {registrations.data.items.every((item) => item.count === 0) && (
              <p className="mb-0 mt-3 text-sm text-slate-600">{M.customerChartEmpty(year)}</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
