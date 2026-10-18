import type {
  ApiFacilityAssignment,
  FacilityAssignmentRole,
  FacilityStaffMember,
} from "@metastorage/contracts";
import type { Role } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import type { UsersRepository } from "../users/users.repository";
import type { FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";
import type { FacilitiesRepository } from "./facilities.repository";
import type { FacilityAssignmentsRepository } from "./facility-assignments.repository";

export class FacilityAssignmentsService {
  constructor(
    private readonly assignmentsRepository: FacilityAssignmentsRepository,
    private readonly facilitiesRepository: FacilitiesRepository,
    private readonly usersRepository?: UsersRepository,
  ) {}

  async getFacilityStaff(facilityId: string): Promise<FacilityStaffMember[]> {
    return this.assignmentsRepository.findFacilityStaff(facilityId);
  }

  async assignUserToFacility(
    facilityId: string,
    userId: string,
    role: FacilityAssignmentRole,
  ): Promise<ApiFacilityAssignment> {
    // 1. Verify facility exists and is active
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility) {
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(facilityId));
    }
    if (!facility.isActive) {
      throw new BadRequestError(FACILITY_MESSAGES.facilityInactiveAssignment);
    }

    // 2. Verify user exists, is active, and role matches
    let userName: string | undefined;
    let userEmail: string | undefined;
    if (this.usersRepository) {
      const user = await this.usersRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(FACILITY_MESSAGES.userNotFound(userId));
      }
      if (user.status !== "ACTIVE") {
        throw new BadRequestError(FACILITY_MESSAGES.inactiveUserAssignment);
      }
      if (user.role !== role) {
        throw new BadRequestError(FACILITY_MESSAGES.assignmentRoleMismatch);
      }
      userName = user.name;
      userEmail = user.email;
    }

    // 3. Verify user does not have an active assignment at another facility (F1 rule)
    const existingActive = await this.assignmentsRepository.findUserActiveAssignment(userId);
    if (existingActive && existingActive.facilityId !== facilityId) {
      throw new ConflictError(FACILITY_MESSAGES.userAlreadyAssigned);
    }

    // 4. Upsert assignment
    const now = new Date();
    const assignment = await this.assignmentsRepository.upsertAssignment({
      userId,
      facilityId,
      role,
      isActive: true,
      assignedAt: now,
      endedAt: null,
    });

    return {
      id: assignment.id,
      userId: assignment.userId,
      facilityId: assignment.facilityId,
      assignedAt: assignment.assignedAt.toISOString(),
      endedAt: assignment.endedAt ? assignment.endedAt.toISOString() : null,
      isActive: assignment.isActive,
      role: assignment.role as FacilityAssignmentRole,
      userName,
      userEmail,
      facilityName: facility.name,
      facilityCode: facility.code,
    };
  }

  async revokeAssignment(facilityId: string, userId: string): Promise<ApiFacilityAssignment> {
    const existing = await this.assignmentsRepository.findAssignment(facilityId, userId);
    if (!existing) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    // Check if staff has pending confirmed tasks
    const hasTasks = await this.assignmentsRepository.hasActiveConfirmedTasks(facilityId, userId);
    if (hasTasks) {
      throw new ConflictError(FACILITY_MESSAGES.staffHasPendingTasks);
    }

    const deactivated = await this.assignmentsRepository.deactivateAssignment(facilityId, userId);
    if (!deactivated) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    return {
      id: deactivated.id,
      userId: deactivated.userId,
      facilityId: deactivated.facilityId,
      assignedAt: deactivated.assignedAt.toISOString(),
      endedAt: deactivated.endedAt ? deactivated.endedAt.toISOString() : null,
      isActive: deactivated.isActive,
      role: deactivated.role as FacilityAssignmentRole,
    };
  }

  async listFacilityAssignments(
    facilityId: string,
    limit: number,
    offset: number,
    scope: FacilityScope,
  ): Promise<ApiFacilityAssignment[]> {
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
      id: assignment.id,
      userId: assignment.userId,
      facilityId: assignment.facilityId,
      assignedAt: assignment.assignedAt.toISOString(),
      endedAt: assignment.endedAt ? assignment.endedAt.toISOString() : null,
      isActive: assignment.isActive,
      role: assignment.role as FacilityAssignmentRole,
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
