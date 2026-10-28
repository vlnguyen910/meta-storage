import type { ReservationQuery } from "@metastorage/contracts";
import {
  and,
  count,
  type Database,
  desc,
  eq,
  facilities,
  type Reservation,
  reservations,
  unitTypes,
} from "@metastorage/database";
import type { PageDto } from "../../common/types/page.dto";
import { RESERVATION_MESSAGES } from "./reservations.messages";

export class ReservationsRepository {
  constructor(private readonly database: Database) {}

  async findReservationById(reservationId: string) {
    const [reservation] = await this.database
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId));
    return reservation;
  }

  async findActiveUnitType(facilityId: string, unitTypeId: string) {
    const [matchingUnitType] = await this.database
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
    return matchingUnitType?.unitType;
  }

  async listReservations(
    query: ReservationQuery,
    customerId?: string,
    facilityId?: string,
  ): Promise<PageDto<Reservation>> {
    const filterConditions = and(
      customerId ? eq(reservations.customerId, customerId) : undefined,
      facilityId ? eq(reservations.facilityId, facilityId) : undefined,
      query.status ? eq(reservations.status, query.status) : undefined,
    );
    const [reservationItems, [totalCount]] = await Promise.all([
      this.database
        .select()
        .from(reservations)
        .where(filterConditions)
        .orderBy(desc(reservations.createdAt), desc(reservations.id))
        .limit(query.limit)
        .offset(query.offset),
      this.database.select({ value: count() }).from(reservations).where(filterConditions),
    ]);
    return {
      items: reservationItems,
      total: totalCount?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createReservation(input: typeof reservations.$inferInsert) {
    const [reservation] = await this.database.insert(reservations).values(input).returning();
    if (!reservation) throw new Error(RESERVATION_MESSAGES.createFailed);
    return reservation;
  }

  async updateReservation(
    reservationId: string,
    customerId: string,
    updates: Partial<typeof reservations.$inferInsert>,
  ) {
    const [reservation] = await this.database
      .update(reservations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(reservations.id, reservationId), eq(reservations.customerId, customerId)))
      .returning();
    return reservation;
  }
}
