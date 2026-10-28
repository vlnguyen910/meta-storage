"use client";
import { UserRole } from "@metastorage/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Warehouse } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Currency } from "@/components/ui/display";
import { OperationalBackLink, OperationalPageHeader } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  useAssignPhysicalUnitMutation,
  useBooking,
  useEligibleUnits,
} from "@/features/check-in/hooks";
import { formatDateTime } from "@/lib/format";
import { FLOW } from "./flow.messages";
import {
  BackLabel,
  FlowButton as Button,
  DataPair,
  inputClass,
  Panel,
  Pill,
  SectionTitle,
  titleClass,
} from "./flow-ui";
import { ReassignmentDialog } from "./reassignment-dialog";
import type { UnitAssignmentConfirmation } from "./reassignment-dialog.types";
import { flowError } from "./use-check-in-flow";
export function AssignmentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = useSearchParams().get("bookingId") ?? "";
  const booking = useBooking(id);
  const units = useEligibleUnits(id);
  const mutation = useAssignPhysicalUnitMutation();
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<UnitAssignmentConfirmation | null>(null);
  const { showToast } = useToast();
  const role = useAuthStore((s) => s.session?.user.role);
  const current = selected || booking.data?.assignedUnit?.physicalUnitId || "";
  const chosen = units.data?.find((u) => u.id === current);
  const root = role === UserRole.FACILITY_MANAGER ? "/facility-manager" : "/staff";
  async function submit() {
    const b = booking.data;
    if (
      !b ||
      !chosen ||
      mutation.isPending ||
      !chosen.isAvailableForPeriod ||
      !(chosen.status === "AVAILABLE" || chosen.id === b.assignedUnit?.physicalUnitId)
    )
      return;
    const change: UnitAssignmentConfirmation = {
      bookingId: b.id,
      bookingCode: b.bookingCode,
      customerName: b.contactName,
      previousUnitCode: b.assignedUnit?.physicalUnitCode ?? null,
      physicalUnitId: current,
      unitCode: chosen.code,
      reason: reason.trim(),
    };
    setError("");
    if (b.assignedUnit && b.assignedUnit.physicalUnitId !== current) {
      setConfirmation(change);
      return;
    }
    await assign(change);
  }
  async function assign(change: UnitAssignmentConfirmation) {
    if (mutation.isPending || role !== UserRole.FACILITY_MANAGER) return;
    setError("");
    try {
      await mutation.mutateAsync({
        bookingId: change.bookingId,
        input: { physicalUnitId: change.physicalUnitId, reason: change.reason || undefined },
      });
      await queryClient.invalidateQueries({ queryKey: ["facility-flow"] });
      setConfirmation(null);
      showToast(
        change.previousUnitCode && change.previousUnitCode !== change.unitCode
          ? FLOW.reassignedSuccess(change.previousUnitCode, change.unitCode)
          : FLOW.assignedSuccess,
        "success",
      );
      router.push(`${root}/check-in?bookingCode=${encodeURIComponent(change.bookingCode)}`);
    } catch (e) {
      setError(flowError(e));
      showToast(flowError(e), "error");
    }
  }
  return (
    <>
      <OperationalBackLink href="/facility-manager/tasks?view=bookings">
        {FLOW.back}
      </OperationalBackLink>
      <OperationalPageHeader title={FLOW.assignmentTitle} description={FLOW.assignmentWarning} />
      {booking.isLoading ? (
        <LoadingState label={FLOW.loading} variant="detail" />
      ) : booking.isError || !booking.data ? (
        <ErrorState message={FLOW.error} onRetry={() => booking.refetch()} />
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={`${titleClass} text-xl`}>{booking.data.bookingCode}</h2>
                <p className="mt-1 text-xs text-[#707975]">{booking.data.facilityName}</p>
              </div>
              <Pill tone={booking.data.paidAt ? "green" : "amber"}>
                {booking.data.paidAt ? FLOW.paid : FLOW.unpaid}
              </Pill>
            </div>
            <div className="mt-4 grid gap-4 rounded bg-slate-50 p-3 sm:grid-cols-4">
              <DataPair label={FLOW.customer}>{booking.data.contactName}</DataPair>
              <DataPair label={FLOW.phone}>{booking.data.contactPhone}</DataPair>
              <DataPair label={FLOW.period}>{FLOW.months(booking.data.requestedMonths)}</DataPair>
              <DataPair label={FLOW.amount}>
                <Currency value={booking.data.totalAmount} />
              </DataPair>
            </div>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
            <div className="space-y-4">
              <Panel>
                <SectionTitle icon={<Warehouse size={20} />}>{FLOW.spec}</SectionTitle>
                <div className="mt-4 space-y-4">
                  <DataPair label={FLOW.unitType}>{booking.data.unitTypeName}</DataPair>
                  <DataPair label={FLOW.size}>{booking.data.unitTypeSizeLabel}</DataPair>
                  <DataPair label={FLOW.slot}>
                    {formatDateTime(booking.data.checkInSlotStart)}
                  </DataPair>
                  <DataPair label={FLOW.rentalEnd}>
                    {formatDateTime(booking.data.rentalEndAt)}
                  </DataPair>
                </div>
              </Panel>
              <Panel className="border-amber-200 bg-amber-50">
                <SectionTitle icon={<AlertTriangle size={20} />}>
                  {FLOW.assignmentWarningTitle}
                </SectionTitle>
                <p className="mt-3 text-xs leading-5 text-[#6e3900]">{FLOW.assignmentWarning}</p>
              </Panel>
            </div>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SectionTitle>{FLOW.suggested}</SectionTitle>
                  <p className="mt-1 text-xs text-[#707975]">{FLOW.match}</p>
                </div>
                <Button
                  variant="secondary"
                  aria-label={FLOW.refresh}
                  onClick={() => units.refetch()}
                >
                  <RefreshCw size={18} />
                </Button>
              </div>
              {units.isLoading ? (
                <LoadingState variant="table" />
              ) : units.isError ? (
                <ErrorState message={FLOW.error} onRetry={() => units.refetch()} />
              ) : !units.data?.length ? (
                <Panel>{FLOW.noUnits}</Panel>
              ) : (
                units.data.map((u) => {
                  const available =
                    u.isAvailableForPeriod &&
                    (u.status === "AVAILABLE" ||
                      u.id === booking.data?.assignedUnit?.physicalUnitId);
                  const checked = current === u.id;
                  return (
                    <label
                      key={u.id}
                      className={`block cursor-pointer focus-within:ring-2 focus-within:ring-[#306858] overflow-hidden rounded-lg bg-white shadow-sm ${checked ? "ring-2 ring-[#003b2f]" : !available ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                        <div className="flex flex-1 items-center gap-4">
                          <div className="grid size-14 shrink-0 place-items-center rounded bg-slate-50 text-[#306858]">
                            <Warehouse size={26} aria-hidden="true" />
                          </div>
                          <div>
                            <Pill tone={available ? "green" : "red"}>
                              {!available ? FLOW.blocked : checked ? FLOW.selected : FLOW.available}
                            </Pill>
                            <h3 className={`${titleClass} mt-2 text-xl`}>{u.code}</h3>
                            <p className="mt-1 text-xs text-[#707975]">
                              {u.floor ?? "—"} · {booking.data?.unitTypeSizeLabel}
                            </p>
                            <p className="mt-2 text-sm">{u.locationDescription ?? FLOW.match}</p>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="unit"
                          aria-label={u.code}
                          checked={checked}
                          disabled={!available || mutation.isPending}
                          onChange={() => setSelected(u.id)}
                          className="size-5 accent-[#003b2f]"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-xs">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 size={16} />
                          {FLOW.match}
                        </span>
                        <span className="font-semibold text-[#003b2f]">
                          {!available ? FLOW.blocked : checked ? FLOW.selected : FLOW.chooseUnit}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold">{FLOW.notesAssign}</span>
                <textarea
                  className={inputClass}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
          </div>
          {error && !confirmation && (
            <p role="alert" className="rounded bg-[#ffdad6] p-3 text-[#93000a]">
              {error}
            </p>
          )}
          <Panel className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push("/facility-manager/tasks?view=bookings")}
            >
              <BackLabel />
            </Button>
            <div className="text-sm">
              <p className="mb-1 text-xs text-[#404945]">
                {role !== UserRole.FACILITY_MANAGER ? FLOW.managerOnly : FLOW.chooseHint}
              </p>
              {FLOW.selected}: <strong>{chosen?.code ?? FLOW.unassigned}</strong>
            </div>
            <Button
              onClick={submit}
              loading={mutation.isPending}
              disabled={
                !chosen?.isAvailableForPeriod ||
                !(
                  chosen.status === "AVAILABLE" ||
                  chosen.id === booking.data.assignedUnit?.physicalUnitId
                ) ||
                role !== UserRole.FACILITY_MANAGER
              }
              icon={<ArrowRight size={18} />}
            >
              {FLOW.assignConfirm}
            </Button>
          </Panel>
        </>
      )}
      {confirmation && (
        <ReassignmentDialog
          change={confirmation}
          pending={mutation.isPending}
          error={error}
          onCancel={() => {
            if (!mutation.isPending) {
              setConfirmation(null);
              setError("");
            }
          }}
          onConfirm={() => void assign(confirmation)}
        />
      )}
    </>
  );
}
