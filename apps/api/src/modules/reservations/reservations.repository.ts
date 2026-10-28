import type { ReservationQuery } from "@metastorage/contracts";
import {
  and,
  count,
  type Database,
  desc,
  eq,
  facilities,
  ReservationStatus,
  reservations,
  unitTypes,
} from "@metastorage/database";
import { RESERVATION_MESSAGES } from "./reservations.messages";

export class ReservationsRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const [row] = await this.db.select().from(reservations).where(eq(reservations.id, id));
    return row;
  }

  async findActiveUnitType(facilityId: string, unitTypeId: string) {
    const [row] = await this.db
      .select({ unitType: unitTypes })
      .from(unitTypes)
      .innerJoin(facilities, eq(unitTypes.facilityId, facilities.id))
      .where(
        and(
          eq(unitTypes.id, unitTypeId),
          eq(unitTypes.facilityId, facilityId),
          eq(unitTypes.isActive, true),
          eq(facilities.isActive, true),
        ),
      );
    return row?.unitType;
  }

  async list(query: ReservationQuery, ownerId?: string, facilityId?: string) {
    const where = and(
      ownerId ? eq(reservations.customerId, ownerId) : undefined,
      facilityId ? eq(reservations.facilityId, facilityId) : undefined,
      query.status ? eq(reservations.status, query.status) : undefined,
    );
    const [items, [total]] = await Promise.all([
      this.db
        .select()
        .from(reservations)
        .where(where)
        .orderBy(desc(reservations.createdAt), desc(reservations.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(reservations).where(where),
    ]);
    return { items, total: total?.value ?? 0, limit: query.limit, offset: query.offset };
  }

  async create(input: typeof reservations.$inferInsert) {
    const [row] = await this.db.insert(reservations).values(input).returning();
    if (!row) throw new Error(RESERVATION_MESSAGES.createFailed);
    return row;
  }

  async updateDraft(
    id: string,
    customerId: string,
    values: Partial<typeof reservations.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(reservations)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(reservations.id, id),
          eq(reservations.customerId, customerId),
          eq(reservations.status, ReservationStatus.DRAFT),
        ),
      )
      .returning();
    return row;
  }
}
