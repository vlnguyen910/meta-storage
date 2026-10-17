"use client";

import type {
  AssignBookingStaffInput,
  AssignPhysicalUnitInput,
  CheckInLookupInput,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useCheckInLookupMutation() {
  return useMutation({
    mutationFn: (input: CheckInLookupInput) => api.checkIns.lookup(input),
  });
}

export function useCheckInConfirmMutation() {
  return useMutation({
    mutationFn: (bookingId: string) => api.checkIns.confirm(bookingId),
  });
}

export function useFacilityBookings(facilityId: string, status?: string) {
  return useQuery({
    queryKey: bookingKeys.facility(facilityId, status),
    queryFn: () => api.bookings.listFacilityBookings(facilityId, status),
    enabled: Boolean(facilityId),
  });
}

export function useMyFacilityAssignments() {
  return useQuery({
    queryKey: facilityKeys.myAssignments(),
    queryFn: api.facilities.myAssignments,
  });
}

export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => api.bookings.get(bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useEligibleUnits(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.eligibleUnits(bookingId),
    queryFn: () => api.bookings.getEligibleUnits(bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useAssignPhysicalUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: AssignPhysicalUnitInput }) =>
      api.bookings.assignUnit(bookingId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.bookingId) });
    },
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
    mutationFn: ({ bookingId, input }: { bookingId: string; input: AssignBookingStaffInput }) =>
      api.bookings.assignStaff(bookingId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.bookingId) });
    },
  });
}

export function useStaffTasks(facilityId?: string) {
  return useQuery({
    queryKey: bookingKeys.staffTasks(facilityId),
    queryFn: () => api.bookings.listAssignedToMe(facilityId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}
