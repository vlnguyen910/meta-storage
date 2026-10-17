import type { FacilityAssignmentRole } from "@metastorage/contracts";
import type { Role } from "@metastorage/database";
import { ForbiddenError } from "../../common/errors/app-error";
import { FACILITY_MESSAGES } from "./facilities.messages";
import type { FacilityAssignmentsRepository } from "./facility-assignments.repository";

export type AssignedFacilityScope = {
  kind: "assigned";
  userId: string;
  role: FacilityAssignmentRole;
};

export type GlobalFacilityScope = {
  kind: "global";
  userId: string;
  role: "SYSTEM_ADMIN" | "BUSINESS_OPERATION_MANAGER";
};

export type FacilityScope = AssignedFacilityScope | GlobalFacilityScope;
export type FacilityListScope = FacilityScope | { kind: "public" };

type FacilityUser = { id: string; role: Role | null | undefined };

function isFacilityRole(role: Role | null | undefined): role is FacilityAssignmentRole {
  return role === "FACILITY_STAFF" || role === "FACILITY_MANAGER";
}

function isGlobalFacilityRole(role: Role | null | undefined): role is GlobalFacilityScope["role"] {
  return role === "SYSTEM_ADMIN" || role === "BUSINESS_OPERATION_MANAGER";
}

export function getFacilityListScope(user: FacilityUser): FacilityListScope {
  if (isFacilityRole(user.role)) {
    return { kind: "assigned", userId: user.id, role: user.role };
  }
  if (isGlobalFacilityRole(user.role)) {
    return { kind: "global", userId: user.id, role: user.role };
  }
  if (user.role === "CUSTOMER") {
    return { kind: "public" };
  }
  throw new ForbiddenError(FACILITY_MESSAGES.facilityListAccessDenied);
}

export function getFacilityAccessScope(user: FacilityUser): FacilityScope {
  if (isFacilityRole(user.role)) {
    return { kind: "assigned", userId: user.id, role: user.role };
  }
  if (isGlobalFacilityRole(user.role)) {
    return { kind: "global", userId: user.id, role: user.role };
  }
  throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
}

export async function requireAssignedFacility(
  repository: FacilityAssignmentsRepository,
  facilityId: string,
  scope: FacilityScope,
  allowedRoles?: readonly FacilityAssignmentRole[],
): Promise<FacilityScope> {
  if (scope.kind === "global") return scope;

  if (allowedRoles && !allowedRoles.includes(scope.role)) {
    throw new ForbiddenError(FACILITY_MESSAGES.facilityOperationDenied);
  }

  const assignment = await repository.findActiveAssignment(facilityId, scope.userId, scope.role);
  if (!assignment) {
    throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
  }
  return scope;
}
