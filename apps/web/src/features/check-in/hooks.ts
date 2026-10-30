"use client";

import type {
  AssignBookingStaffInput,
  AssignPhysicalUnitInput,
  CheckInLookupInput,
} from "@metastorage/contracts";
import { APPOINTMENT_STATUSES } from "@metastorage/database/schema/appointments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadAppointmentItem } from "@/features/facility-flow/use-dispatch";
import { api } from "@/lib/api";

export const bookingKeys = {
  all: ["bookings"] as const,
  facility: (facilityId: string, status?: string) =>
    [...bookingKeys.all, "facility", facilityId, status] as const,
  facilityStaff: (facilityId: string) =>
    [...bookingKeys.all, "facility-staff", facilityId] as const,
  staffTasks: (facilityId?: string) => [...bookingKeys.all, "staff-tasks", facilityId] as const,
  detail: (id: string) => [...bookingKeys.all, "detail", id] as const,
  eligibleUnits: (id: string) => [...bookingKeys.all, "eligible-units", id] as const,
};

export const facilityKeys = {
  all: ["facilities"] as const,
  myAssignments: () => [...facilityKeys.all, "my-assignments"] as const,
};

export const checkInKeys = {
  all: ["check-ins"] as const,
  lookup: (input: CheckInLookupInput) => [...checkInKeys.all, input.type, input.value] as const,
};

export function useMyFacilityAssignments() {
  return useQuery({
    queryKey: facilityKeys.myAssignments(),
    queryFn: api.facilities.myAssignments,
  });
}

export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => loadAppointmentItem(bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useEligibleUnits(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.eligibleUnits(bookingId),
    queryFn: async () => {
      const item = await loadAppointmentItem(bookingId);
      const units = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.flow5.units.list({
          facilityId: item.facilityId,
          unitTypeId: item.unitTypeId,
          limit: 100,
          offset,
        });
        units.push(...page.items);
        if (offset + page.items.length >= page.total || !page.items.length) break;
      }
      return units.map((unit) => ({
        ...unit,
        isAvailableForPeriod:
          unit.status === "AVAILABLE" || unit.id === item.assignedUnit?.physicalUnitId,
      }));
    },
    enabled: Boolean(bookingId),
  });
}

export function useAssignPhysicalUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ bookingId, input }: { bookingId: string; input: AssignPhysicalUnitInput }) =>
      api.appointments.update(bookingId, {
        physicalUnitId: input.physicalUnitId,
        assignmentReason: input.reason,
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["facility-flow"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      ]),
  });
}

export function useFacilityStaff(facilityId: string) {
  return useQuery({
    queryKey: bookingKeys.facilityStaff(facilityId),
    queryFn: () => api.facilities.getStaff(facilityId),
    enabled: Boolean(facilityId),
  });
}

export function useAssignStaffMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ bookingId, input }: { bookingId: string; input: AssignBookingStaffInput }) =>
      api.appointments.update(bookingId, {
        assignedStaffId: input.staffId,
        status: APPOINTMENT_STATUSES.CONFIRMED,
        notes: input.notes,
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["facility-flow"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["flow5"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-tabs"] }),
      ]),
  });
}
