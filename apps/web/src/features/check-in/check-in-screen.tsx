"use client";
import { UserRole } from "@metastorage/database/schema/user-enums";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Clock3,
  CreditCard,
  Mail,
  Phone,
  Search,
  User,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Currency } from "@/components/ui/display";
import { OperationalBadge } from "@/components/ui/operational";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { facilityStaffRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { AssignmentScreen } from "@/features/facility-flow/assignment-screen";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { BackLabel, FlowHelp } from "@/features/facility-flow/flow-ui";
import { InspectionScreen } from "@/features/facility-flow/inspection-screen";
import { flowError, useCheckInFlow } from "@/features/facility-flow/use-check-in-flow";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
export function CheckInScreen() {
  return (
    <Suspense fallback={<LoadingState label={FLOW.loading} />}>
      <CheckInRoute />
    </Suspense>
  );
}
function CheckInRoute() {
  const view = useSearchParams().get("view");
  const role = useAuthStore((s) => s.session?.user.role);
  const assign = view === "assign" && role === UserRole.FACILITY_MANAGER;
  return assign ? <AssignmentScreen /> : <CheckInFlowScreen />;
}
function CheckInFlowScreen() {
  const flow = useCheckInFlow();
  const router = useRouter();
  const user = useAuthStore((s) => s.session?.user);
  const root = user?.role === UserRole.FACILITY_MANAGER ? "/facility-manager" : "/staff";
  const returnTo =
    user?.role === UserRole.FACILITY_STAFF
      ? facilityStaffRoutes.tasks
      : `${root}/tasks?view=appointments`;
  const [lookupType, setLookupType] = useState<"BOOKING_CODE" | "QR_TOKEN">("BOOKING_CODE");
  const [input, setInput] = useState("");
  const result = flow.result;
  const reasons = result?.checkInReadiness.reasons ?? [];
  const inspectionStarted = Boolean(flow.current);
  const wantsInspection = ["inspect", "review", "handover"].includes(flow.view);
  const locked = flow.current?.status === "PASSED" || flow.current?.status === "FAILED";
  const passed = flow.current?.status === "PASSED";
  const inspectionView = passed ? "handover" : flow.view === "handover" ? "review" : flow.view;
  const active = wantsInspection && inspectionStarted ? (passed ? 3 : 2) : 1;
  const completedHandover = wantsInspection && passed && result?.booking.status === "CHECKED_IN";
  const title = completedHandover
    ? FLOW.handoverResultTitle
    : active === 3
      ? FLOW.handoverTitle
      : active === 2
        ? inspectionView === "review"
          ? FLOW.reviewTitle
          : FLOW.conditionTitle
        : FLOW.verifyTitle;
  const criteria = [
    !!result && !reasons.includes("INVALID_BOOKING_STATUS"),
    result?.payment.status === "SUCCEEDED",
    !!result?.assignedUnit,
    !!result?.booking.checkInSlotStart && !!result?.booking.checkInSlotEnd,
    !reasons.includes("TOO_EARLY") &&
      !reasons.includes("DEADLINE_PASSED") &&
      !!result?.booking.checkInSlotEnd,
  ];
  function proceed() {
    flow.verify.mutate();
  }
  if (user?.role === UserRole.FACILITY_MANAGER)
    return (
      <div className="space-y-4">
        {/* Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={returnTo}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{FLOW.back}</span>
          </Link>
          {result && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500">
                {result.booking.bookingCode}
              </span>
              <OperationalBadge
                value={result.booking.status}
                label={FLOW.statusLabels[result.booking.status]}
              />
            </div>
          )}
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {FLOW.monitor}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">{FLOW.managerMonitorHint}</p>
        </div>

        {flow.lookup.isLoading ? (
          <LoadingState label={FLOW.loading} variant="detail" />
        ) : flow.lookup.isError ? (
          <ErrorState
            message={flowError(flow.lookup.error)}
            onRetry={() => flow.lookup.refetch()}
          />
        ) : !result ? (
          <Card className="border-slate-200 bg-white p-6 text-center shadow-xs">
            <p className="text-sm text-slate-600">{FLOW.managerMonitorHint}</p>
            <div className="mt-4">
              <Link
                href={returnTo}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{FLOW.back}</span>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {/* Hero Booking & Assigned Unit Highlight Card */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-4 sm:p-5 gap-4">
                {/* Left: Customer & Booking Info */}
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60">
                    <User className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {result.booking.contactName}
                      </h2>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                        {result.booking.bookingCode}
                      </span>
                      <OperationalBadge
                        value={result.booking.status}
                        label={FLOW.statusLabels[result.booking.status]}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">
                          {result.booking.contactPhone}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5 text-slate-400" />
                        <span>{result.booking.contactEmail}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-slate-400" />
                        <span>{FLOW.months(result.booking.requestedMonths)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Assigned Physical Unit Box + Prominent Action Button */}
                <div className="flex shrink-0 items-center">
                  {result.assignedUnit ? (
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-3 sm:px-4 sm:py-3 shadow-2xs w-full lg:w-auto">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
                          <Warehouse className="size-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                              {FLOW.assignedPhysicalUnit}
                            </span>
                            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <p className="font-mono text-lg font-extrabold tracking-tight text-slate-900">
                            {result.assignedUnit.physicalUnitCode}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {result.booking.unitTypeName} · {result.booking.unitTypeSizeLabel}
                          </p>
                        </div>
                      </div>

                      {result.booking.status === "CONFIRMED" && (
                        <Link
                          href={`${root}/check-in?view=assign&bookingId=${result.booking.id}&bookingCode=${encodeURIComponent(result.booking.bookingCode)}`}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-900 active:scale-[0.98] transition-all cursor-pointer ring-1 ring-emerald-700"
                        >
                          <ArrowLeftRight className="size-3.5" />
                          <span>{FLOW.reassign}</span>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-3 sm:px-4 sm:py-3 shadow-2xs w-full lg:w-auto">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-xs">
                          <Boxes className="size-4.5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                            {FLOW.unassigned}
                          </span>
                          <p className="text-xs font-medium text-amber-700">
                            {FLOW.needPhysicalUnit}
                          </p>
                        </div>
                      </div>

                      {result.booking.status === "CONFIRMED" && (
                        <Link
                          href={`${root}/check-in?view=assign&bookingId=${result.booking.id}&bookingCode=${encodeURIComponent(result.booking.bookingCode)}`}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Boxes className="size-3.5" />
                          <span>{FLOW.assign}</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* 2-Column Grid: Customer Dossier & Payment */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left Card: Customer & Rental Dossier */}
              <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-3.5 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-emerald-800" />
                      <CardTitle className="text-sm font-bold text-slate-900">
                        {FLOW.dossier}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-slate-200 text-[10px] text-slate-500"
                    >
                      {result.booking.unitTypeName}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3.5">
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.phone}
                      </span>
                      <span className="mt-0.5 block font-bold text-slate-800">
                        {result.booking.contactPhone}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.email}
                      </span>
                      <span className="mt-0.5 block font-semibold text-slate-800 truncate">
                        {result.booking.contactEmail}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.unitDetails}
                      </span>
                      <span className="mt-0.5 block font-bold text-slate-800">
                        {result.booking.unitTypeName} · {result.booking.unitTypeSizeLabel}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.period}
                      </span>
                      <span className="mt-0.5 block font-bold text-slate-800">
                        {FLOW.months(result.booking.requestedMonths)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.slotStart}
                      </span>
                      <span className="mt-0.5 block font-semibold text-slate-800">
                        {formatDateTime(result.booking.checkInSlotStart)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.slotEnd}
                      </span>
                      <span className="mt-0.5 block font-semibold text-slate-800">
                        {formatDateTime(result.booking.checkInSlotEnd)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.deadline}
                      </span>
                      <span className="mt-0.5 block font-semibold text-slate-800">
                        {formatDateTime(result.booking.checkInDeadlineAt)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.rentalEnd}
                      </span>
                      <span className="mt-0.5 block font-semibold text-slate-800">
                        {formatDateTime(result.booking.rentalEndAt)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Card: Payment Summary */}
              <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-3.5 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-emerald-800" />
                      <CardTitle className="text-sm font-bold text-slate-900">
                        {FLOW.payment}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        result.payment.status === "SUCCEEDED"
                          ? "border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-800 gap-1"
                          : "border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800 gap-1"
                      }
                    >
                      {result.payment.status === "SUCCEEDED" ? (
                        <>
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          <span>{FLOW.paid}</span>
                        </>
                      ) : (
                        <span>{FLOW.unpaid}</span>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3.5 space-y-3">
                  {/* Highlighted Total Amount Banner */}
                  <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-slate-50 p-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-slate-500">{FLOW.amount}</span>
                        <p className="mt-0.5 text-2xl font-black tracking-tight text-emerald-900">
                          {result.payment.totalAmount === null ? (
                            "—"
                          ) : (
                            <Currency value={result.payment.totalAmount} />
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-500">
                          {FLOW.paidAt}
                        </span>
                        <p className="mt-0.5 text-xs font-semibold text-slate-700">
                          {formatDateTime(result.payment.paidAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.rentalFee}
                      </span>
                      <span className="mt-1 block font-bold text-slate-800 text-sm">
                        {result.payment.rentalFeeAmount === null ? (
                          "—"
                        ) : (
                          <Currency value={result.payment.rentalFeeAmount} />
                        )}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                      <span className="block text-[11px] font-medium text-slate-500">
                        {FLOW.deposit}
                      </span>
                      <span className="mt-1 block font-bold text-slate-800 text-sm">
                        {result.payment.depositAmount === null ? (
                          "—"
                        ) : (
                          <Currency value={result.payment.depositAmount} />
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Inspection & Handover Records */}
            {flow.history.isLoading ? (
              <LoadingState label={FLOW.loading} variant="table" />
            ) : flow.history.isError ? (
              <ErrorState message={FLOW.loadHistoryError} onRetry={() => flow.history.refetch()} />
            ) : flow.history.data?.length ? (
              flow.history.data.map((record) => (
                <InspectionScreen
                  key={record.id}
                  record={record}
                  result={result}
                  view="history"
                  readOnly
                  onNavigate={() => {}}
                  onBack={() => router.push(returnTo)}
                />
              ))
            ) : (
              <Card className="border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{FLOW.notInspected}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{FLOW.inspectStaffOnly}</p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    );
  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            {FLOW.flowTitle}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        </div>
      </div>

      {/* Steps Indicator */}
      {!completedHandover && (
        <ol className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs lg:grid-cols-4">
          {FLOW.stepNames.map((name, i) => {
            const completed = [
              ...(result?.assignedUnit ? [0] : []),
              ...(inspectionStarted ? [1] : []),
              ...(locked ? [2] : []),
              ...(result?.booking.status === "CHECKED_IN" ? [3] : []),
            ];
            const isDone = completed.includes(i);
            const isCurrent = i === active;
            return (
              <li
                key={name}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg p-2 transition-all",
                  isCurrent
                    ? "bg-slate-50 ring-1 ring-slate-200"
                    : isDone
                      ? "bg-emerald-50/40"
                      : "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold",
                    isDone
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-500",
                  )}
                >
                  {isDone ? <Check size={14} /> : String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {isDone ? FLOW.done : isCurrent ? FLOW.current : FLOW.next}
                  </p>
                  <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Contextual help only rendered on initial blank search screen (E2E test compliance) */}
      {!result && <FlowHelp />}

      {/* Lookup Form */}
      {!wantsInspection && (
        <Card className="border-slate-200 bg-white shadow-2xs">
          <form
            className="flex flex-wrap items-center gap-2.5 p-2.5"
            onSubmit={(ev) => {
              ev.preventDefault();
              flow.search(lookupType, input);
            }}
          >
            <div className="w-40 shrink-0">
              <Select
                value={lookupType}
                onValueChange={(val) => setLookupType(val as "BOOKING_CODE" | "QR_TOKEN")}
              >
                <SelectTrigger
                  aria-label={FLOW.lookupType}
                  className="h-8.5 rounded-lg border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus-visible:border-primary"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOOKING_CODE">{FLOW.bookingCode}</SelectItem>
                  <SelectItem value="QR_TOKEN">{FLOW.qr}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative min-w-[240px] flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                aria-label={lookupType === "QR_TOKEN" ? FLOW.qr : FLOW.bookingCode}
                className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                required
                autoComplete="off"
                value={input}
                onChange={(ev) => setInput(ev.target.value)}
                placeholder={
                  lookupType === "QR_TOKEN" ? FLOW.qrPlaceholder : FLOW.lookupPlaceholder
                }
              />
            </div>
            <Button
              type="submit"
              loading={flow.lookup.isFetching}
              className="h-8.5 px-3.5 text-xs font-semibold"
              icon={<Search size={13} />}
            >
              {FLOW.lookup}
            </Button>
          </form>
        </Card>
      )}

      {flow.lookup.isLoading ? (
        <LoadingState label={FLOW.loading} variant="detail" />
      ) : flow.lookup.isError ? (
        <ErrorState message={flowError(flow.lookup.error)} onRetry={() => flow.lookup.refetch()} />
      ) : !result ? (
        <Card className="border-slate-200 bg-white p-12 text-center shadow-2xs">
          <Search className="mx-auto text-slate-400" size={32} />
          <h2 className="mt-3 text-sm font-bold text-slate-900">{FLOW.emptyTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{FLOW.emptyHint}</p>
        </Card>
      ) : wantsInspection && inspectionStarted ? (
        flow.history.isLoading ? (
          <LoadingState label={FLOW.loading} variant="table" />
        ) : flow.history.isError && !flow.history.data ? (
          <ErrorState message={FLOW.loadHistoryError} onRetry={() => flow.history.refetch()} />
        ) : flow.current ? (
          <InspectionScreen
            key={flow.current.id}
            record={flow.current}
            result={result}
            view={inspectionView}
            onNavigate={flow.navigate}
            onBack={() => (locked ? router.push(returnTo) : flow.navigate("verify"))}
          />
        ) : (
          <Card className="border-slate-200 bg-white p-8 text-center shadow-2xs">
            <ClipboardCheck className="mx-auto mb-3 text-primary" size={36} />
            <h2 className="text-base font-bold text-slate-900">{FLOW.baseline}</h2>
            <p className="my-2 text-xs text-slate-600">{FLOW.requirement}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => flow.navigate("verify")}
                className="h-8.5 px-3.5 text-xs font-semibold"
              >
                {FLOW.backVerify}
              </Button>
              <Button
                onClick={() => flow.start.mutate()}
                loading={flow.start.isPending}
                className="h-8.5 px-4 text-xs font-bold"
              >
                {FLOW.continueInspect}
              </Button>
            </div>
          </Card>
        )
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-stretch">
          {/* Left Column: Customer Dossier & Physical Unit */}
          <div className="flex flex-col gap-3">
            <Card className="flex flex-1 flex-col border-slate-200 bg-white shadow-2xs">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800">
                    <User size={13} />
                  </span>
                  <span className="font-semibold text-slate-600">{FLOW.dossier}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800 px-2 py-0.5"
                  >
                    {FLOW.statusLabels[result.booking.status] ?? FLOW.pendingStep}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5",
                      result.payment.status === "SUCCEEDED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800",
                    )}
                  >
                    {result.payment.status === "SUCCEEDED" ? FLOW.paid : FLOW.unpaid}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-3.5 space-y-3 text-xs">
                {/* Customer Name */}
                <div>
                  <h2 className="text-base font-bold text-slate-900 truncate">
                    {result.booking.contactName}
                  </h2>
                </div>

                {/* Contact & Booking Facts */}
                <div className="grid grid-cols-2 gap-2.5 rounded-lg bg-slate-50/80 p-2.5 text-xs border border-slate-100">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      {FLOW.phone}
                    </span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Phone size={11} className="text-slate-400" />
                      {result.booking.contactPhone}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      {FLOW.booking}
                    </span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {result.booking.bookingCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      {FLOW.email}
                    </span>
                    <span className="font-medium text-slate-700 truncate mt-0.5 block">
                      {result.booking.contactEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      {FLOW.amount}
                    </span>
                    <span className="font-bold text-primary mt-0.5 block">
                      {result.payment.totalAmount === null ? (
                        "—"
                      ) : (
                        <Currency value={result.payment.totalAmount} />
                      )}
                    </span>
                  </div>
                </div>

                {/* Assigned Physical Unit */}
                <div className="rounded-lg border border-primary/20 bg-primary-soft/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-white">
                        <Warehouse size={14} />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-primary block">
                          {FLOW.assigned}
                        </span>
                        <span className="font-mono text-base font-bold text-slate-900">
                          {result.assignedUnit?.physicalUnitCode ?? FLOW.unassigned}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-800">{result.booking.unitTypeName}</p>
                      <p className="text-slate-500">
                        {result.booking.unitTypeSizeLabel} ·{" "}
                        {FLOW.months(result.booking.requestedMonths)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Slot Timing */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock3 size={12} className="text-slate-400" />
                    <span>
                      Hẹn đến:{" "}
                      <strong className="text-slate-700">
                        {formatDateTime(result.booking.checkInSlotStart)}
                      </strong>
                    </span>
                  </div>
                  <div>
                    <span>
                      Hạn chót:{" "}
                      <strong className="text-slate-700">
                        {formatDateTime(result.booking.checkInDeadlineAt)}
                      </strong>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: 5 Reception Conditions & Action */}
          <div className="flex flex-col gap-3">
            <Card className="flex flex-1 flex-col border-slate-200 bg-white shadow-2xs">
              <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ClipboardCheck size={15} className="text-primary" />
                  <span>{FLOW.conditions}</span>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                  {criteria.filter(Boolean).length} / 5
                </Badge>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                <div className="space-y-1.5">
                  {FLOW.criteria.map((text, i) => (
                    <div
                      key={text}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-2.5 py-1.5 text-xs border border-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {criteria[i] ? (
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                        ) : (
                          <CircleAlert size={15} className="shrink-0 text-rose-500" />
                        )}
                        <span className="font-medium text-slate-800 truncate">
                          {i + 1}. {text}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-semibold shrink-0",
                          criteria[i] ? "text-emerald-700" : "text-rose-600",
                        )}
                      >
                        {criteria[i] ? FLOW.done : FLOW.notEligible}
                      </span>
                    </div>
                  ))}
                </div>

                {reasons.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900">
                    <p className="font-semibold text-amber-950">{FLOW.notEligible}:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px]">
                      {reasons.map((r) => (
                        <li key={r}>
                          <strong>{FLOW.reasons[r] ?? FLOW.notEligible}</strong>
                          {FLOW.reasonActions[r] && (
                            <span className="block text-slate-600">{FLOW.reasonActions[r]}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(returnTo)}
                    className="h-9 px-4 text-xs font-semibold"
                  >
                    <BackLabel />
                  </Button>
                  <Button
                    disabled={
                      result.booking.status === "CHECKED_IN"
                        ? !flow.current
                        : !inspectionStarted && !result.checkInReadiness.canProceed
                    }
                    loading={flow.verify.isPending}
                    onClick={proceed}
                    className="h-9 px-4 text-xs font-bold"
                    icon={<ArrowRight size={14} />}
                  >
                    {inspectionStarted ? FLOW.continueInspect : FLOW.verifyProceed}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
