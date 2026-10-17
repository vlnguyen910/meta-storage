"use client";
import { UserRole } from "@metastorage/contracts";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Search,
  User,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Currency } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { AssignmentScreen } from "@/features/facility-flow/assignment-screen";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { FLOW_ASSETS } from "@/features/facility-flow/flow-assets";
import {
  BackLabel,
  FlowButton as Button,
  DataPair,
  FlowHeading,
  FlowHelp,
  inputClass,
  Panel,
  Pill,
  SectionTitle,
  Steps,
  titleClass,
} from "@/features/facility-flow/flow-ui";
import { InspectionScreen } from "@/features/facility-flow/inspection-screen";
import { flowError, useCheckInFlow } from "@/features/facility-flow/use-check-in-flow";
import { formatDateTime } from "@/lib/format";
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
  const [lookupType, setLookupType] = useState<"BOOKING_CODE" | "QR_TOKEN">("BOOKING_CODE");
  const [input, setInput] = useState("");
  const result = flow.result;
  const reasons = result?.eligibility.reasons ?? [];
  const verified =
    result?.verification?.staffId === user?.id &&
    ["VERIFIED", "CONSUMED"].includes(result?.verification?.status ?? "");
  const wantsInspection = ["inspect", "review", "handover"].includes(flow.view);
  const locked = flow.current?.status === "COMPLETED";
  const inspectionView = locked ? "handover" : flow.view === "handover" ? "review" : flow.view;
  const active = wantsInspection && verified ? (locked ? 3 : 2) : 1;
  const title =
    active === 3
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
        <FlowHeading title={FLOW.monitor} description={FLOW.managerMonitorHint} />
        {flow.lookup.isLoading ? (
          <LoadingState label={FLOW.loading} />
        ) : flow.lookup.isError ? (
          <ErrorState
            message={flowError(flow.lookup.error)}
            onRetry={() => flow.lookup.refetch()}
          />
        ) : !result ? (
          <Panel>
            <p>{FLOW.managerMonitorHint}</p>
            <Link href={`${root}/dashboard`} className="underline">
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
              <Pill>{FLOW.statusLabels[result.booking.status]}</Pill>
              <div className="mt-4 flex gap-3">
                <Button variant="secondary" onClick={() => router.push(`${root}/dashboard`)}>
                  <BackLabel />
                </Button>
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
                    {formatDateTime(result.booking.graceEndsAt)}
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
              <LoadingState label={FLOW.loading} />
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
                  onBack={() => router.push(`${root}/dashboard`)}
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
    <>
      <FlowHeading title={title} />
      <Steps
        active={active}
        completed={[
          ...(result?.assignedUnit ? [0] : []),
          ...(verified ? [1] : []),
          ...(locked ? [2] : []),
          ...(flow.current?.handedOverAt ? [3] : []),
        ]}
      />
      <FlowHelp />
      {!wantsInspection && (
        <Panel>
          <form
            className="grid items-start gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]"
            onSubmit={(ev) => {
              ev.preventDefault();
              flow.search(lookupType, input);
            }}
          >
            <label>
              <span className="mb-2 block text-xs font-semibold">{FLOW.lookupType}</span>
              <select
                value={lookupType}
                onChange={(ev) => setLookupType(ev.target.value as "BOOKING_CODE" | "QR_TOKEN")}
                className={inputClass}
              >
                <option value="BOOKING_CODE">{FLOW.bookingCode}</option>
                <option value="QR_TOKEN">{FLOW.qr}</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">
                {lookupType === "QR_TOKEN" ? FLOW.qr : FLOW.bookingCode}
              </span>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-[#707975]" size={20} />
                <input
                  className={`${inputClass} pl-10`}
                  required
                  autoComplete="off"
                  value={input}
                  onChange={(ev) => setInput(ev.target.value)}
                  placeholder={
                    lookupType === "QR_TOKEN" ? FLOW.qrPlaceholder : FLOW.lookupPlaceholder
                  }
                />
              </div>
              <span className="mt-2 block text-[11px] text-[#707975]">{FLOW.lookupHint}</span>
            </label>
            <Button
              type="submit"
              className="sm:mt-6"
              loading={flow.lookup.isFetching}
              icon={<Search size={18} />}
            >
              {FLOW.lookup}
            </Button>
          </form>
        </Panel>
      )}
      {flow.lookup.isLoading ? (
        <LoadingState label={FLOW.loading} />
      ) : flow.lookup.isError ? (
        <ErrorState message={flowError(flow.lookup.error)} onRetry={() => flow.lookup.refetch()} />
      ) : !result ? (
        <Panel className="py-16 text-center">
          <Search className="mx-auto text-[#306858]" size={40} />
          <h2 className={`${titleClass} mt-5 text-xl`}>{FLOW.emptyTitle}</h2>
          <p className="mt-2 text-sm text-[#707975]">{FLOW.emptyHint}</p>
        </Panel>
      ) : wantsInspection && verified ? (
        flow.history.isLoading ? (
          <LoadingState label={FLOW.loading} />
        ) : flow.history.isError ? (
          <ErrorState message={FLOW.loadHistoryError} onRetry={() => flow.history.refetch()} />
        ) : flow.current ? (
          <InspectionScreen
            key={flow.current.id}
            record={flow.current}
            result={result}
            view={inspectionView}
            onNavigate={flow.navigate}
            onBack={() => (locked ? router.push(`${root}/dashboard`) : flow.navigate("verify"))}
          />
        ) : (
          <Panel className="py-12 text-center">
            <ClipboardCheck className="mx-auto mb-4 text-[#306858]" size={40} />
            <h2 className={`${titleClass} text-xl`}>{FLOW.baseline}</h2>
            <p className="my-4 text-sm text-[#707975]">{FLOW.requirement}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => flow.navigate("verify")}>
                {FLOW.backVerify}
              </Button>
              <Button onClick={() => flow.start.mutate()} loading={flow.start.isPending}>
                {FLOW.continueInspect}
              </Button>
            </div>
          </Panel>
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: FLOW.bookingStatus,
                value: FLOW.statusLabels[result.booking.status] ?? FLOW.pendingStep,
                tone: "neutral" as const,
                icon: BadgeCheck,
              },
              {
                label: FLOW.payment,
                value: result.payment.status === "SUCCEEDED" ? FLOW.paid : FLOW.unpaid,
                tone:
                  result.payment.status === "SUCCEEDED" ? ("green" as const) : ("amber" as const),
                icon: CheckCircle2,
              },
              {
                label: FLOW.receptionStatus,
                value: verified
                  ? FLOW.verified
                  : result.eligibility.canProceed
                    ? FLOW.eligible
                    : FLOW.notEligible,
                tone:
                  verified || result.eligibility.canProceed
                    ? ("green" as const)
                    : ("amber" as const),
                icon: User,
              },
              {
                label: FLOW.conditionStatus,
                value: locked ? FLOW.locked : FLOW.notInspected,
                tone: locked ? ("green" as const) : ("amber" as const),
                icon: ClipboardCheck,
              },
            ].map(({ label, value, tone, icon: Icon }) => (
              <Panel key={label}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-[#404945]">
                    {label}
                  </span>
                  <Icon size={20} className="text-[#306858]" />
                </div>
                <div className="mt-4">
                  <Pill tone={tone}>{value}</Pill>
                </div>
              </Panel>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="space-y-4">
              <Panel>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded bg-[#125345] text-white">
                    <User size={24} />
                  </span>
                  <div>
                    <p className="text-[11px] text-[#707975]">{FLOW.dossier}</p>
                    <h2 className={`${titleClass} text-xl`}>{result.booking.contactName}</h2>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 rounded bg-[#f2f3ff] p-3 sm:grid-cols-2">
                  <DataPair label={FLOW.phone}>{result.booking.contactPhone}</DataPair>
                  <DataPair label={FLOW.booking}>{result.booking.bookingCode}</DataPair>
                  <DataPair label={FLOW.email}>{result.booking.contactEmail}</DataPair>
                  <DataPair label={FLOW.amount}>
                    {result.payment.totalAmount === null ? (
                      "—"
                    ) : (
                      <Currency value={result.payment.totalAmount} />
                    )}
                  </DataPair>
                </div>
              </Panel>
              <Panel>
                <SectionTitle icon={<Warehouse size={22} />}>{FLOW.unitDetails}</SectionTitle>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                  <div className="grid h-36 shrink-0 place-items-center rounded bg-[#f2f3ff] text-[#306858] sm:w-44">
                    <Image
                      src={FLOW_ASSETS.allocated}
                      alt="Ảnh minh họa không gian kho"
                      width={176}
                      height={144}
                      unoptimized
                      className="h-36 w-full rounded object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase text-[#306858]">{FLOW.assigned}</p>
                    <h3 className={`${titleClass} mt-1 text-[28px] text-[#003b2f]`}>
                      {result.assignedUnit?.physicalUnitCode ?? FLOW.unassigned}
                    </h3>
                    <p className="mt-2 text-sm">{result.booking.unitTypeName}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded bg-[#f2f3ff] p-2 text-xs">
                        {FLOW.size}
                        <strong className="mt-1 block">{result.booking.unitTypeSizeLabel}</strong>
                      </div>
                      <div className="rounded bg-[#f2f3ff] p-2 text-xs">
                        {FLOW.period}
                        <strong className="mt-1 block">
                          {FLOW.months(result.booking.requestedMonths)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel>
                <div className="flex flex-wrap justify-between gap-2">
                  <SectionTitle icon={<ClipboardCheck size={22} />}>{FLOW.conditions}</SectionTitle>
                  <Pill>{criteria.filter(Boolean).length} / 5</Pill>
                </div>
                <div className="mt-4 space-y-2">
                  {FLOW.criteria.map((text, i) => (
                    <div key={text} className="flex items-start gap-3 rounded bg-[#f2f3ff] p-3">
                      {criteria[i] ? (
                        <CheckCircle2 size={22} className="shrink-0 text-[#306858]" />
                      ) : (
                        <CircleAlert size={22} className="shrink-0 text-[#ba1a1a]" />
                      )}
                      <div>
                        <p className="text-sm font-semibold">
                          {i + 1}. {text}
                        </p>
                        <p className="mt-1 text-xs text-[#707975]">
                          {criteria[i] ? FLOW.done : FLOW.notEligible}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <SectionTitle icon={<CalendarClock size={20} />}>{FLOW.timeline}</SectionTitle>
                <div className="my-4 flex h-3 overflow-hidden rounded-full">
                  <span className="w-1/3 bg-[#306858]" />
                  <span className="w-1/3 bg-[#b4efda]" />
                  <span className="w-1/3 bg-[#e2e7ff]" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { label: FLOW.slotStart, value: result.booking.checkInSlotStart },
                    { label: FLOW.slotEnd, value: result.booking.checkInSlotEnd },
                    { label: FLOW.deadline, value: result.booking.graceEndsAt },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <strong>{formatDateTime(value)}</strong>
                      <p className="mt-1 text-[11px] text-[#707975]">{label}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
          {reasons.length > 0 && (
            <Panel className="bg-[#ffdcc3]/40">
              <h2 className="font-semibold text-[#6e3900]">{FLOW.notEligible}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#6e3900]">
                {reasons.map((r) => (
                  <li key={r}>
                    <strong>{FLOW.reasons[r] ?? FLOW.notEligible}</strong>
                    {FLOW.reasonActions[r] && <p className="mt-1">{FLOW.reasonActions[r]}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {verified && flow.history.isError && (
            <ErrorState message={FLOW.loadHistoryError} onRetry={() => flow.history.refetch()} />
          )}
          <Panel className="flex flex-wrap justify-between gap-3">
            <Button variant="secondary" onClick={() => router.push(`${root}/dashboard`)}>
              <BackLabel />
            </Button>
            <Button
              disabled={
                result.booking.status === "CHECKED_IN"
                  ? !flow.current
                  : !verified && !result.eligibility.canProceed
              }
              loading={flow.verify.isPending}
              onClick={proceed}
              icon={<ArrowRight size={18} />}
            >
              {verified ? FLOW.continueInspect : FLOW.verifyProceed}
            </Button>
          </Panel>
        </>
      )}
    </>
  );
}
