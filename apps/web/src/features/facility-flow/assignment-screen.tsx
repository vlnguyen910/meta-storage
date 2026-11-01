"use client";

import { UserRole } from "@metastorage/database/schema/user-enums";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Phone, RefreshCw, Search, Warehouse } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Currency } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import { OperationalBackLink, OperationalBadge } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  useAssignPhysicalUnitMutation,
  useBooking,
  useEligibleUnits,
} from "@/features/check-in/hooks";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
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

  const unitPageSize = 9; // 3x3 grid, fits viewport without scrolling
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
    <div className="space-y-3">
      {/* Header with Back Link & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {FLOW.assignmentTitle}
          </h1>
          <p className="text-xs text-slate-500">
            Phân công ô kho cho đơn đặt chỗ {booking.data?.bookingCode}
          </p>
        </div>
        <OperationalBackLink href="/facility-manager/tasks">{FLOW.back}</OperationalBackLink>
      </div>

      {booking.isLoading ? (
        <LoadingState label={FLOW.loading} variant="detail" />
      ) : booking.isError || !booking.data ? (
        <ErrorState message={FLOW.error} onRetry={() => booking.refetch()} />
      ) : (
        <>
          {/* Top Booking Overview Card */}
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-slate-900">
                  {booking.data.bookingCode}
                </span>
                <OperationalBadge
                  value={booking.data.paidAt ? "SUCCEEDED" : "PAYMENT_PENDING"}
                  label={booking.data.paidAt ? FLOW.paid : FLOW.unpaid}
                />
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500">{booking.data.facilityName}</span>
              </div>

              {booking.data.assignedUnit?.physicalUnitCode && (
                <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                  <Warehouse size={13} className="text-blue-600" />
                  <span>Ô kho hiện tại: {booking.data.assignedUnit.physicalUnitCode}</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {FLOW.customer}
                </p>
                <p className="truncate font-bold text-slate-900">{booking.data.contactName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                  <Phone size={11} className="text-slate-400" />
                  {booking.data.contactPhone}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {FLOW.unitType}
                </p>
                <p className="truncate font-bold text-slate-900">{booking.data.unitTypeName}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {booking.data.unitTypeSizeLabel}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {FLOW.period}
                </p>
                <p className="font-bold text-slate-900">
                  {FLOW.months(booking.data.requestedMonths)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Hạn: {formatDateTime(booking.data.rentalEndAt)}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {FLOW.amount}
                </p>
                <p className="text-sm font-bold tabular-nums text-primary">
                  <Currency value={booking.data.totalAmount} />
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Hẹn: {formatDateTime(booking.data.checkInSlotStart)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Main 2-column Layout */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3.2fr)_minmax(0,6.8fr)] items-stretch">
            {/* Left Column: Specs, Notes & Action Confirmation */}
            <div className="flex flex-col gap-3 h-full">
              {/* Card 1: Selected Unit & Confirmation Button */}
              <Card className="border-slate-200 bg-white shadow-2xs">
                <CardHeader className="border-b border-slate-100 px-3.5 py-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Warehouse size={14} className="text-primary" />
                      <span>Buồng kho được chọn</span>
                    </CardTitle>
                    <span className="font-mono text-xs font-bold text-primary">
                      {chosen?.code ?? FLOW.unassigned}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-2.5 text-xs">
                  {chosen ? (
                    <div className="rounded-lg border border-primary/20 bg-primary-soft/10 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {chosen.code}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          Tầng {chosen.floor ?? "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                        {chosen.locationDescription || booking.data.unitTypeSizeLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-2.5 text-center text-[11px] text-slate-400">
                      Chọn ô kho từ danh sách bên phải
                    </div>
                  )}

                  {error && !confirmation && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold text-rose-800">
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={submit}
                    loading={mutation.isPending}
                    disabled={
                      !chosenAvailable || role !== UserRole.FACILITY_MANAGER || mutation.isPending
                    }
                    className="w-full h-8.5 text-xs font-bold"
                    icon={<ArrowRight size={14} />}
                  >
                    {FLOW.assignConfirm}
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2: Notes Area stretching to fill height */}
              <Card className="flex flex-1 flex-col border-slate-200 bg-white shadow-2xs min-h-0">
                <CardHeader className="border-b border-slate-100 px-3.5 py-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-slate-800">
                      {FLOW.notesAssign}
                    </CardTitle>
                    <span className="text-[10px] text-slate-400">{reason.length} / 500</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-2.5 min-h-0">
                  <textarea
                    className="w-full flex-1 min-h-[140px] rounded-md border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    maxLength={500}
                    placeholder="Ghi chú lý do phân công hoặc đổi buồng kho..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Suggested Units in a Responsive Card Grid */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {FLOW.suggested}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">
                    {filteredUnits.length} ô
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <Search
                      size={13}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Tìm mã ô, tầng..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 w-40 sm:w-48 rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => units.refetch()}
                    loading={units.isFetching}
                    className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900"
                    title={FLOW.refresh}
                  >
                    <RefreshCw size={13} />
                  </Button>
                </div>
              </div>

              {units.isLoading ? (
                <LoadingState variant="table" />
              ) : units.isError ? (
                <ErrorState message={FLOW.error} onRetry={() => units.refetch()} />
              ) : filteredUnits.length === 0 ? (
                <Card className="p-6 text-center text-slate-500">
                  <Warehouse className="mx-auto mb-2 text-slate-400" size={28} />
                  <p className="text-xs font-semibold">{FLOW.noUnits}</p>
                  {search && (
                    <Button
                      variant="outline"
                      onClick={() => setSearch("")}
                      className="mt-2.5 h-7 px-2.5 text-xs"
                    >
                      Xóa tìm kiếm
                    </Button>
                  )}
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {pageUnits.map((u) => {
                      const isCurrentAssigned = u.id === booking.data?.assignedUnit?.physicalUnitId;
                      const available =
                        u.isAvailableForPeriod && (u.status === "AVAILABLE" || isCurrentAssigned);
                      const isSelected = current === u.id;

                      return (
                        <label
                          key={u.id}
                          className={cn(
                            "group flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all select-none relative",
                            isSelected
                              ? "border-primary bg-primary-soft/30 ring-1.5 ring-primary/40 shadow-xs"
                              : available
                                ? "cursor-pointer border-slate-200 bg-white hover:border-primary/50 hover:shadow-2xs"
                                : "cursor-not-allowed border-slate-100 bg-slate-50/70 opacity-55",
                          )}
                        >
                          <input
                            type="radio"
                            name="unit"
                            aria-label={u.code}
                            checked={isSelected}
                            disabled={!available || mutation.isPending}
                            onChange={() => {
                              if (available && !mutation.isPending) {
                                setSelected(u.id);
                              }
                            }}
                            className="sr-only"
                          />
                          <div>
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={cn(
                                    "grid size-6 shrink-0 place-items-center rounded-md",
                                    isSelected
                                      ? "bg-primary text-white"
                                      : "bg-slate-100 text-slate-600",
                                  )}
                                >
                                  <Warehouse size={13} />
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-900 truncate">
                                  {u.code}
                                </span>
                              </div>

                              {isSelected ? (
                                <Badge className="bg-primary text-[9px] font-bold text-white px-1.5 py-0">
                                  {FLOW.selected}
                                </Badge>
                              ) : isCurrentAssigned ? (
                                <Badge
                                  variant="outline"
                                  className="border-blue-300 bg-blue-50 text-[9px] font-semibold text-blue-700 px-1.5 py-0"
                                >
                                  Đang gán
                                </Badge>
                              ) : available ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300 bg-emerald-50 text-[9px] font-semibold text-emerald-700 px-1.5 py-0"
                                >
                                  {FLOW.available}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-rose-300 bg-rose-50 text-[9px] font-semibold text-rose-700 px-1.5 py-0"
                                >
                                  {FLOW.blocked}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1.5 space-y-0.5 text-[11px]">
                              <div className="flex items-center gap-1 text-slate-600">
                                <span className="font-semibold text-slate-800">
                                  Tầng {u.floor ?? "—"}
                                </span>
                                <span>·</span>
                                <span className="text-slate-500">
                                  {booking.data?.unitTypeSizeLabel}
                                </span>
                              </div>
                              <p className="line-clamp-1 text-[10px] text-slate-400">
                                {u.locationDescription ?? FLOW.match}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px]">
                            {isSelected ? (
                              <span className="flex items-center gap-1 font-bold text-primary">
                                <CheckCircle2 size={12} className="text-primary" />
                                {FLOW.selected}
                              </span>
                            ) : available ? (
                              <span className="flex items-center gap-1 text-slate-400 group-hover:text-primary transition-colors">
                                <span className="size-2.5 rounded-full border border-slate-300 group-hover:border-primary" />
                                {FLOW.chooseUnit}
                              </span>
                            ) : (
                              <span className="text-rose-500">{FLOW.blocked}</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

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
