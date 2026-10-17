import type { FacilityStaffMember } from "@metastorage/contracts";
import type { FacilityAssignment, Role } from "@metastorage/database";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { FacilityScope } from "./facilities.access";
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

  async revokeAssignment(facilityId: string, userId: string): Promise<FacilityAssignment> {
    const existing = await this.assignmentsRepository.findAssignment(facilityId, userId);
    if (!existing) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    const deactivated = await this.assignmentsRepository.deactivateAssignment(facilityId, userId);
    if (!deactivated) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    return deactivated;
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
