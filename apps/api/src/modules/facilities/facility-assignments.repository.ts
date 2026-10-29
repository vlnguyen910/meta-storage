import type { FacilityAssignmentRole, FacilityStaffMember } from "@metastorage/contracts";
import { FacilityTaskStatus } from "@metastorage/contracts/facility-tasks";
import {
  and,
  bookings,
  type Database,
  desc,
  eq,
  exists,
  type FacilityAssignment,
  facilities,
  facilityAssignments,
  facilityTasks,
  gt,
  inArray,
  isNull,
  lte,
  type NewFacilityAssignment,
  or,
  sql,
  users,
} from "@metastorage/database";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { AssignedFacilityScope, FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";
import { hasOpenAssignedWork } from "./staff-work.repository";

export type FacilityAssignmentTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class FacilityAssignmentsRepository {
  constructor(private readonly db: Database) {}

  async findFacilityStaff(facilityId: string): Promise<FacilityStaffMember[]> {
    const taskCountSql = sql<number>`(
      (select count(*)::int from ${facilityTasks}
       where ${facilityTasks.assignedStaffId} = ${users.id}
         and ${facilityTasks.facilityId} = ${facilityId}
         and ${facilityTasks.status} in (${FacilityTaskStatus.ASSIGNED}, ${FacilityTaskStatus.IN_PROGRESS}))
      +
      (select count(*)::int from ${bookings}
       where ${bookings.assignedStaffId} = ${users.id}
         and ${bookings.facilityId} = ${facilityId}
         and ${bookings.status} = 'CONFIRMED'
         and not exists (
           select 1 from ${facilityTasks} t
           where t.reference_type = 'BOOKING' and t.reference_id = ${bookings.id}
             and t.type = 'CHECK_IN_HANDOVER' and t.status in ('ASSIGNED', 'IN_PROGRESS')
         ))
    )`.mapWith(Number);

    const rows = await this.db
      .select({
        user: users,
        assignment: facilityAssignments,
        taskCount: taskCountSql,
      })
      .from(users)
      .innerJoin(facilityAssignments, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.role, "FACILITY_STAFF"),
          eq(facilityAssignments.isActive, true),
          eq(users.status, "ACTIVE"),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      );

    return rows.map(({ user, taskCount }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: UserRole.FACILITY_STAFF,
      isActive: true,
      assignedTasksCount: taskCount ?? 0,
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

  async lockActiveAssignments(
    tx: FacilityAssignmentTransaction,
    facilityId: string,
    expected: readonly { userId: string; role: FacilityAssignmentRole }[],
  ): Promise<Set<string>> {
    const userIds = [...new Set(expected.map(({ userId }) => userId))].sort();
    if (!userIds.length) return new Set();

    const people = await tx
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(inArray(users.id, userIds))
      .orderBy(users.id)
      .for("update");
    const assignments = await tx
      .select({ userId: facilityAssignments.userId, role: facilityAssignments.role })
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          inArray(facilityAssignments.userId, userIds),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .orderBy(facilityAssignments.userId)
      .for("update");

    const activeUsers = new Map(
      people.filter((user) => user.status === "ACTIVE").map((user) => [user.id, user.role]),
    );
    const activeRoles = new Map(assignments.map(({ userId, role }) => [userId, role]));
    return new Set(
      expected
        .filter(
          ({ userId, role }) =>
            activeUsers.get(userId) === role && activeRoles.get(userId) === role,
        )
        .map(({ userId }) => userId),
    );
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

  async findAssignmentTarget(userId: string) {
    const [user] = await this.db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, userId));
    return user;
  }

  async deactivateAssignmentWithWorkCheck(
    facilityId: string,
    userId: string,
  ): Promise<
    { assignment: FacilityAssignment } | { error: "ASSIGNMENT_NOT_FOUND" | "ASSIGNED_WORK" }
  > {
    return this.db.transaction(async (tx) => {
      // Serialize against new/reassigned tasks using the same user-first lock order.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
      const [assignment] = await tx
        .select()
        .from(facilityAssignments)
        .where(
          and(
            eq(facilityAssignments.facilityId, facilityId),
            eq(facilityAssignments.userId, userId),
          ),
        )
        .for("update");
      if (!assignment) return { error: "ASSIGNMENT_NOT_FOUND" };
      if (assignment.isActive && (await hasOpenAssignedWork(tx, userId, facilityId)))
        return { error: "ASSIGNED_WORK" };
      const [deactivated] = await tx
        .update(facilityAssignments)
        .set({ isActive: false, endedAt: new Date() })
        .where(
          and(
            eq(facilityAssignments.facilityId, facilityId),
            eq(facilityAssignments.userId, userId),
          ),
        )
        .returning();
      if (!deactivated) return { error: "ASSIGNMENT_NOT_FOUND" };
      return { assignment: deactivated };
    });
  }

  async upsertAssignment(data: NewFacilityAssignment): Promise<FacilityAssignment> {
    try {
      return await this.db.transaction(async (tx) => {
        // Serialize reassignments for a User, including when no assignment exists yet.
        const [user] = await tx
          .select({ id: users.id, role: users.role, status: users.status })
          .from(users)
          .where(eq(users.id, data.userId))
          .for("update");
        if (!user) throw new NotFoundError(FACILITY_MESSAGES.userNotFound(data.userId));
        if (user.status !== "ACTIVE")
          throw new ForbiddenError(FACILITY_MESSAGES.inactiveUserAssignment);
        if (
          user.role !== data.role ||
          (data.role !== "FACILITY_STAFF" && data.role !== "FACILITY_MANAGER")
        )
          throw new ForbiddenError(FACILITY_MESSAGES.assignmentRoleMismatch);
        const now = new Date();
        const [previous] = await tx
          .select()
          .from(facilityAssignments)
          .where(
            and(
              eq(facilityAssignments.userId, data.userId),
              eq(facilityAssignments.isActive, true),
            ),
          )
          .for("update");
        if (previous && previous.facilityId !== data.facilityId) {
          if (!previous.endedAt || previous.endedAt > now)
            throw new ConflictError(FACILITY_MESSAGES.userAlreadyAssigned);
          if (await hasOpenAssignedWork(tx, data.userId, previous.facilityId))
            throw new ConflictError(FACILITY_MESSAGES.openWorkPreventsRevocation);
        }
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
