import type {
  CreateReservationInput,
  ReservationQuery,
  UpdateReservationInput,
} from "@metastorage/contracts";
import {
  and,
  type Database,
  desc,
  eq,
  facilities,
  reservations,
  unitTypes,
} from "@metastorage/database";

export class ReservationsRepository {
  constructor(private readonly db: Database) {}

  async unitTypeAvailable(facilityId: string, unitTypeId: string) {
    const [row] = await this.db
      .select({ id: unitTypes.id })
      .from(unitTypes)
      .innerJoin(facilities, eq(facilities.id, unitTypes.facilityId))
      .where(
        and(
          eq(unitTypes.id, unitTypeId),
          eq(unitTypes.facilityId, facilityId),
          eq(unitTypes.isActive, true),
          eq(facilities.isActive, true),
        ),
      );
    return !!row;
  }

  create(
    values: Omit<CreateReservationInput, "rentalStartAt"> & {
      customerId: string;
      rentalStartAt: Date;
      rentalEndAt: Date;
      monthlyRateSnapshot: number;
      rentalFeeAmount: number;
      depositAmount: number;
      totalAmount: number;
    },
  ) {
    return this.db
      .insert(reservations)
      .values(values)
      .returning()
      .then(([row]) => row);
  }

  list(query: ReservationQuery, customerId?: string) {
    return this.db
      .select()
      .from(reservations)
      .where(
        and(
          customerId ? eq(reservations.customerId, customerId) : undefined,
          query.facilityId ? eq(reservations.facilityId, query.facilityId) : undefined,
          query.status ? eq(reservations.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(reservations.createdAt));
  }

  async get(id: string) {
    const [row] = await this.db.select().from(reservations).where(eq(reservations.id, id));
    return row;
  }

  async update(id: string, values: UpdateReservationInput) {
    const [row] = await this.db
      .update(reservations)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, id))
      .returning();
    return row;
  }
}
