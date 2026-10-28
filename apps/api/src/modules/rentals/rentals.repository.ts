import type {
  FacilityRentalHistoryQuery,
  FacilityRentalListQuery,
  RentalPageQuery,
} from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  count,
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
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import { bookingCustomer } from "../bookings/bookings.projection";
import type { RentalQueryExecutor } from "./rentals.types";

export class RentalsRepository {
  constructor(private readonly db: Database) {}

  findRentalByBookingId(executor: RentalQueryExecutor, bookingId: string) {
    return executor.select().from(rentals).where(eq(rentals.bookingId, bookingId)).limit(1);
  }
  private buildRentalDetailsQuery(executor: RentalQueryExecutor = this.db) {
    return executor
      .select({
        rental: rentals,
        booking: bookings,
        facility: facilities,
        unitType: unitTypes,
        storageUnit: storageUnits,
        customer: bookingCustomer,
        // Preserve PostgreSQL precision for keyset pagination.
        cursorEndAt: sql<string>`to_char(${rentals.endAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(rentals)
      .innerJoin(
        bookings,
        and(eq(bookings.id, rentals.bookingId), eq(bookings.userId, rentals.userId)),
      )
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, rentals.userId))
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .innerJoin(
        storageUnits,
        and(
          eq(storageUnits.id, rentals.storageUnitId),
          eq(storageUnits.facilityId, bookings.facilityId),
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
          eq(bookings.facilityId, facilityId),
          query.status ? eq(rentals.status, query.status as RentalStatus) : undefined,
          query.unitTypeId ? eq(bookings.unitTypeId, query.unitTypeId) : undefined,
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
      and(eq(bookings.facilityId, facilityId), eq(rentals.id, rentalId)),
    );
    return row;
  }
  findCustomerRentalPayments(rentalId: string, userId: string) {
    return this.db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(rentals, eq(rentals.bookingId, payments.bookingId))
      .where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
      .orderBy(asc(payments.createdAt), asc(payments.id));
  }
  findBookingPayments(bookingId: string, query: FacilityRentalHistoryQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = eq(payments.bookingId, bookingId);
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
