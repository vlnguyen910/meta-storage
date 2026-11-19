"use client";

import {
  type AssignBookingStaffInput,
  type AssignPhysicalUnitInput,
  FacilityTaskReferenceType,
  FacilityTaskType,
} from "@metastorage/contracts";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@metastorage/database/schema/appointments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadAppointmentItem } from "@/features/facility-flow/use-dispatch";
import { api } from "@/lib/api";
import { bookingKeys } from "./booking.keys";

const facilityKeys = {
  all: ["facilities"] as const,
  myAssignments: () => [...facilityKeys.all, "my-assignments"] as const,
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

export function useEligibleUnits(
  item: Awaited<ReturnType<typeof loadAppointmentItem>> | undefined,
) {
  return useQuery({
    queryKey: [
      ...bookingKeys.eligibleUnits(item?.id ?? ""),
      item?.facilityId,
      item?.unitTypeId,
      item?.assignedUnit?.physicalUnitId,
    ],
    queryFn: async () => {
      if (!item) throw new Error();
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
    enabled: Boolean(item),
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
    mutationFn: async ({
      bookingId,
      input,
      appointmentType,
      facilityId,
    }: {
      bookingId: string;
      input: AssignBookingStaffInput;
      appointmentType?: string;
      facilityId?: string;
    }) => {
      if (appointmentType === APPOINTMENT_TYPES.SUPPORT && facilityId) {
        try {
          const tasks = await api.flow5.tasks.listFacility({ limit: 100, offset: 0 });
          const existing = tasks.items.find(
            (t) =>
              t.referenceType === FacilityTaskReferenceType.SUPPORT_TICKET &&
              t.referenceId === bookingId &&
              t.status !== "CANCELLED",
          );
          if (existing) {
            return await api.flow5.tasks.update(existing.id, {
              assignedStaffId: input.staffId,
            });
          }
        } catch {
          // If query fails, fall through to create
        }
        return await api.flow5.tasks.create({
          facilityId,
          assignedStaffId: input.staffId,
          type: FacilityTaskType.HANDLE_SUPPORT,
          referenceType: FacilityTaskReferenceType.SUPPORT_TICKET,
          referenceId: bookingId,
          description: input.notes?.trim() || "Xử lý yêu cầu hỗ trợ",
        });
      }

      return await api.appointments.update(bookingId, {
        assignedStaffId: input.staffId,
        status: APPOINTMENT_STATUSES.CONFIRMED,
        notes: input.notes,
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["facility-flow"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["flow5"] }),
        queryClient.invalidateQueries({ queryKey: ["facility-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["facility-support-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-tabs"] }),
        queryClient.invalidateQueries({ queryKey: ["support"] }),
        queryClient.invalidateQueries({ queryKey: ["support-detail"] }),
      ]),
  });
}
