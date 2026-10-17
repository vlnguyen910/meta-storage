import {
  and,
  type Database,
  eq,
  facilityAssignments,
  getTableColumns,
  gt,
  isNull,
  or,
  sql,
  users,
} from "@metastorage/database";

export class AuthRepository {
  constructor(private readonly db: Database) {}

  async findUserByEmail(email: string) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(btrim(${users.email})) = ${email.trim().toLowerCase()}`);
    return user ?? null;
  }

  async findSessionUserById(id: string) {
    const [user] = await this.db
      .select({ ...getTableColumns(users), assignedFacilityId: facilityAssignments.facilityId })
      .from(users)
      .leftJoin(
        facilityAssignments,
        and(
          eq(facilityAssignments.userId, users.id),
          eq(facilityAssignments.role, users.role),
          or(eq(users.role, "FACILITY_STAFF"), eq(users.role, "FACILITY_MANAGER")),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .where(eq(users.id, id));
    return user;
  }
}
