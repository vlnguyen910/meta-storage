"use client";

import { AlertTriangle, CheckCircle, Warehouse, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAssignPhysicalUnitMutation, useEligibleUnits } from "./hooks";
import { UNIT_ASSIGNMENT_MESSAGES } from "./unit-assignment.messages";
import type { UnitAssignmentModalProps } from "./unit-assignment-modal.types";

export function UnitAssignmentModal({ booking, isOpen, onClose }: UnitAssignmentModalProps) {
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    booking.assignedUnit?.physicalUnitId ?? "",
  );
  const [reason, setReason] = useState<string>("");
  const { showToast } = useToast();

  const { data: eligibleUnits, isLoading, isError } = useEligibleUnits(booking.id);
  const assignMutation = useAssignPhysicalUnitMutation();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      showToast(UNIT_ASSIGNMENT_MESSAGES.unitRequired, "error");
      return;
    }

    try {
      await assignMutation.mutateAsync({
        bookingId: booking.id,
        input: {
          physicalUnitId: selectedUnitId,
          reason: reason.trim() || undefined,
        },
      });

      showToast(UNIT_ASSIGNMENT_MESSAGES.assignmentSucceeded(booking.bookingCode), "success");
      onClose();
    } catch (err) {
      let message: string = UNIT_ASSIGNMENT_MESSAGES.assignmentFailed;
      if (err && typeof err === "object" && "response" in err) {
        const res = err as { response?: { data?: { message?: string } } };
        if (res.response?.data?.message) {
          message = res.response.data.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Gán ô kho vật lý (Physical Unit)</h2>
              <p className="text-xs text-muted">
                Đơn đặt chỗ: <strong className="text-ink">{booking.bookingCode}</strong> · Khách:{" "}
                {booking.contactName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Booking Info Summary */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs">
            <div>
              <span className="text-muted">Loại kho đã đặt:</span>
              <p className="font-semibold text-ink mt-0.5">
                {booking.unitTypeName} ({booking.unitTypeSizeLabel})
              </p>
            </div>
            <div>
              <span className="text-muted">Kỳ thuê:</span>
              <p className="font-semibold text-ink mt-0.5">{booking.requestedMonths} tháng</p>
            </div>
            <div>
              <span className="text-muted">Trạng thái hiện tại:</span>
              <div className="mt-0.5">
                <StatusBadge value={booking.status} />
              </div>
            </div>
          </div>

          {/* Unit Selection List */}
          <div>
            <span className="block text-sm font-semibold text-ink mb-2">
              Chọn ô kho vật lý phù hợp trong cơ sở:
            </span>

            {isLoading && <LoadingState />}

            {isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                Không thể tải danh sách ô kho vật lý. Vui lòng thử lại sau.
              </div>
            )}

            {eligibleUnits && eligibleUnits.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                Hiện không có ô kho nào thuộc loại kho này trong cơ sở.
              </div>
            )}

            {eligibleUnits && eligibleUnits.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {eligibleUnits.map((unit) => {
                  const isSelected = selectedUnitId === unit.id;
                  const isAvailable = unit.isAvailableForPeriod && unit.status === "AVAILABLE";

                  return (
                    <label
                      key={unit.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : isAvailable
                            ? "border-line bg-surface hover:border-slate-300"
                            : "border-slate-200 bg-slate-100/60 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="physicalUnit"
                          value={unit.id}
                          disabled={!isAvailable}
                          checked={isSelected}
                          onChange={() => setSelectedUnitId(unit.id)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-ink">{unit.code}</span>
                            {unit.floor && (
                              <span className="text-xs text-muted">({unit.floor})</span>
                            )}
                          </div>
                          {unit.locationDescription && (
                            <p className="text-xs text-muted mt-0.5">{unit.locationDescription}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <CheckCircle className="h-3.5 w-3.5" /> Khả dụng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="h-3.5 w-3.5" /> Bị chiếm / Bảo trì
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optional reason/notes */}
          <div>
            <label htmlFor="reason" className="block text-sm font-semibold text-ink mb-1.5">
              Ghi chú lý do gán (không bắt buộc):
            </label>
            <input
              id="reason"
              type="text"
              placeholder="VD: Khách hàng yêu cầu ô kho gần cửa thang máy"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!selectedUnitId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "Đang xử lý..." : "Xác nhận gán ô kho"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
