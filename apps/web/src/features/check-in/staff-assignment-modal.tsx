"use client";

import type { BookingListItem } from "@metastorage/contracts";
import { Check, Mail, Phone, ShieldCheck, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAssignStaffMutation, useFacilityStaff } from "./hooks";

interface StaffAssignmentModalProps {
  booking: BookingListItem;
  isOpen: boolean;
  onClose: () => void;
}

export function StaffAssignmentModal({ booking, isOpen, onClose }: StaffAssignmentModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>(booking.assignedStaff?.id ?? "");
  const [notes, setNotes] = useState<string>("");
  const { showToast } = useToast();

  const { data: staffList, isLoading, isError } = useFacilityStaff(booking.facilityId);
  const assignStaffMutation = useAssignStaffMutation();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      showToast("Vui lòng chọn một nhân viên cơ sở từ danh sách.", "error");
      return;
    }

    try {
      await assignStaffMutation.mutateAsync({
        bookingId: booking.id,
        input: {
          staffId: selectedStaffId,
          notes: notes.trim() || undefined,
        },
      });

      const assignedStaff = staffList?.find((s) => s.id === selectedStaffId);
      showToast(
        `Đã chỉ định ${assignedStaff?.name ?? "nhân viên"} phụ trách đơn ${booking.bookingCode}.`,
        "success",
      );
      onClose();
    } catch (err) {
      let message = "Không thể chỉ định nhân viên phụ trách. Vui lòng kiểm tra lại.";
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
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Chỉ định nhân viên phụ trách</h2>
              <p className="text-xs text-muted">
                Đơn: <strong className="text-ink">{booking.bookingCode}</strong> · Khách:{" "}
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
          {/* Summary Box */}
          <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-muted space-y-1">
            <div className="flex justify-between">
              <span>Cơ sở:</span>
              <strong className="text-ink">{booking.facilityName}</strong>
            </div>
            <div className="flex justify-between">
              <span>Loại kho đã đặt:</span>
              <strong className="text-ink">
                {booking.unitTypeName} ({booking.unitTypeSizeLabel})
              </strong>
            </div>
            {booking.assignedUnit && (
              <div className="flex justify-between">
                <span>Ô kho vật lý đã gán:</span>
                <strong className="text-emerald-700">
                  {booking.assignedUnit.physicalUnitCode}
                </strong>
              </div>
            )}
          </div>

          {/* Staff Selection */}
          <div>
            <span className="block text-sm font-semibold text-ink mb-2">
              Chọn nhân viên cơ sở (Facility Staff):
            </span>

            {isLoading && <LoadingState />}

            {isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                Không thể tải danh sách nhân viên cơ sở.
              </div>
            )}

            {staffList && staffList.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                Chưa có nhân viên cơ sở (Facility Staff) nào được phân công tại cơ sở này.
              </div>
            )}

            {staffList && staffList.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {staffList.map((staff) => {
                  const isSelected = selectedStaffId === staff.id;

                  return (
                    <label
                      key={staff.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-line bg-surface hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="staffSelection"
                          value={staff.id}
                          checked={isSelected}
                          onChange={() => setSelectedStaffId(staff.id)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-ink">{staff.name}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              <ShieldCheck className="h-3 w-3" /> Staff
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted mt-1">
                            {staff.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {staff.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {staff.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="staff-notes" className="block text-sm font-semibold text-ink mb-1.5">
              Ghi chú công việc (không bắt buộc):
            </label>
            <input
              id="staff-notes"
              type="text"
              placeholder="VD: Phụ trách đón khách ca sáng, kiểm tra kỹ đồ điện tử"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              disabled={!selectedStaffId || assignStaffMutation.isPending}
            >
              {assignStaffMutation.isPending ? "Đang xử lý..." : "Xác nhận chỉ định"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
