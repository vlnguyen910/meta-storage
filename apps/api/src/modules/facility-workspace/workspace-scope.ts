import {
  and,
  type Database,
  eq,
  exists,
  facilityAssignments,
  gt,
  isNull,
  or,
  type SQL,
  users,
} from "@metastorage/database";
export function workspaceMembership(
  db: Database,
  userId: string,
  role: "FACILITY_MANAGER" | "FACILITY_STAFF",
  facilityId: string | SQL,
) {
  return exists(
    db
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
          eq(users.role, role),
          eq(users.status, "ACTIVE"),
        ),
      ),
  );
}
