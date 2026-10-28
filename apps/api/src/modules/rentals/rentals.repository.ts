import type {
  FacilityRentalHistoryQuery,
  FacilityRentalListQuery,
  RentalDetail,
  RentalListItem,
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
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { RENTAL_MESSAGES as M } from "./rentals.messages";
import type { RentalReadExecutor } from "./rentals.types";

export class RentalsRepository {
  constructor(private readonly db: Database) {}

  findByBookingId(executor: RentalReadExecutor, bookingId: string) {
    return executor.select().from(rentals).where(eq(rentals.bookingId, bookingId)).limit(1);
  }
  managerAssignment(facilityId: string, userId: string) {
    return new FacilityAssignmentsRepository(this.db).findActiveAssignment(
      facilityId,
      userId,
      "FACILITY_MANAGER",
    );
  }
  private query(executor: RentalReadExecutor = this.db) {
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
  async listPageByUserId(userId: string, query: RentalPageQuery, history: boolean) {
    const end = query.afterEndAt ? sql`${query.afterEndAt}::timestamptz` : undefined;
    return this.query()
      .where(
        and(
          eq(rentals.userId, userId),
          eq(rentals.status, history ? RentalStatus.CLOSED : RentalStatus.ACTIVE),
          end && query.afterId
            ? or(gt(rentals.endAt, end), and(eq(rentals.endAt, end), gt(rentals.id, query.afterId)))
            : undefined,
        ),
      )
      .orderBy(asc(rentals.endAt), asc(rentals.id))
      .limit(query.limit + 1);
  }
  async findByIdAndUserId(id: string, userId: string): Promise<RentalDetail | null> {
    const [row] = await this.query().where(and(eq(rentals.id, id), eq(rentals.userId, userId)));
    return row
      ? {
          ...toListItem(row),
          customer: {
            userId: row.rental.userId,
            name: row.customer.name,
            email: row.customer.email,
            phone: row.booking.contactPhone,
          },
        }
      : null;
  }
  listForFacility(facilityId: string, query: FacilityRentalListQuery) {
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
        const rows = await this.query(tx)
          .where(filter)
          .orderBy(asc(rentals.endAt), asc(rentals.id))
          .limit(query.limit)
          .offset(query.offset);
        const [total] = await tx
          .select({ value: count() })
          .from(this.query(tx).where(filter).as("scoped_rentals"));
        return { items: rows, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async findForFacility(facilityId: string, id: string) {
    const [row] = await this.query().where(
      and(eq(bookings.facilityId, facilityId), eq(rentals.id, id)),
    );
    return row;
  }
  listPaymentsByUserId(rentalId: string, userId: string) {
    return this.db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(rentals, eq(rentals.bookingId, payments.bookingId))
      .where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
      .orderBy(asc(payments.createdAt), asc(payments.id));
  }
  facilityPayments(bookingId: string, query: FacilityRentalHistoryQuery) {
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

type RentalRow = Awaited<ReturnType<RentalsRepository["listPageByUserId"]>>[number];
export function toListItem(row: RentalRow): RentalListItem {
  return {
    id: row.rental.id,
    bookingId: row.booking.id,
    userId: row.rental.userId,
    bookingCode: row.booking.bookingCode ?? row.booking.id.slice(0, 8).toUpperCase(),
    facility: { id: row.facility.id, name: row.facility.name, address: row.facility.address },
    unitType: { id: row.unitType.id, name: row.unitType.name, sizeLabel: row.unitType.sizeLabel },
    storageUnit: { id: row.storageUnit.id, code: row.storageUnit.code },
    startAt: row.rental.startAt.toISOString(),
    endAt: row.rental.endAt.toISOString(),
    status: row.rental.status,
    bookingStatus: row.booking.status,
    actions: { canCancel: false, canReschedule: false, note: M.readOnly },
  };
}
