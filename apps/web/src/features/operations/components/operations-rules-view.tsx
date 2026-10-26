"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  History,
  RefreshCw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
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
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { type OperationsDepositDraft, OperationsDepositDraftSchema } from "../operations.schema";
import { formatDateTimeVn, formatMoney } from "../operations.utils";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";

const REFERENCE_BUSINESS_POLICIES = R.policyRules;

export function OperationsRulesView() {
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
      <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">{M.depositPolicy}</h2>
              <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                Cấu hình trực tiếp
              </span>
            </div>
            <p className="m-0 text-xs text-slate-600 mt-1">{M.depositHelpReal}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-md bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {M.currentVersion}:{" "}
              <strong className="font-bold text-primary">v{config.version}</strong>
            </span>
            <span className="text-slate-500">
              {M.updatedAtLabel}: {formatDateTimeVn(config.updatedAt)}
            </span>
            <Button
              type="button"
              variant="outline"
              icon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={handleConflictReload}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {/* Clear Formula Explanation Card */}
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          <p className="font-semibold text-ink mb-1">Quy tắc tính tiền cọc khi tạo đặt chỗ:</p>
          <p className="font-mono text-xs font-bold text-primary">
            Tiền cọc = Giá thuê 1 tháng của loại kho × Hệ số cọc ({config.depositMonths} tháng)
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            * Thay đổi hệ số cọc chỉ áp dụng cho các báo giá và booking tạo mới. Không làm thay đổi
            số tiền cọc đã snapshot trong hợp đồng cũ.
          </p>
        </div>

        {feedback && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-primary-soft p-4 text-sm font-semibold text-primary"
          >
            {feedback}
          </p>
        )}

        {mutationError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
          >
            {mutationError}
          </div>
        )}

        {conflictError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle size={18} className="text-amber-600" />
              <span>{M.conflictTitle}</span>
            </div>
            <p className="mt-1 text-xs">{conflictError}</p>
            <p className="mt-2 text-xs font-medium text-amber-950">
              Phiên bản trên máy chủ hiện tại: <strong>v{config.version}</strong> (Hệ số cọc:{" "}
              {config.depositMonths} tháng). Nội dung nháp của bạn được giữ nguyên trong ô nhập bên
              dưới để đối chiếu.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 text-xs"
              onClick={handleConflictReload}
            >
              {M.conflictReload}
            </Button>
          </div>
        )}

        <form
          noValidate
          className="grid gap-4 max-w-md"
          onSubmit={depositForm.handleSubmit(handleSaveDeposit)}
        >
          <p className="text-xs text-slate-600">
            {R.latestDeposit(config.depositMonths, config.version)}
          </p>
          <FieldShell
            label={M.depositMonthsField}
            error={depositForm.formState.errors.depositMonths?.message}
          >
            <div className="flex items-center gap-3">
              <Input
                aria-label={M.depositMonthsField}
                type="number"
                min={1}
                step={1}
                className="w-32"
                {...depositForm.register("depositMonths", { valueAsNumber: true })}
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

      {/* Area 2: History of changes */}
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
          <LoadingState label={M.loading} variant="table" />
        ) : isHistoryError ? (
          <ErrorState
            message="Không thể tải dữ liệu lịch sử thay đổi giá & cọc từ máy chủ."
            onRetry={() => void refetchHistory()}
          />
        ) : !history || history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 rounded-card border border-outline-variant bg-surface-container-lowest">
            Chưa có lịch sử thay đổi.
          </p>
        ) : (
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/95 border-b border-slate-200">
                <TableRow className="hover:bg-transparent">
                  {M.historyHeadingsReal.map((heading) => (
                    <TableHead
                      key={heading}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
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
                    <TableRow key={change.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="px-4 py-2.5 font-mono font-bold text-xs text-primary whitespace-nowrap">
                        v{change.version}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTimeVn(change.changedAt)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs font-mono text-slate-700 whitespace-nowrap">
                        {change.changedBy}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 whitespace-nowrap">
                        <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-[11px] px-2 py-0.5">
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

      {/* Area 3: Reference Business Policies (Collapsible, document-sourced, NOT mock) */}
      <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <button
          type="button"
          onClick={() => setShowReferencePolicies((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={showReferencePolicies}
        >
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-slate-500" />
            <div>
              <h3 className="text-sm font-bold text-ink">Chính sách nghiệp vụ tham khảo</h3>
              <p className="m-0 text-xs text-slate-500">
                Nội dung tài liệu dự án • Chưa hỗ trợ API cấu hình tự động
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary">
            <span>{showReferencePolicies ? "Thu gọn" : "Xem chi tiết"}</span>
            {showReferencePolicies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showReferencePolicies && (
          <div className="mt-4 border-t border-outline-variant pt-4">
            <p className="text-xs text-slate-600 mb-3">{R.policySource}</p>
            <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
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
                        className="px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                      >
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REFERENCE_BUSINESS_POLICIES.map((rule) => (
                    <TableRow key={rule.name} className="hover:bg-slate-50/60 transition-colors">
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
                          className={`text-xs font-semibold px-2 py-0.5 ${
                            rule.isTbd
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
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
      </section>
    </div>
  );
}
