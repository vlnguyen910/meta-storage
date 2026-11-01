"use client";
import { UserRole } from "@metastorage/database/schema/user-enums";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Currency } from "@/components/ui/display";
import {
  OperationalBackLink,
  OperationalBadge,
  OperationalPageHeader,
} from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { facilityStaffRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { AssignmentScreen } from "@/features/facility-flow/assignment-screen";
import { FLOW } from "@/features/facility-flow/flow.messages";
import {
  BackLabel,
  DataPair,
  FlowHelp,
  Panel,
  Pill,
  SectionTitle,
} from "@/features/facility-flow/flow-ui";
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
      <>
        <OperationalBackLink href={returnTo}>{FLOW.back}</OperationalBackLink>
        <OperationalPageHeader title={FLOW.monitor} description={FLOW.managerMonitorHint} />
        {flow.lookup.isLoading ? (
          <LoadingState label={FLOW.loading} variant="detail" />
        ) : flow.lookup.isError ? (
          <ErrorState
            message={flowError(flow.lookup.error)}
            onRetry={() => flow.lookup.refetch()}
          />
        ) : !result ? (
          <Panel>
            <p>{FLOW.managerMonitorHint}</p>
            <Link href={returnTo} className="underline">
              {FLOW.back}
            </Link>
          </Panel>
        ) : (
          <>
            <Panel>
              <SectionTitle>{result.booking.contactName}</SectionTitle>
              <p className="mt-2">
                {result.booking.bookingCode} ·{" "}
                {result.assignedUnit?.physicalUnitCode ?? FLOW.unassigned}
              </p>
              <OperationalBadge
                value={result.booking.status}
                label={FLOW.statusLabels[result.booking.status]}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                {result.booking.status === "CONFIRMED" && (
                  <Link
                    className="rounded bg-[#b4efda] p-3 font-semibold"
                    href={`${root}/check-in?view=assign&bookingId=${result.booking.id}&bookingCode=${encodeURIComponent(result.booking.bookingCode)}`}
                  >
                    {result.assignedUnit ? FLOW.reassign : FLOW.assign}
                  </Link>
                )}
              </div>
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel className="space-y-4">
                <SectionTitle icon={<User size={20} />}>{FLOW.dossier}</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DataPair label={FLOW.phone}>{result.booking.contactPhone}</DataPair>
                  <DataPair label={FLOW.email}>{result.booking.contactEmail}</DataPair>
                  <DataPair label={FLOW.unitDetails}>
                    {result.booking.unitTypeName} · {result.booking.unitTypeSizeLabel}
                  </DataPair>
                  <DataPair label={FLOW.period}>
                    {FLOW.months(result.booking.requestedMonths)}
                  </DataPair>
                  <DataPair label={FLOW.slotStart}>
                    {formatDateTime(result.booking.checkInSlotStart)}
                  </DataPair>
                  <DataPair label={FLOW.slotEnd}>
                    {formatDateTime(result.booking.checkInSlotEnd)}
                  </DataPair>
                  <DataPair label={FLOW.deadline}>
                    {formatDateTime(result.booking.checkInDeadlineAt)}
                  </DataPair>
                  <DataPair label={FLOW.rentalEnd}>
                    {formatDateTime(result.booking.rentalEndAt)}
                  </DataPair>
                </div>
              </Panel>
              <Panel className="space-y-4">
                <SectionTitle icon={<CheckCircle2 size={20} />}>{FLOW.payment}</SectionTitle>
                <Pill tone={result.payment.status === "SUCCEEDED" ? "green" : "amber"}>
                  {result.payment.status === "SUCCEEDED" ? FLOW.paid : FLOW.unpaid}
                </Pill>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DataPair label={FLOW.rentalFee}>
                    {result.payment.rentalFeeAmount === null ? (
                      "—"
                    ) : (
                      <Currency value={result.payment.rentalFeeAmount} />
                    )}
                  </DataPair>
                  <DataPair label={FLOW.deposit}>
                    {result.payment.depositAmount === null ? (
                      "—"
                    ) : (
                      <Currency value={result.payment.depositAmount} />
                    )}
                  </DataPair>
                  <DataPair label={FLOW.amount}>
                    {result.payment.totalAmount === null ? (
                      "—"
                    ) : (
                      <Currency value={result.payment.totalAmount} />
                    )}
                  </DataPair>
                  <DataPair label={FLOW.paidAt}>{formatDateTime(result.payment.paidAt)}</DataPair>
                </div>
              </Panel>
            </div>
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
              <Panel>
                <p>{FLOW.notInspected}</p>
                <p className="mt-2 text-sm">{FLOW.inspectStaffOnly}</p>
              </Panel>
            )}
          </>
        )}
      </>
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
            <div className="w-36 shrink-0">
              <select
                aria-label={FLOW.lookupType}
                value={lookupType}
                onChange={(ev) => setLookupType(ev.target.value as "BOOKING_CODE" | "QR_TOKEN")}
                className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
              >
                <option value="BOOKING_CODE">{FLOW.bookingCode}</option>
                <option value="QR_TOKEN">{FLOW.qr}</option>
              </select>
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
