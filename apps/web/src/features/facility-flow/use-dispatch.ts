"use client";
import type { AppointmentRecordDto, BookingListItem } from "@metastorage/contracts";
import { APPOINTMENT_TYPES } from "@metastorage/database/schema/appointments";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { bookingKeys } from "@/features/check-in/booking.keys";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { FLOW } from "./flow.messages";
export type DispatchItem = Omit<BookingListItem, "assignedUnit" | "assignedStaff" | "status"> & {
  appointmentType: APPOINTMENT_TYPES;
  reservationId: string | null;
  rentalId: string | null;
  status: string;
  appointmentStatus: string;
  assignedUnit: AppointmentRecordDto["assignedUnit"];
  assignedStaff: { id: string; name: string } | null;
  paymentStatus: string | null;
};
export type DispatchAppointmentType = APPOINTMENT_TYPES | "ALL";
export type DispatchFilterTab = "ALL" | APPOINTMENT_TYPES | "COMPLETED";

export function isCompletedDispatchItem(b: DispatchItem): boolean {
  const r = readiness(b);
  return (
    r === "CHECKED_IN" ||
    r === "COMPLETED" ||
    b.status === "CHECKED_IN" ||
    b.status === "COMPLETED" ||
    b.appointmentStatus === "COMPLETED"
  );
}
export function appointmentItem(a: AppointmentRecordDto): DispatchItem {
  const r = a.reservation;
  return {
    id: a.id,
    appointmentType: a.appointmentType,
    reservationId: a.reservationId,
    rentalId: a.rentalId,
    appointmentStatus: a.status,
    bookingCode: formatReference(a.reservationId ?? a.id, a.reservationId ? "BK" : "LH"),
    facilityId: a.facilityId,
    facilityName: a.facility?.name ?? FLOW.noFacility,
    unitTypeId: r?.unitTypeId ?? "",
    unitTypeName: a.unitType?.name ?? a.appointmentType,
    unitTypeSizeLabel: a.unitType?.sizeLabel ?? "",
    contactName: a.customerName ?? FLOW.customer,
    contactEmail: a.customerEmail ?? "",
    contactPhone: a.contactPhone ?? "",
    checkInSlotStart: `${a.scheduledDate}T${a.slotStart ?? "00:00:00"}+07:00`,
    checkInSlotEnd: a.slotEnd ? `${a.scheduledDate}T${a.slotEnd}+07:00` : null,
    rentalEndAt: r?.rentalEndAt ?? `${a.scheduledDate}T23:59:59+07:00`,
    requestedMonths: r?.requestedMonths ?? 0,
    totalAmount: r?.totalAmount ?? 0,
    status:
      a.status === "COMPLETED" && a.appointmentType === "CHECK_IN"
        ? "CHECKED_IN"
        : ["CANCELLED", "NO_SHOW"].includes(a.status)
          ? a.status
          : (r?.status ?? a.status),
    handoverStage: a.handoverStage,
    paidAt: a.paidAt ?? null,
    paymentStatus: a.paymentStatus ?? null,
    assignedUnit:
      a.assignedUnit?.physicalUnitId &&
      a.assignedUnit.physicalUnitCode &&
      (a.assignedUnit.status === "ACTIVE" ||
        ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status))
        ? a.assignedUnit
        : null,
    assignedStaff: a.assignedStaffId
      ? { id: a.assignedStaffId, name: a.assignedStaffName ?? FLOW.assignedStaff }
      : null,
    createdAt: a.createdAt,
  };
}
export async function loadAppointmentItem(id: string) {
  return appointmentItem(await api.appointments.get(id));
}
export function readiness(b: DispatchItem): string {
  if (
    b.appointmentType === APPOINTMENT_TYPES.CHECK_OUT ||
    b.appointmentType === APPOINTMENT_TYPES.SUPPORT
  )
    return b.appointmentStatus === "COMPLETED" ? "COMPLETED" : b.appointmentStatus;
  if (b.status === "CHECKED_IN") return "CHECKED_IN";
  if (b.status === "CANCELLED") return "CANCELLED";
  if (b.status === "NO_SHOW") return "NO_SHOW";
  if (b.paymentStatus !== "SUCCEEDED") return "PAYMENT_PENDING";
  if (!b.assignedUnit) return "NEEDS_UNIT";
  if (!b.assignedStaff || b.appointmentStatus !== "CONFIRMED") return "NEEDS_STAFF";
  if (!b.checkInSlotEnd) return "SLOT_MISSING";
  if (b.handoverStage === "INSPECTING" || b.handoverStage === "READY_HANDOVER")
    return b.handoverStage;
  return "READY";
}
export function useDispatch(
  facilityId: string,
  staff = false,
  appointmentType: DispatchAppointmentType = APPOINTMENT_TYPES.CHECK_IN,
) {
  const owner = useFlow3Identity();
  const query = useQuery({
    queryKey: [
      ...(staff ? bookingKeys.staffTasks(facilityId) : bookingKeys.facility(facilityId)),
      owner,
      appointmentType,
    ],
    queryFn: async () => {
      const appointments = await (staff
        ? api.appointments.assignedToMe({
            facilityId,
            ...(appointmentType === "ALL" ? {} : { appointmentType }),
          })
        : api.appointments.listFacility(facilityId, {
            ...(appointmentType === "ALL" ? {} : { appointmentType }),
          }));
      return appointments
        .filter(
          (item) =>
            appointmentType !== "ALL" ||
            item.appointmentType === APPOINTMENT_TYPES.CHECK_IN ||
            item.appointmentType === APPOINTMENT_TYPES.CHECK_OUT ||
            item.appointmentType === APPOINTMENT_TYPES.SUPPORT,
        )
        .map(appointmentItem);
    },
    enabled: !!facilityId,
    refetchInterval: 30000,
  });
  const [typeFilter, setTypeFilter] = useState<DispatchFilterTab>("ALL");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const bookings = [...(query.data ?? [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const matchesTypeAndCompletion = (b: DispatchItem) => {
    if (typeFilter === "COMPLETED") {
      return isCompletedDispatchItem(b);
    }
    return (
      !isCompletedDispatchItem(b) && (typeFilter === "ALL" || b.appointmentType === typeFilter)
    );
  };
  const filtered = bookings.filter(
    (b) =>
      matchesTypeAndCompletion(b) &&
      (filter === "ALL" || readiness(b) === filter) &&
      [
        b.bookingCode,
        b.rentalId ?? "",
        b.contactName,
        b.contactPhone,
        b.assignedUnit?.physicalUnitCode ?? "",
      ].some((v) => v.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const count = (status: string) =>
    bookings.filter((b) => matchesTypeAndCompletion(b) && readiness(b) === status).length;
  const typeCount = (type: DispatchFilterTab) => {
    if (type === "COMPLETED") {
      return bookings.filter(isCompletedDispatchItem).length;
    }
    if (type === "ALL") {
      return bookings.filter((b) => !isCompletedDispatchItem(b)).length;
    }
    return bookings.filter((b) => !isCompletedDispatchItem(b) && b.appointmentType === type).length;
  };
  return {
    query,
    bookings,
    filtered,
    filter,
    setFilter,
    typeFilter,
    setTypeFilter,
    search,
    setSearch,
    count,
    typeCount,
  };
}
