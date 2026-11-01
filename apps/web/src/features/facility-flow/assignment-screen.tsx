"use client";

import { UserRole } from "@metastorage/database/schema/user-enums";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Phone,
  RefreshCw,
  Search,
  Warehouse,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Currency } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  OperationalBackLink,
  OperationalBadge,
  OperationalPageHeader,
} from "@/components/ui/operational";
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
import { ReassignmentDialog } from "./reassignment-dialog";
import type { UnitAssignmentConfirmation } from "./reassignment-dialog.types";
import { flowError } from "./use-check-in-flow";

export function AssignmentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const id = params.get("appointmentId") ?? params.get("bookingId") ?? "";
  const booking = useBooking(id);
  const units = useEligibleUnits(id);
  const mutation = useAssignPhysicalUnitMutation();

  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [unitPage, setUnitPage] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<UnitAssignmentConfirmation | null>(null);

  const { showToast } = useToast();
  const role = useAuthStore((s) => s.session?.user.role);

  const current = selected || booking.data?.assignedUnit?.physicalUnitId || "";
  const chosen = units.data?.find((u) => u.id === current);
  const root = role === UserRole.FACILITY_MANAGER ? "/facility-manager" : "/staff";

  // Filter units by search query
  const filteredUnits = (units.data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.code.toLowerCase().includes(q) ||
      (u.locationDescription?.toLowerCase().includes(q) ?? false) ||
      (u.floor?.toString().includes(q) ?? false)
    );
  });

  const unitPageSize = 9; // 3x3 grid
  const pageUnits = filteredUnits.slice((unitPage - 1) * unitPageSize, unitPage * unitPageSize);

  // Reset page on search change
  // biome-ignore lint/correctness/useExhaustiveDependencies: search intentionally resets local page
  useEffect(() => {
    setUnitPage(1);
  }, [search]);

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
      router.push(`${root}/check-in?appointmentId=${encodeURIComponent(change.bookingId)}`);
    } catch (e) {
      setError(flowError(e));
      showToast(flowError(e), "error");
    }
  }

  const chosenAvailable =
    chosen?.isAvailableForPeriod &&
    (chosen.status === "AVAILABLE" || chosen.id === booking.data?.assignedUnit?.physicalUnitId);

  return (
    <div className="space-y-6">
      <OperationalBackLink href="/facility-manager/tasks">{FLOW.back}</OperationalBackLink>

      <OperationalPageHeader title={FLOW.assignmentTitle} description={FLOW.assignmentWarning} />

      {booking.isLoading ? (
        <LoadingState label={FLOW.loading} variant="detail" />
      ) : booking.isError || !booking.data ? (
        <ErrorState message={FLOW.error} onRetry={() => booking.refetch()} />
      ) : (
        <>
          {/* Top Booking Overview Card */}
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-bold text-slate-900">
                    {booking.data.bookingCode}
                  </span>
                  <OperationalBadge
                    value={booking.data.paidAt ? "SUCCEEDED" : "PAYMENT_PENDING"}
                    label={booking.data.paidAt ? FLOW.paid : FLOW.unpaid}
                  />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{booking.data.facilityName}</p>
              </div>

              {booking.data.assignedUnit?.physicalUnitCode && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900">
                  <Warehouse size={15} className="text-blue-600" />
                  <span>Ô kho hiện tại: {booking.data.assignedUnit.physicalUnitCode}</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {FLOW.customer}
                </p>
                <p className="truncate font-bold text-slate-900">{booking.data.contactName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Phone size={12} className="text-slate-400" />
                  {booking.data.contactPhone}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {FLOW.unitType}
                </p>
                <p className="truncate font-bold text-slate-900">{booking.data.unitTypeName}</p>
                <p className="mt-0.5 text-xs text-slate-500">{booking.data.unitTypeSizeLabel}</p>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {FLOW.period}
                </p>
                <p className="font-bold text-slate-900">
                  {FLOW.months(booking.data.requestedMonths)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hạn thuê: {formatDateTime(booking.data.rentalEndAt)}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {FLOW.amount}
                </p>
                <p className="text-base font-bold tabular-nums text-primary">
                  <Currency value={booking.data.totalAmount} />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hẹn đến: {formatDateTime(booking.data.checkInSlotStart)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Main 2-column Layout */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3.2fr)_minmax(0,6.8fr)]">
            {/* Left Column: Specs & Warning */}
            <div className="space-y-4">
              <Card className="border-slate-200 bg-white shadow-2xs">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Warehouse size={16} className="text-primary" />
                    {FLOW.spec}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5 p-4 text-xs">
                  <div>
                    <span className="text-slate-500">{FLOW.unitType}:</span>
                    <strong className="ml-1 text-slate-800">{booking.data.unitTypeName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{FLOW.size}:</span>
                    <strong className="ml-1 text-slate-800">
                      {booking.data.unitTypeSizeLabel}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{FLOW.slot}:</span>
                    <div className="mt-0.5 font-medium text-slate-800">
                      {formatDateTime(booking.data.checkInSlotStart)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">{FLOW.rentalEnd}:</span>
                    <div className="mt-0.5 font-medium text-slate-800">
                      {formatDateTime(booking.data.rentalEndAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Operational Warning Alert */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span>{FLOW.assignmentWarningTitle}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
                  {FLOW.assignmentWarning}
                </p>
              </div>

              {/* Notes Input Area */}
              <Card className="border-slate-200 bg-white shadow-2xs">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-xs font-bold text-slate-800">
                    {FLOW.notesAssign}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <textarea
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    maxLength={500}
                    placeholder="Ghi chú lý do phân công hoặc đổi buồng kho..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="mt-1 text-right text-[11px] text-slate-400">
                    {reason.length} / 500
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Suggested Units in a Responsive 3x3 Card Grid with Pagination */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{FLOW.suggested}</h3>
                  <p className="text-xs text-slate-500">{FLOW.match}</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm mã ô, tầng..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8.5 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => units.refetch()}
                    loading={units.isFetching}
                    className="h-8.5 px-3 text-xs font-medium"
                    title={FLOW.refresh}
                  >
                    <RefreshCw size={14} />
                  </Button>
                </div>
              </div>

              {units.isLoading ? (
                <LoadingState variant="table" />
              ) : units.isError ? (
                <ErrorState message={FLOW.error} onRetry={() => units.refetch()} />
              ) : filteredUnits.length === 0 ? (
                <Card className="p-8 text-center text-slate-500">
                  <Warehouse className="mx-auto mb-2 text-slate-400" size={32} />
                  <p className="text-sm font-semibold">{FLOW.noUnits}</p>
                  {search && (
                    <Button
                      variant="outline"
                      onClick={() => setSearch("")}
                      className="mt-3 h-8 px-3 text-xs"
                    >
                      Xóa tìm kiếm
                    </Button>
                  )}
                </Card>
              ) : (
                <>
                  {/* The Responsive 3x3 Card Grid */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {pageUnits.map((u) => {
                      const isCurrentAssigned = u.id === booking.data?.assignedUnit?.physicalUnitId;
                      const available =
                        u.isAvailableForPeriod && (u.status === "AVAILABLE" || isCurrentAssigned);
                      const isSelected = current === u.id;

                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            if (available && !mutation.isPending) {
                              setSelected(u.id);
                            }
                          }}
                          className={`group flex w-full flex-col justify-between rounded-xl border p-3.5 text-left transition-all select-none ${
                            isSelected
                              ? "border-primary bg-primary-soft/30 ring-2 ring-primary/30 shadow-xs"
                              : available
                                ? "cursor-pointer border-slate-200 bg-white hover:border-primary/50 hover:shadow-2xs"
                                : "cursor-not-allowed border-slate-200 bg-slate-50/70 opacity-60"
                          }`}
                        >
                          <div>
                            {/* Card Top: Code & Status Badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                                    isSelected
                                      ? "bg-primary text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <Warehouse size={14} />
                                </div>
                                <span className="font-mono text-sm font-bold text-slate-900">
                                  {u.code}
                                </span>
                              </div>

                              {isSelected ? (
                                <Badge className="bg-primary text-[10px] font-bold text-white">
                                  {FLOW.selected}
                                </Badge>
                              ) : isCurrentAssigned ? (
                                <Badge
                                  variant="outline"
                                  className="border-blue-300 bg-blue-50 text-[10px] font-semibold text-blue-700"
                                >
                                  Đang gán
                                </Badge>
                              ) : available ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300 bg-emerald-50 text-[10px] font-semibold text-emerald-700"
                                >
                                  {FLOW.available}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-rose-300 bg-rose-50 text-[10px] font-semibold text-rose-700"
                                >
                                  {FLOW.blocked}
                                </Badge>
                              )}
                            </div>

                            {/* Card Body: Floor & Location */}
                            <div className="mt-3 space-y-1 text-xs">
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <span className="font-semibold text-slate-800">
                                  Tầng {u.floor ?? "—"}
                                </span>
                                <span>·</span>
                                <span className="text-slate-500">
                                  {booking.data?.unitTypeSizeLabel}
                                </span>
                              </div>
                              <p className="line-clamp-2 text-[11px] text-slate-500">
                                {u.locationDescription ?? FLOW.match}
                              </p>
                            </div>
                          </div>

                          {/* Card Footer: Choice Status */}
                          <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                            {isSelected ? (
                              <span className="flex items-center gap-1 font-bold text-primary">
                                <CheckCircle2 size={14} className="text-primary" />
                                {FLOW.selected}
                              </span>
                            ) : available ? (
                              <span className="flex items-center gap-1 text-slate-500 group-hover:text-primary transition-colors">
                                <span className="size-3 rounded-full border border-slate-300 group-hover:border-primary" />
                                {FLOW.chooseUnit}
                              </span>
                            ) : (
                              <span className="text-rose-600">{FLOW.blocked}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Standard ListPagination for Grid */}
                  <ListPagination
                    label="buồng kho khả dụng"
                    unitLabel="ô kho"
                    page={unitPage}
                    pageSize={unitPageSize}
                    total={filteredUnits.length}
                    onPageChange={setUnitPage}
                  />
                </>
              )}
            </div>
          </div>

          {error && !confirmation && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900">
              {error}
            </div>
          )}

          {/* Bottom Sticky Action Bar */}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
            <Button
              variant="outline"
              onClick={() => router.push("/facility-manager/tasks")}
              className="h-9 px-4 text-xs font-semibold"
            >
              {FLOW.back}
            </Button>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600">
                {role !== UserRole.FACILITY_MANAGER ? FLOW.managerOnly : "Buồng kho được chọn:"}
              </span>
              <strong className="rounded bg-slate-100 px-2.5 py-1 font-mono text-sm font-bold text-primary">
                {chosen?.code ?? FLOW.unassigned}
              </strong>
            </div>

            <Button
              onClick={submit}
              loading={mutation.isPending}
              disabled={
                !chosenAvailable || role !== UserRole.FACILITY_MANAGER || mutation.isPending
              }
              className="h-9 px-5 text-xs font-bold"
              icon={<ArrowRight size={15} />}
            >
              {FLOW.assignConfirm}
            </Button>
          </div>
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
    </div>
  );
}
