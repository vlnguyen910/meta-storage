"use client";

import { AlertTriangle, History, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { operationsRules } from "../operations.mock";
import { formatDateTimeVn, formatMoney } from "../operations.utils";
import { OperationsTable } from "../operations-parts";

interface DepositFormValues {
  depositMonths: number;
}

export function OperationsRulesView() {
  const { configQuery, historyQuery, updateDepositMutation, conflictError, reloadData } =
    useOperationsPricing();

  const [feedback, setFeedback] = useState<string | null>(null);

  const depositForm = useForm<DepositFormValues>();

  const {
    data: config,
    isPending: isConfigPending,
    isError: isConfigError,
    refetch: refetchConfig,
  } = configQuery;
  const { data: history, isPending: isHistoryPending } = historyQuery;

  useEffect(() => {
    if (config?.depositMonths !== undefined) {
      depositForm.reset({ depositMonths: config.depositMonths });
    }
  }, [config?.depositMonths, depositForm]);

  if (isConfigPending) return <LoadingState label={M.loading} />;
  if (isConfigError || !config) {
    return <ErrorState message={M.error} onRetry={() => void refetchConfig()} />;
  }

  async function handleSaveDeposit(values: DepositFormValues) {
    if (!config) return;
    try {
      await updateDepositMutation.mutateAsync({
        expectedVersion: config.version,
        depositMonths: values.depositMonths,
      });
      setFeedback(M.depositUpdated);
    } catch {
      // 409 Conflict is captured in hook state
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      {/* Deposit Policy Configuration Card */}
      <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink">{M.depositPolicy}</h2>
            <p className="m-0 text-xs text-slate-600 mt-1">{M.depositHelpReal}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-md bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {M.currentVersion}:{" "}
              <strong className="font-bold text-primary">{config.version}</strong>
            </span>
            <span className="text-slate-500">
              {M.updatedAtLabel}: {formatDateTimeVn(config.updatedAt)}
            </span>
            <Button
              type="button"
              variant="outline"
              icon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={reloadData}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {feedback && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-primary-soft p-4 text-sm font-semibold text-primary"
          >
            {feedback}
          </p>
        )}

        {conflictError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
          >
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle size={18} className="text-amber-600" />
              <span>{M.conflictTitle}</span>
            </div>
            <p className="mt-1 text-sm">{conflictError}</p>
            <Button type="button" variant="outline" className="mt-3 text-xs" onClick={reloadData}>
              {M.conflictReload}
            </Button>
          </div>
        )}

        <form
          noValidate
          className="grid gap-4 max-w-md"
          onSubmit={depositForm.handleSubmit(handleSaveDeposit)}
        >
          <FieldShell
            label={M.depositMonthsField}
            error={depositForm.formState.errors.depositMonths?.message}
          >
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={24}
                step={1}
                className="w-32"
                {...depositForm.register("depositMonths", {
                  valueAsNumber: true,
                  required: M.required,
                  min: { value: 1, message: "Hệ số cọc tối thiểu là 1 tháng" },
                  max: { value: 24, message: "Tối đa 24 tháng" },
                })}
              />
              <span className="text-sm font-semibold text-slate-700">{M.depositMonthsUnit}</span>
            </div>
          </FieldShell>

          <div>
            <Button
              type="submit"
              icon={<Save size={16} aria-hidden="true" />}
              loading={updateDepositMutation.isPending}
            >
              {M.savePricing}
            </Button>
          </div>
        </form>
      </section>

      {/* History of changes */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <History size={20} className="text-primary" />
              {M.pricingHistoryTitle}
            </h2>
            <p className="m-0 text-xs text-slate-600">{M.pricingHistoryDescription}</p>
          </div>
        </div>

        {isHistoryPending ? (
          <LoadingState label="Đang tải lịch sử thay đổi..." />
        ) : !history || history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 rounded-card border border-outline-variant bg-surface-container-lowest">
            Chưa có lịch sử thay đổi.
          </p>
        ) : (
          <OperationsTable label={M.pricingHistoryTitle} headings={M.historyHeadingsReal}>
            {history.map((change) => {
              const isDeposit = change.operation === "DEPOSIT_POLICY";
              let changeDetail = "";
              if (isDeposit) {
                const beforeMonths =
                  "depositMonths" in change.before ? change.before.depositMonths : "?";
                const afterMonths =
                  "depositMonths" in change.after ? change.after.depositMonths : "?";
                changeDetail = `${beforeMonths} tháng cọc → ${afterMonths} tháng cọc`;
              } else {
                const beforePrice =
                  "monthlyPrice" in change.before ? formatMoney(change.before.monthlyPrice) : "?";
                const afterPrice =
                  "monthlyPrice" in change.after ? formatMoney(change.after.monthlyPrice) : "?";
                changeDetail = `${beforePrice} → ${afterPrice}`;
              }

              return (
                <tr key={change.id} className="hover:bg-slate-50/50">
                  <th
                    scope="row"
                    className="px-5 py-4 font-mono font-bold text-primary whitespace-nowrap"
                  >
                    v{change.version}
                  </th>
                  <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                    {formatDateTimeVn(change.changedAt)}
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                    {change.changedBy}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                      {isDeposit ? M.opDeposit : M.opPrice}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums text-ink">
                    {changeDetail}
                  </td>
                </tr>
              );
            })}
          </OperationsTable>
        )}
      </section>

      {/* General Rules Reference Table */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">{M.titles["business-rules"]}</h2>
          <p className="m-0 text-xs text-slate-600">{M.rulesHelp}</p>
        </div>
        <OperationsTable label={M.titles["business-rules"]} headings={M.ruleHeadings}>
          {operationsRules.map((rule) => (
            <tr key={rule.name} className="hover:bg-slate-50/50">
              <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">
                {rule.group}
              </td>
              <th scope="row" className="min-w-40 px-5 py-4 font-bold text-ink">
                {rule.name}
              </th>
              <td className="min-w-64 max-w-xl px-5 py-4 text-slate-700 leading-relaxed text-xs">
                {rule.value}
              </td>
              <td className="whitespace-nowrap px-5 py-4">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  {rule.confirmed ? M.confirmed : M.tbd}
                </span>
              </td>
            </tr>
          ))}
        </OperationsTable>
      </section>
    </div>
  );
}
