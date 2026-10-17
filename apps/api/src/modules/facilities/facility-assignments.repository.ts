import { type FacilityStaffMember, UserRole } from "@metastorage/contracts";
import {
  and,
  type Database,
  desc,
  eq,
  exists,
  type FacilityAssignment,
  facilities,
  facilityAssignments,
  gt,
  isNull,
  lte,
  type NewFacilityAssignment,
  or,
  sql,
  users,
} from "@metastorage/database";
import { ConflictError } from "../../common/errors/app-error";
import type { AssignedFacilityScope, FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";

export class FacilityAssignmentsRepository {
  constructor(private readonly db: Database) {}

  async findFacilityStaff(facilityId: string): Promise<FacilityStaffMember[]> {
    const rows = await this.db
      .select({
        user: users,
        assignment: facilityAssignments,
      })
      .from(users)
      .innerJoin(facilityAssignments, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.role, "FACILITY_STAFF"),
          eq(facilityAssignments.isActive, true),
          eq(users.status, "ACTIVE"),
        ),
      );

    return rows.map(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: UserRole.FACILITY_STAFF,
      isActive: true,
    }));
  }

  activeAssignmentExists(facilityId: string | typeof facilities.id, scope: AssignedFacilityScope) {
    const facilityCondition =
      typeof facilityId === "string"
        ? eq(facilityAssignments.facilityId, facilityId)
        : eq(facilityAssignments.facilityId, facilityId);

    return exists(
      this.db
        .select({ one: sql`1` })
        .from(facilityAssignments)
        .where(
          and(
            facilityCondition,
            eq(facilityAssignments.userId, scope.userId),
            eq(facilityAssignments.role, scope.role),
            eq(facilityAssignments.isActive, true),
            or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
          ),
        ),
    );
  }

  async findActiveAssignment(
    facilityId: string,
    userId: string,
    role: AssignedFacilityScope["role"],
  ): Promise<FacilityAssignment | undefined> {
    const [assignment] = await this.db
      .select()
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      );
    return assignment;
  }

  async findAssignment(
    facilityId: string,
    userId: string,
  ): Promise<FacilityAssignment | undefined> {
    const [assignment] = await this.db
      .select()
      .from(facilityAssignments)
      .where(
        and(eq(facilityAssignments.facilityId, facilityId), eq(facilityAssignments.userId, userId)),
      );
    return assignment;
  }

  async upsertAssignment(data: NewFacilityAssignment): Promise<FacilityAssignment> {
    try {
      return await this.db.transaction(async (tx) => {
        // Serialize reassignments for a User, including when no assignment exists yet.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, data.userId))
          .for("update");
        const now = new Date();
        await tx
          .update(facilityAssignments)
          .set({ isActive: false })
          .where(
            and(
              eq(facilityAssignments.userId, data.userId),
              eq(facilityAssignments.isActive, true),
              lte(facilityAssignments.endedAt, now),
            ),
          );
        const [assignment] = await tx
          .insert(facilityAssignments)
          .values(data)
          .onConflictDoUpdate({
            target: [facilityAssignments.userId, facilityAssignments.facilityId],
            set: {
              role: data.role,
              isActive: true,
              endedAt: null,
              assignedAt: now,
            },
          })
          .returning();
        if (!assignment) throw new Error(FACILITY_MESSAGES.failedToUpsertAssignment);
        return assignment;
      });
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "23505" &&
        "constraint_name" in cause &&
        cause.constraint_name === "facility_assignments_active_user_idx"
      ) {
        throw new ConflictError(FACILITY_MESSAGES.userAlreadyAssigned);
      }
      throw error;
    }
  }

  async deactivateAssignment(
    facilityId: string,
    userId: string,
  ): Promise<FacilityAssignment | undefined> {
    const [deactivated] = await this.db
      .update(facilityAssignments)
      .set({
        isActive: false,
        endedAt: new Date(),
      })
      .where(
        and(eq(facilityAssignments.facilityId, facilityId), eq(facilityAssignments.userId, userId)),
      )
      .returning();
    return deactivated;
  }

  async listAssignmentsWithUsers(
    facilityId: string,
    limit: number,
    offset: number,
    scope: FacilityScope,
  ): Promise<
    Array<{
      assignment: FacilityAssignment;
      userName: string;
      userEmail: string;
    }>
  > {
    const rows = await this.db
      .select({
        assignment: facilityAssignments,
        userName: users.name,
        userEmail: users.email,
      })
      .from(facilityAssignments)
      .innerJoin(users, eq(facilityAssignments.userId, users.id))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          scope.kind === "assigned" ? this.activeAssignmentExists(facilityId, scope) : undefined,
        ),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(facilityAssignments.assignedAt));

    return rows;
  }

  async listUserAssignmentsWithFacilities(
    userId: string,
    role: AssignedFacilityScope["role"],
  ): Promise<
    Array<{
      assignment: FacilityAssignment;
      facilityName: string;
      facilityCode: string;
    }>
  > {
    const rows = await this.db
      .select({
        assignment: facilityAssignments,
        facilityName: facilities.name,
        facilityCode: facilities.code,
      })
      .from(facilityAssignments)
      .innerJoin(facilities, eq(facilityAssignments.facilityId, facilities.id))
      .where(
        and(
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .orderBy(desc(facilityAssignments.assignedAt));

    return rows;
  }
}
