import type { ApiFacility, ApiFacilityAssignment, FacilityAssignmentRole } from "@storex/contracts";
import type { Facility, FacilityAssignment } from "@storex/database";

export function toApiFacility(facility: Facility): ApiFacility {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    address: facility.address,
    description: facility.description,
    isActive: facility.isActive,
    createdAt: facility.createdAt.toISOString(),
    updatedAt: facility.updatedAt.toISOString(),
  };
}

export function toApiFacilityAssignment(
  assignment: FacilityAssignment,
  extra?: { userName?: string; userEmail?: string; facilityName?: string; facilityCode?: string },
): ApiFacilityAssignment {
  return {
    id: assignment.id,
    userId: assignment.userId,
    facilityId: assignment.facilityId,
    assignedAt: assignment.assignedAt.toISOString(),
    endedAt: assignment.endedAt ? assignment.endedAt.toISOString() : null,
    isActive: assignment.isActive,
    role: assignment.role as FacilityAssignmentRole,
    userName: extra?.userName,
    userEmail: extra?.userEmail,
    facilityName: extra?.facilityName,
    facilityCode: extra?.facilityCode,
  };
}
