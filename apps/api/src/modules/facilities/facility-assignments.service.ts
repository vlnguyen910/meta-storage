import type { FacilityAssignmentRole, FacilityStaffMember } from "@metastorage/contracts";
import type { FacilityAssignment, Role } from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { type FacilityScope, requireAssignedFacility } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";
import type { FacilitiesRepository } from "./facilities.repository";
import type { FacilityAssignmentsRepository } from "./facility-assignments.repository";

export class FacilityAssignmentsService {
  constructor(
    private readonly assignmentsRepository: FacilityAssignmentsRepository,
    private readonly facilitiesRepository: FacilitiesRepository,
  ) {}

  async getFacilityStaff(facilityId: string): Promise<FacilityStaffMember[]> {
    return this.assignmentsRepository.findFacilityStaff(facilityId);
  }

  async requireFacilityAccess(
    facilityId: string,
    scope: FacilityScope,
    allowedRoles?: readonly FacilityAssignmentRole[],
  ): Promise<FacilityScope> {
    return requireAssignedFacility(this.assignmentsRepository, facilityId, scope, allowedRoles);
  }

  async getActiveFacilityId(userId: string, role: FacilityAssignmentRole): Promise<string> {
    const [assignment] = await this.assignmentsRepository.listUserAssignmentsWithFacilities(
      userId,
      role,
    );
    if (!assignment) throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
    return assignment.assignment.facilityId;
  }

  async revokeAssignment(facilityId: string, userId: string): Promise<FacilityAssignment> {
    const result = await this.assignmentsRepository.deactivateAssignmentWithWorkCheck(
      facilityId,
      userId,
    );
    if ("error" in result) {
      if (result.error === "ASSIGNMENT_NOT_FOUND")
        throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
      throw new ConflictError(FACILITY_MESSAGES.openWorkPreventsRevocation);
    }
    return result.assignment;
  }

  async assignUser(facilityId: string, userId: string, role: Role): Promise<FacilityAssignment> {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility) throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(facilityId));

    const user = await this.assignmentsRepository.findAssignmentTarget(userId);
    if (!user) throw new NotFoundError(FACILITY_MESSAGES.userNotFound(userId));
    if (user.status !== "ACTIVE")
      throw new ForbiddenError(FACILITY_MESSAGES.inactiveUserAssignment);
    if (user.role !== role) throw new ForbiddenError(FACILITY_MESSAGES.assignmentRoleMismatch);
    if (role !== "FACILITY_STAFF" && role !== "FACILITY_MANAGER") {
      throw new ForbiddenError(FACILITY_MESSAGES.assignmentRoleMismatch);
    }

    return this.assignmentsRepository.upsertAssignment({
      facilityId,
      userId,
      role,
      isActive: true,
      endedAt: null,
    });
  }

  async listFacilityAssignments(
    facilityId: string,
    limit: number,
    offset: number,
    scope: FacilityScope,
  ) {
    this.assertManagerScope(scope);
    const facility = await this.facilitiesRepository.findAccessibleById(facilityId, scope);
    if (!facility) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(facilityId));
    }

    const rows = await this.assignmentsRepository.listAssignmentsWithUsers(
      facilityId,
      limit,
      offset,
      scope,
    );
    return rows.map(({ assignment, userName, userEmail }) => ({
      ...assignment,
      userName,
      userEmail,
      facilityName: facility.name,
      facilityCode: facility.code,
    }));
  }

  async listUserAssignments(userId: string, role: Role | null | undefined) {
    if (role !== "FACILITY_STAFF" && role !== "FACILITY_MANAGER") return [];
    const rows = await this.assignmentsRepository.listUserAssignmentsWithFacilities(userId, role);
    return rows.map(({ assignment, facilityName, facilityCode }) => ({
      ...assignment,
      facilityName,
      facilityCode,
    }));
  }

  private assertManagerScope(scope: FacilityScope): void {
    if (scope.kind === "assigned" && scope.role !== "FACILITY_MANAGER") {
      throw new ForbiddenError(FACILITY_MESSAGES.facilityOperationDenied);
    }
  }
}
