import type { FacilityWorkspaceQuery } from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  count,
  type Database,
  eq,
  exists,
  getTableColumns,
  ilike,
  or,
  payments,
  rentalCharges,
  rentals,
  sql,
  storageUnits,
  unitTypes,
  users,
} from "@metastorage/database";
import { workspaceMembership } from "./workspace-scope";
export class FacilityRentalsRepository {
  constructor(private readonly db: Database) {}
  async allowed(actorId: string, facilityId: string) {
    return Boolean(
      (
        await this.db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.id, actorId),
              workspaceMembership(this.db, actorId, "FACILITY_MANAGER", facilityId),
            ),
          )
      )[0],
    );
  }
  private scope(actorId: string) {
    return workspaceMembership(this.db, actorId, "FACILITY_MANAGER", sql`${rentals.facilityId}`);
  }
  private fields() {
    return {
      ...getTableColumns(rentals),
      bookingCode: bookings.bookingCode,
      customerId: bookings.userId,
      customerName: users.name,
      customerEmail: users.email,
      customerPhone: bookings.contactPhone,
      unitCode: storageUnits.code,
      unitTypeName: unitTypes.name,
    };
  }
  async list(actorId: string, query: FacilityWorkspaceQuery) {
    const condition = and(
      this.scope(actorId),
      eq(rentals.facilityId, query.facilityId),
      query.status ? eq(rentals.status, query.status) : undefined,
      query.search
        ? or(
            ilike(users.name, `%${query.search}%`),
            ilike(bookings.bookingCode, `%${query.search}%`),
            ilike(storageUnits.code, `%${query.search}%`),
          )
        : undefined,
    );
    const items = await this.db
      .select(this.fields())
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
      .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
      .where(condition)
      .orderBy(asc(rentals.expectedEndAt), asc(rentals.id))
      .limit(query.limit)
      .offset(query.offset);
    const [total] = await this.db
      .select({ total: count() })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
      .where(condition);
    return { items, total: total?.total ?? 0 };
  }
  async get(actorId: string, id: string) {
    const [item] = await this.db
      .select(this.fields())
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
      .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
      .where(and(this.scope(actorId), eq(rentals.id, id)));
    if (!item) return null;
    const history = await this.db
      .select({
        id: payments.id,
        paymentCode: payments.paymentCode,
        status: payments.status,
        provider: payments.provider,
        totalAmount: payments.totalAmount,
        currency: payments.currency,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        category: rentalCharges.category,
      })
      .from(payments)
      .leftJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
      .where(
        and(
          or(eq(payments.bookingId, item.bookingId), eq(rentalCharges.rentalId, id)),
          this.scopePayment(actorId, id),
        ),
      )
      .orderBy(asc(payments.createdAt), asc(payments.id));
    return { item, history };
  }
  private scopePayment(actorId: string, id: string) {
    return exists(
      this.db
        .select({ id: rentals.id })
        .from(rentals)
        .where(and(eq(rentals.id, id), this.scope(actorId))),
    );
  }
}
