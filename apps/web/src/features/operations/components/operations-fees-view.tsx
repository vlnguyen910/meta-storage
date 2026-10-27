"use client";

import { ConfigureSystemSettingSchema, type SystemSettingDto } from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Coins, History, Info, Percent, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { F3 } from "@/features/returns/integration.messages";
import { integrationError } from "@/features/returns/integration-utils";
import { SystemSettingFields } from "@/features/returns/system-setting-fields";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { formatDateTimeVn } from "../operations.utils";
import { FEES_MESSAGES as FM } from "../operations-fees.messages";

export function OperationsFeesView() {
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["system-settings", identity],
    queryFn: ({ signal }) => api.systemSettings.list(signal),
  });

  if (query.isPending) return <LoadingState label={M.loading} variant="form" />;
  if (query.isError) {
    return (
      <ErrorState message={integrationError(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  const overdueSetting = query.data?.find((s) => s.key === "OVERDUE_FEE_RATE");

  if (!overdueSetting) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900"
      >
        {F3.unavailable}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 pb-3">
      {/* 4 Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {/* Card 1: Overdue Rate */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-xs font-medium">{FM.currentRate}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Percent className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {String(overdueSetting.value)}%
              </span>
              <Badge
                variant="outline"
                className="border-slate-200 py-0 text-[10px] font-normal text-slate-500"
              >
                {FM.versionBadge(overdueSetting.version)}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{FM.rateAppliedSubtitle}</p>
          </div>
        </Card>

        {/* Card 2: Deposit Policy */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-xs font-medium">{FM.depositPolicyTitle}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-sm font-bold tracking-tight text-slate-900">1 tháng tiền thuê</p>
            <Link
              href={routes.rules}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <span>{FM.viewBusinessRules}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        {/* Card 3: Extra Fee & Damages */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-xs font-medium">{FM.extraFeeTitle}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-sm font-bold tracking-tight text-slate-900">
              Theo thực tế nghiệm thu
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{FM.extraFeeSubtitle}</p>
          </div>
        </Card>

        {/* Card 4: System Scope */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-xs font-medium">Trạng thái áp dụng</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-sm font-bold tracking-tight text-emerald-700">{FM.statusActive}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{FM.statusGlobal}</p>
          </div>
        </Card>
      </div>

      {/* Main Setting Editor Component */}
      <OverdueFeeRateSettingCard setting={overdueSetting} />
      <Card className="border-slate-200 bg-white p-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle>{FM.operatingHoursTitle}</CardTitle>
          <CardDescription>{FM.operatingHoursDescription}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SystemSettingFields keys={["OPENING_HOUR", "CLOSING_HOUR"]} />
        </CardContent>
      </Card>

      {/* Business Policy Reference Notice Card */}
      <Card className="border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Info className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{F3.financeHelp}</span>
          </div>
          <Link
            href={routes.rules}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <span>{FM.viewBusinessRules}</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function OverdueFeeRateSettingCard({ setting }: { setting: SystemSettingDto }) {
  const identity = useFlow3Identity();
  const client = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const form = useForm<{ value: number }>({
    defaultValues: { value: Number(setting.value) },
  });

  // Keep form values in sync when server setting updates (unless dirty)
  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset({ value: Number(setting.value) });
    }
  }, [setting.value, form]);

  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: async (values: { value: number }) => {
      const input = ConfigureSystemSettingSchema.safeParse({
        key: setting.key,
        value: values.value,
        expectedVersion: setting.version,
      });
      if (!input.success) {
        form.setError("value", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.systemSettings.update(input.data);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["system-settings"] }),
  });

  const history = useInfiniteQuery({
    queryKey: ["system-settings", "history", identity, setting.key],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.systemSettings.history(setting.key, pageParam, signal),
    getNextPageParam: (last, pages) => (last.length === 20 ? pages.length * 20 : undefined),
    enabled: showHistory,
  });

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 p-3.5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              {FM.overdueFeeRateTitle}
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs text-slate-500">
              {FM.overdueFeeRateDescription}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-slate-200 py-0.5 text-xs font-normal text-slate-500"
          >
            {FM.versionBadge(setting.version)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 pt-3">
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => {
            form.clearErrors();
            mutation.mutate(values);
          })}
        >
          {/* Form Input Group */}
          <div className="max-w-md">
            <label htmlFor="overdue-rate-input" className="block text-xs font-bold text-slate-900">
              {FM.overdueFeeRateLabel}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="overdue-rate-input"
                  aria-label={FM.overdueFeeRateLabel}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-semibold text-slate-900 shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  {...form.register("value", { valueAsNumber: true, required: true })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">
                  %
                </span>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                loading={mutation.isPending}
                disabled={mutation.isPending}
                className="h-9 min-h-0 px-4 text-xs font-semibold"
              >
                {F3.save}
              </Button>

              {/* History Toggle Button */}
              <Button
                type="button"
                variant="outline"
                aria-expanded={showHistory}
                onClick={() => setShowHistory((v) => !v)}
                className="h-9 min-h-0 gap-1.5 border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <History className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>{showHistory ? FM.historyHide : FM.historyShow}</span>
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{FM.overdueFeeRateHelp}</p>
          </div>

          {/* Validation & Mutation Error Alert */}
          {(form.formState.errors.value || mutation.isError) && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800 shadow-xs"
            >
              {form.formState.errors.value?.message ?? integrationError(mutation.error)}
            </div>
          )}

          {/* Success Status Notice */}
          {mutation.isSuccess && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 shadow-xs"
            >
              {F3.saved}
            </div>
          )}
        </form>

        {/* Change History Section */}
        {showHistory && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{FM.historyTitle}</h4>
                <p className="text-[11px] text-slate-500">{FM.historySubtitle}</p>
              </div>
            </div>

            {history.isPending ? (
              <LoadingState label={M.loading} variant="table" />
            ) : history.isError ? (
              <ErrorState
                message={integrationError(history.error)}
                onRetry={() => void history.refetch()}
              />
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="border-b border-slate-200 bg-slate-50/90">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-3 py-2 text-xs font-semibold text-slate-700">
                        {FM.historyOldValue}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-slate-700">
                        {FM.historyNewValue}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-slate-700">
                        {FM.historyUpdatedAt}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-slate-700">
                        {FM.historyActor}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!history.data.pages.flat().length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-4 text-center text-xs text-slate-500">
                          {F3.noHistory}
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.data.pages.flat().map((entry) => (
                        <TableRow key={entry.id} className="transition-colors hover:bg-slate-50/60">
                          <TableCell className="px-3 py-2 text-xs font-mono text-slate-500">
                            {String(entry.before.value)}%
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs font-bold font-mono text-emerald-700">
                            {String(entry.after.value)}%
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                            {formatDateTimeVn(new Date(entry.createdAt).toISOString())}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-500 font-mono">
                            {entry.actorId}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {history.hasNextPage && (
              <div className="mt-2 text-center">
                <Button
                  type="button"
                  variant="outline"
                  loading={history.isFetchingNextPage}
                  onClick={() => void history.fetchNextPage()}
                  className="h-7 min-h-0 px-3 text-xs"
                >
                  {F3.loadMore}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
