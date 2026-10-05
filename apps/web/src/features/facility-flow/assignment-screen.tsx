"use client";
import { UserRole } from "@metastorage/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Warehouse } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Currency } from "@/components/ui/display";
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
import { FLOW_ASSETS } from "./flow-assets";
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
} from "./flow-ui";
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
      chosen.status !== "AVAILABLE"
    )
      return;
    if (
      b.assignedUnit &&
      b.assignedUnit.physicalUnitId !== current &&
      !window.confirm(
        FLOW.confirmReassign(b.contactName, b.assignedUnit.physicalUnitCode, chosen.code),
      )
    )
      return;
    setError("");
    try {
      await mutation.mutateAsync({
        bookingId: b.id,
        input: { physicalUnitId: current, reason: reason.trim() || undefined },
      });
      await queryClient.invalidateQueries({ queryKey: ["facility-flow"] });
      showToast(FLOW.assignedSuccess, "success");
      router.push(`${root}/check-in?bookingCode=${encodeURIComponent(b.bookingCode)}`);
    } catch (e) {
      setError(flowError(e));
    }
  }
  return (
    <>
      <FlowHeading title={FLOW.assignmentTitle} />
      <Steps active={0} />
      <FlowHelp />
      {booking.isLoading ? (
        <LoadingState label={FLOW.loading} />
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
            <div className="mt-4 grid gap-4 rounded bg-[#f2f3ff] p-3 sm:grid-cols-4">
              <DataPair label={FLOW.customer}>{booking.data.contactName}</DataPair>
              <DataPair label={FLOW.phone}>{booking.data.contactPhone}</DataPair>
              <DataPair label={FLOW.period}>{FLOW.months(booking.data.requestedMonths)}</DataPair>
              <DataPair label={FLOW.amount}>
                <Currency value={booking.data.totalAmount} />
              </DataPair>
            </div>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
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
              <Panel className="bg-[#ffdcc3]/50">
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
                <LoadingState />
              ) : units.isError ? (
                <ErrorState message={FLOW.error} onRetry={() => units.refetch()} />
              ) : !units.data?.length ? (
                <Panel>{FLOW.noUnits}</Panel>
              ) : (
                units.data.map((u, index) => {
                  const available = u.isAvailableForPeriod && u.status === "AVAILABLE";
                  const checked = current === u.id;
                  return (
                    <label
                      key={u.id}
                      className={`block cursor-pointer focus-within:ring-2 focus-within:ring-[#306858] overflow-hidden rounded-lg bg-white shadow-sm ${checked ? "ring-2 ring-[#003b2f]" : !available ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                        <div className="flex flex-1 items-center gap-4">
                          <div className="grid h-28 w-32 shrink-0 place-items-center rounded bg-[#f2f3ff] text-[#306858]">
                            <Image
                              src={
                                FLOW_ASSETS.unitPhotos[index % FLOW_ASSETS.unitPhotos.length] ??
                                FLOW_ASSETS.corridor
                              }
                              alt="Ảnh minh họa buồng kho"
                              width={128}
                              height={112}
                              unoptimized
                              className="h-28 w-32 rounded object-cover"
                            />
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
                      <div className="flex items-center justify-between gap-3 bg-[#f2f3ff] px-4 py-3 text-xs">
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
          {error && (
            <p role="alert" className="rounded bg-[#ffdad6] p-3 text-[#93000a]">
              {error}
            </p>
          )}
          <Panel className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => router.push(`${root}/dashboard`)}>
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
                chosen.status !== "AVAILABLE" ||
                role !== UserRole.FACILITY_MANAGER
              }
              icon={<ArrowRight size={18} />}
            >
              {FLOW.assignConfirm}
            </Button>
          </Panel>
        </>
      )}
    </>
  );
}
