"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  FileText,
  History,
  RefreshCw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldShell } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { type OperationsDepositDraft, OperationsDepositDraftSchema } from "../operations.schema";
import { formatDateTimeVn, formatMoney } from "../operations.utils";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";

const REFERENCE_BUSINESS_POLICIES = R.policyRules;

export function OperationsRulesView() {
  const { showToast } = useToast();
  const [historyPage, setHistoryPage] = useState(1);
  const {
    configQuery,
    historyQuery,
    updateDepositMutation,
    conflictError,
    mutationError,
    setConflictError,
    setMutationError,
    reloadData,
  } = useOperationsPricing();

  const [feedback, setFeedback] = useState<string | null>(null);
  const [showReferencePolicies, setShowReferencePolicies] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);

  const depositForm = useForm<OperationsDepositDraft>({
    resolver: zodResolver(OperationsDepositDraftSchema),
    defaultValues: { depositMonths: 1 },
  });

  const { data: config, isPending: isConfigPending, refetch: refetchConfig } = configQuery;

  const {
    data: history,
    isPending: isHistoryPending,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = historyQuery;
  const safeHistoryPage = Math.min(
    historyPage,
    Math.max(1, Math.ceil((history?.length ?? 0) / 10)),
  );

  // Initialize and safely sync baseVersion without overwriting user's dirty edits
  useEffect(() => {
    if (config?.depositMonths !== undefined) {
      if (!depositForm.formState.isDirty) {
        setBaseVersion(config.version);
        depositForm.reset({ depositMonths: config.depositMonths });
      }
    }
  }, [config, depositForm]);

  if (isConfigPending) return <LoadingState label={M.loading} variant="form" />;
  if (!config) {
    return <ErrorState message={M.error} onRetry={() => void refetchConfig()} />;
  }

  async function handleSaveDeposit(values: OperationsDepositDraft) {
    if (!config || baseVersion === null) return;
    setFeedback(null);
    setMutationError(null);
    setConflictError(null);

    try {
      const saved = await updateDepositMutation.mutateAsync({
        expectedVersion: baseVersion,
        depositMonths: values.depositMonths,
      });
      setFeedback(M.depositUpdated);
      showToast(M.depositUpdated, "success");
      setBaseVersion(saved.version);
      depositForm.reset(values);
    } catch {
      // 409 Conflict or other mutation errors are tracked in hook state
    }
  }

  async function handleConflictReload() {
    setFeedback(null);
    try {
      const latest = await reloadData();
      setBaseVersion(latest.version);
      setFeedback(R.compareVersion);
    } catch {
      setMutationError(R.reloadError);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      {/* Area 1: Active Live Deposit Policy Configuration Card */}
      <Card className="border-slate-200/90 shadow-2xs">
        <CardHeader className="p-5 pb-4 border-b border-slate-100 flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-[#e8f3ef] text-[#165f4d] shrink-0">
                <Coins className="size-4" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                {M.depositPolicy}
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold px-2.5 py-0.5"
              >
                Cấu hình trực tiếp
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1 max-w-2xl">
              {M.depositHelpReal}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              {M.currentVersion}:{" "}
              <strong className="font-bold text-[#165f4d]">v{config.version}</strong>
            </span>
            <span className="text-slate-500 font-medium">
              {M.updatedAtLabel}: {formatDateTimeVn(config.updatedAt)}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={handleConflictReload}
              className="h-8 px-3 text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:border-[#165f4d] hover:text-[#165f4d] hover:bg-[#e8f3ef]/40 cursor-pointer shadow-2xs transition-colors"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Làm mới
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Formula Explanation Callout */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-700">
            <p className="font-semibold text-slate-900 mb-1">
              Quy tắc tính tiền cọc khi tạo đặt chỗ:
            </p>
            <p className="font-mono text-xs font-bold text-[#165f4d] bg-white px-3 py-1.5 rounded-lg border border-slate-200/70 inline-block">
              Tiền cọc = Giá thuê 1 tháng của loại kho × Hệ số cọc ({config.depositMonths} tháng)
            </p>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              * Thay đổi hệ số cọc chỉ áp dụng cho các báo giá và booking tạo mới. Không làm thay
              đổi số tiền cọc đã snapshot trong hợp đồng cũ.
            </p>
          </div>

          {feedback && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-900 shadow-2xs"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}

          {mutationError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 shadow-2xs"
            >
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
              <span>{mutationError}</span>
            </div>
          )}

          {conflictError && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-2xs space-y-2"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                <AlertTriangle className="size-4.5 text-amber-600 shrink-0" />
                <span>{M.conflictTitle}</span>
              </div>
              <p className="text-xs leading-relaxed">{conflictError}</p>
              <p className="text-xs font-medium text-amber-900/90">
                Phiên bản trên máy chủ hiện tại: <strong>v{config.version}</strong> (Hệ số cọc:{" "}
                {config.depositMonths} tháng). Nội dung nháp của bạn được giữ nguyên trong ô nhập
                bên dưới để đối chiếu.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-8 px-3 text-xs font-semibold border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 cursor-pointer"
                onClick={handleConflictReload}
              >
                {M.conflictReload}
              </Button>
            </div>
          )}

          <form
            noValidate
            className="grid gap-4 max-w-md pt-1"
            onSubmit={depositForm.handleSubmit(handleSaveDeposit)}
          >
            <p className="text-xs text-slate-600 font-medium">
              {R.latestDeposit(config.depositMonths, config.version)}
            </p>
            <FieldShell
              label={M.depositMonthsField}
              error={depositForm.formState.errors.depositMonths?.message}
            >
              <div className="flex items-center gap-3">
                <input
                  aria-label={M.depositMonthsField}
                  type="number"
                  min={1}
                  step={1}
                  className="w-28 h-9 px-3 text-sm font-bold text-slate-900 rounded-lg border border-slate-200 bg-white focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] focus:outline-none transition-all tabular-nums shadow-2xs"
                  {...depositForm.register("depositMonths", { valueAsNumber: true })}
                />
                <span className="text-xs font-semibold text-slate-700">{M.depositMonthsUnit}</span>
              </div>
            </FieldShell>

            <div>
              <Button
                type="submit"
                loading={updateDepositMutation.isPending}
                disabled={updateDepositMutation.isPending}
                className="h-10 px-5 text-xs font-semibold gap-2 bg-[#165f4d] hover:bg-[#0f493b] text-white cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                <Save className="size-4" aria-hidden="true" />
                {M.savePricing}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Area 2: History of changes */}
      <section className="grid gap-3.5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="size-4.5 text-[#165f4d]" />
              {M.pricingHistoryTitle}
            </h2>
            <p className="m-0 text-xs text-slate-500 mt-0.5">{M.pricingHistoryDescription}</p>
          </div>
        </div>

        {isHistoryPending ? (
          <LoadingState label={M.loading} variant="table" />
        ) : isHistoryError ? (
          <ErrorState
            message="Không thể tải dữ liệu lịch sử thay đổi giá & cọc từ máy chủ."
            onRetry={() => void refetchHistory()}
          />
        ) : !history || history.length === 0 ? (
          <div className="py-8 text-center text-xs font-medium text-slate-500 rounded-xl border border-slate-200 bg-white shadow-2xs">
            Chưa có lịch sử thay đổi.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/95 border-b border-slate-200">
                <TableRow className="hover:bg-transparent">
                  {M.historyHeadingsReal.map((heading) => (
                    <TableHead
                      key={heading}
                      className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap"
                    >
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice((safeHistoryPage - 1) * 10, safeHistoryPage * 10).map((change) => {
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
                      "monthlyPrice" in change.before
                        ? formatMoney(change.before.monthlyPrice)
                        : "?";
                    const afterPrice =
                      "monthlyPrice" in change.after ? formatMoney(change.after.monthlyPrice) : "?";
                    changeDetail = `${beforePrice} → ${afterPrice}`;
                  }

                  return (
                    <TableRow
                      key={change.id}
                      className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
                    >
                      <TableCell className="px-4 py-2.5 font-mono font-bold text-xs text-[#165f4d] whitespace-nowrap">
                        v{change.version}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTimeVn(change.changedAt)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {change.user.name}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="bg-slate-50 text-slate-700 border-slate-200 text-[11px] font-semibold px-2 py-0.5"
                        >
                          {isDeposit ? M.opDeposit : M.opPrice}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs font-semibold tabular-nums text-slate-900">
                        {changeDetail}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {!isHistoryPending && !isHistoryError && (
          <ListPagination
            label={M.pricingHistoryTitle}
            page={safeHistoryPage}
            pageSize={10}
            total={history?.length ?? 0}
            onPageChange={setHistoryPage}
          />
        )}
      </section>

      {/* Area 3: Reference Business Policies (Collapsible) */}
      <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowReferencePolicies((prev) => !prev)}
          className="flex w-full items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer select-none"
          aria-expanded={showReferencePolicies}
        >
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
              <FileText className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Chính sách nghiệp vụ tham khảo</h3>
              <p className="m-0 text-xs text-slate-500">
                Nội dung tài liệu dự án • Chưa hỗ trợ API cấu hình tự động
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#165f4d]">
            <span>{showReferencePolicies ? "Thu gọn" : "Xem chi tiết"}</span>
            {showReferencePolicies ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </div>
        </button>

        {showReferencePolicies && (
          <div className="border-t border-slate-200 p-4 sm:p-5 pt-4 bg-slate-50/40">
            <p className="text-xs text-slate-600 mb-3 font-medium">{R.policySource}</p>
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/95 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent">
                    {[
                      "Nhóm quy tắc",
                      "Tên quy tắc",
                      "Nội dung quy định",
                      "Trạng thái nghiệp vụ",
                    ].map((heading) => (
                      <TableHead
                        key={heading}
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap"
                      >
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REFERENCE_BUSINESS_POLICIES.map((rule) => (
                    <TableRow
                      key={rule.name}
                      className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
                    >
                      <TableCell className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-600 text-xs">
                        {rule.group}
                      </TableCell>
                      <TableCell className="min-w-40 px-4 py-2.5 font-bold text-slate-900 text-xs">
                        {rule.name}
                      </TableCell>
                      <TableCell className="min-w-64 max-w-xl px-4 py-2.5 text-slate-700 leading-relaxed text-xs">
                        {rule.value}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5",
                            rule.isTbd
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200",
                          )}
                        >
                          {rule.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
