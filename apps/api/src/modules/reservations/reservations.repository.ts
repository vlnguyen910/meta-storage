import type { ReservationQuery } from "@metastorage/contracts";
import {
  and,
  type Database,
  desc,
  eq,
  facilities,
  facilityUnitTypes,
  getTableColumns,
  type NewReservationRecord,
  payments,
  type ReservationRecord,
  ReservationStatus,
  rentals,
  reservations,
  sql,
  unitTypes,
  users,
} from "@metastorage/database";

export type ReservationTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class ReservationsRepository {
  constructor(private readonly db: Database) {}

  findNoShows(tx: ReservationTransaction, now: Date, closingHour: number, facilityId?: string) {
    return tx
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.status, ReservationStatus.CONFIRMED),
          facilityId ? eq(reservations.facilityId, facilityId) : undefined,
          sql`((${reservations.rentalStartAt} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + ${closingHour} * interval '1 hour') AT TIME ZONE 'Asia/Ho_Chi_Minh' <= ${now.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(reservations.id)
      .limit(100)
      .for("update", { skipLocked: true });
  }

  transaction<T>(work: (tx: ReservationTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async create(data: NewReservationRecord, tx: ReservationTransaction) {
    const [reservation] = await tx.insert(reservations).values(data).returning();
    return reservation;
  }

  private readQuery() {
    return this.db
      .select({
        ...getTableColumns(reservations),
        user: { id: users.id, name: users.name, email: users.email, phone: users.phone },
        facility: { id: facilities.id, name: facilities.name, address: facilities.address },
        unitType: {
          id: facilityUnitTypes.id,
          name: unitTypes.name,
          sizeLabel: unitTypes.sizeLabel,
        },
        rentalId: sql<
          string | null
        >`(select ${rentals.id} from ${rentals} where ${rentals.reservationId} = ${reservations.id} limit 1)`,
        paymentStatus: sql<
          string | null
        >`(select ${payments.status}::text from ${payments} where ${payments.reservationId} = ${reservations.id} order by ${payments.createdAt} desc, ${payments.id} desc limit 1)`,
      })
      .from(reservations)
      .innerJoin(users, eq(users.id, reservations.customerId))
      .innerJoin(facilities, eq(facilities.id, reservations.facilityId))
      .innerJoin(facilityUnitTypes, eq(facilityUnitTypes.id, reservations.unitTypeId))
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId));
  }

  async findById(id: string) {
    const [reservation] = await this.readQuery().where(eq(reservations.id, id));
    return reservation;
  }

  async findByIdForUpdate(id: string, tx: ReservationTransaction) {
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, id))
      .for("update");
    return reservation;
  }

  list(query: ReservationQuery & { customerId?: string }) {
    return this.readQuery()
      .where(
        and(
          query.customerId ? eq(reservations.customerId, query.customerId) : undefined,
          query.facilityId ? eq(reservations.facilityId, query.facilityId) : undefined,
          query.status ? eq(reservations.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(reservations.createdAt), desc(reservations.id));
  }

  async updateStatus(id: string, status: ReservationRecord["status"], tx: ReservationTransaction) {
    const [reservation] = await tx
      .update(reservations)
      .set({ status, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return reservation;
  }
}
