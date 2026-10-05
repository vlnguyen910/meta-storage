"use client";
import type { BookingListItem } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { bookingKeys } from "@/features/check-in/hooks";
import { api } from "@/lib/api";
export function readiness(b: BookingListItem, now = Date.now()) {
  if (b.status === "CHECKED_IN") return "CHECKED_IN";
  if (b.status === "CANCELLED") return "CANCELLED";
  if (b.status === "NO_SHOW") return "NO_SHOW";
  if (!b.paidAt) return "PAYMENT_PENDING";
  if (b.checkInSlotEnd && now > new Date(b.checkInSlotEnd).getTime() + 7200000) return "NO_SHOW";
  if (!b.assignedUnit) return "NEEDS_UNIT";
  if (!b.assignedStaff) return "NEEDS_STAFF";
  if (!b.checkInSlotEnd) return "SLOT_MISSING";
  if (now < new Date(b.checkInSlotStart).getTime()) return "TOO_EARLY";
  if (b.handoverStage === "INSPECTING" || b.handoverStage === "READY_HANDOVER")
    return b.handoverStage;
  return "READY";
}
export function useDispatch(facilityId: string, staff = false) {
  const query = useQuery({
    queryKey: staff ? bookingKeys.staffTasks(facilityId) : bookingKeys.facility(facilityId),
    queryFn: () =>
      staff
        ? api.bookings.listAssignedToMe(facilityId)
        : api.bookings.listFacilityBookings(facilityId),
    enabled: !!facilityId,
    refetchInterval: 30000,
  });
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const bookings = query.data ?? [];
  const filtered = bookings.filter(
    (b) =>
      (filter === "ALL" || readiness(b, now) === filter) &&
      [b.bookingCode, b.contactName, b.contactPhone, b.assignedUnit?.physicalUnitCode ?? ""].some(
        (v) => v.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const count = (status: string) => bookings.filter((b) => readiness(b, now) === status).length;
  return { query, bookings, filtered, filter, setFilter, search, setSearch, count, now };
}
