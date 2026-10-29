import type {
  FacilityRentalHistoryQuery,
  FacilityRentalListQuery,
  RentalPageQuery,
} from "@metastorage/contracts";
import {
  alias,
  and,
  asc,
  bookings,
  count,
  users as customerUsers,
  type Database,
  desc,
  eq,
  facilities,
  gt,
  ilike,
  or,
  payments,
  RentalStatus,
  rentals,
  reservations,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";

const bookingCustomer = alias(customerUsers, "booking_customer");

import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";
import type { RentalQueryExecutor } from "./rentals.types";

export class RentalsRepository {
  constructor(private readonly db: Database) {}

  async findAppointmentContext(tx: TaskTransaction, id: string, customerId: string) {
    const [row] = await tx
      .select({ rental: rentals, facilityId: storageUnits.facilityId })
      .from(rentals)
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(and(eq(rentals.id, id), eq(rentals.userId, customerId)))
      .for("update", { of: rentals });
    return row;
  }

  async findRentalByReservationId(tx: TaskTransaction, reservationId: string) {
    const [rental] = await tx
      .select()
      .from(rentals)
      .where(eq(rentals.reservationId, reservationId));
    return rental;
  }

  findRentalByBookingId(executor: RentalQueryExecutor, bookingId: string) {
    return executor.select().from(rentals).where(eq(rentals.bookingId, bookingId)).limit(1);
  }
  createForHandover(
    tx: TaskTransaction,
    input: {
      bookingId?: string;
      reservationId?: string;
      userId: string;
      storageUnitId: string;
      startAt: Date;
      endAt: Date;
    },
  ) {
    return tx.insert(rentals).values(input).returning();
  }
  private buildRentalDetailsQuery(executor: RentalQueryExecutor = this.db) {
    return executor
      .select({
        rental: rentals,
        booking: {
          id: sql<string>`coalesce(${bookings.id}, ${reservations.id})`,
          bookingCode: sql<
            string | null
          >`coalesce(${bookings.bookingCode}, upper(left(${reservations.id}::text, 8)))`,
          facilityId: sql<string>`coalesce(${bookings.facilityId}, ${reservations.facilityId})`,
          unitTypeId: sql<string>`coalesce(${bookings.unitTypeId}, ${reservations.unitTypeId})`,
          contactPhone: sql<string | null>`${bookings.contactPhone}`,
          status: sql<string>`coalesce(${bookings.status}::text, ${reservations.status}::text)`,
        },
        facility: facilities,
        unitType: unitTypes,
        storageUnit: storageUnits,
        customer: bookingCustomer,
        // Preserve PostgreSQL precision for keyset pagination.
        cursorEndAt: sql<string>`to_char(${rentals.endAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(rentals)
      .leftJoin(
        bookings,
        and(eq(bookings.id, rentals.bookingId), eq(bookings.userId, rentals.userId)),
      )
      .leftJoin(
        reservations,
        and(
          eq(reservations.id, rentals.reservationId),
          eq(reservations.customerId, rentals.userId),
        ),
      )
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, rentals.userId))
      .innerJoin(
        facilities,
        eq(facilities.id, sql`coalesce(${bookings.facilityId}, ${reservations.facilityId})`),
      )
      .innerJoin(
        unitTypes,
        eq(unitTypes.id, sql`coalesce(${bookings.unitTypeId}, ${reservations.unitTypeId})`),
      )
      .innerJoin(
        storageUnits,
        and(
          eq(storageUnits.id, rentals.storageUnitId),
          eq(
            storageUnits.facilityId,
            sql`coalesce(${bookings.facilityId}, ${reservations.facilityId})`,
          ),
        ),
      );
  }
  async findCustomerRentals(userId: string, query: RentalPageQuery) {
    const end = query.afterEndAt ? sql`${query.afterEndAt}::timestamptz` : undefined;
    return this.buildRentalDetailsQuery()
      .where(
        and(
          eq(rentals.userId, userId),
          eq(rentals.status, query.view === "history" ? RentalStatus.CLOSED : RentalStatus.ACTIVE),
          end && query.afterId
            ? or(gt(rentals.endAt, end), and(eq(rentals.endAt, end), gt(rentals.id, query.afterId)))
            : undefined,
        ),
      )
      .orderBy(asc(rentals.endAt), asc(rentals.id))
      .limit(query.limit + 1);
  }
  async findCustomerRentalById(rentalId: string, userId: string) {
    const [row] = await this.buildRentalDetailsQuery().where(
      and(eq(rentals.id, rentalId), eq(rentals.userId, userId)),
    );
    return row;
  }
  findFacilityRentals(facilityId: string, query: FacilityRentalListQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = and(
          sql`coalesce(${bookings.facilityId}, ${reservations.facilityId}) = ${facilityId}`,
          query.status ? eq(rentals.status, query.status as RentalStatus) : undefined,
          query.unitTypeId
            ? sql`coalesce(${bookings.unitTypeId}, ${reservations.unitTypeId}) = ${query.unitTypeId}`
            : undefined,
          query.search
            ? or(
                ilike(bookings.bookingCode, `%${query.search}%`),
                ilike(bookingCustomer.name, `%${query.search}%`),
                ilike(storageUnits.code, `%${query.search}%`),
              )
            : undefined,
        );
        const rows = await this.buildRentalDetailsQuery(tx)
          .where(filter)
          .orderBy(asc(rentals.endAt), asc(rentals.id))
          .limit(query.limit)
          .offset(query.offset);
        const [total] = await tx
          .select({ value: count() })
          .from(this.buildRentalDetailsQuery(tx).where(filter).as("scoped_rentals"));
        return { items: rows, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async findFacilityRentalById(facilityId: string, rentalId: string) {
    const [row] = await this.buildRentalDetailsQuery().where(
      and(
        sql`coalesce(${bookings.facilityId}, ${reservations.facilityId}) = ${facilityId}`,
        eq(rentals.id, rentalId),
      ),
    );
    return row;
  }
  findCustomerRentalPayments(rentalId: string, userId: string) {
    return this.db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(
        rentals,
        or(
          eq(rentals.bookingId, payments.bookingId),
          eq(rentals.reservationId, payments.reservationId),
          eq(rentals.id, payments.rentalId),
        ),
      )
      .where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
      .orderBy(asc(payments.createdAt), asc(payments.id));
  }
  findBookingPayments(
    bookingId: string | null,
    query: FacilityRentalHistoryQuery,
    reservationId?: string | null,
    rentalId?: string,
  ) {
    return this.db.transaction(
      async (tx) => {
        const filter =
          or(
            bookingId ? eq(payments.bookingId, bookingId) : undefined,
            reservationId ? eq(payments.reservationId, reservationId) : undefined,
            rentalId ? eq(payments.rentalId, rentalId) : undefined,
          ) ?? sql`false`;
        const [total] = await tx.select({ value: count() }).from(payments).where(filter);
        const items = await tx
          .select()
          .from(payments)
          .where(filter)
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
