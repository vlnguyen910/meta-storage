import type {
  FacilityRentalHistoryQuery,
  FacilityRentalListQuery,
  RentalPageQuery,
  RentalRenewalPageQuery,
} from "@metastorage/contracts";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  alias,
  and,
  appointments,
  asc,
  bookings,
  capacityAllocations,
  count,
  users as customerUsers,
  type Database,
  desc,
  eq,
  exists,
  facilities,
  gt,
  InspectionStatus,
  InspectionType,
  ilike,
  inArray,
  inspections,
  or,
  PaymentType,
  payments,
  RentalRenewalStatus,
  RentalStatus,
  rentalRenewals,
  rentals,
  reservations,
  returnSettlements,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";
import type { RentalQueryExecutor, RentalTransaction } from "./rentals.types";

const bookingCustomer = alias(customerUsers, "booking_customer");

export class RentalsRepository {
  constructor(readonly db: Database) {}

  async findAppointmentContext(tx: TaskTransaction, id: string, customerId: string) {
    const [row] = await tx
      .select({ rental: rentals, facilityId: storageUnits.facilityId })
      .from(rentals)
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(and(eq(rentals.id, id), eq(rentals.userId, customerId)))
      .for("update", { of: rentals });
    return row;
  }
  async hasPendingRenewalPayment(tx: TaskTransaction, rentalId: string) {
    const [payment] = await tx
      .select({ id: payments.id })
      .from(rentalRenewals)
      .innerJoin(payments, eq(payments.renewalId, rentalRenewals.id))
      .where(
        and(
          eq(rentalRenewals.rentalId, rentalId),
          eq(rentalRenewals.status, RentalRenewalStatus.PENDING_PAYMENT),
          eq(payments.status, "PENDING"),
          gt(payments.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return Boolean(payment);
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
  async findReturnSettlement(rentalId: string) {
    const [settlement] = await this.db
      .select()
      .from(returnSettlements)
      .where(eq(returnSettlements.rentalId, rentalId));
    return settlement;
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
          exists(
            this.db
              .select({ id: rentalRenewals.id })
              .from(rentalRenewals)
              .where(
                and(
                  eq(rentalRenewals.id, payments.renewalId),
                  eq(rentalRenewals.rentalId, rentals.id),
                ),
              ),
          ),
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
            rentalId
              ? exists(
                  this.db
                    .select({ id: rentalRenewals.id })
                    .from(rentalRenewals)
                    .where(
                      and(
                        eq(rentalRenewals.id, payments.renewalId),
                        eq(rentalRenewals.rentalId, rentalId),
                      ),
                    ),
                )
              : undefined,
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
  lockRenewalHold(tx: RentalTransaction, renewalId: string, holdTokenHash: string) {
    return tx
      .select()
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.referenceId, renewalId),
          eq(capacityAllocations.accessTokenHash, holdTokenHash),
          eq(capacityAllocations.kind, "HOLD"),
        ),
      )
      .for("update");
  }
  lockPayment(tx: RentalTransaction, paymentId: string) {
    return tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
  }
  lockRenewal(tx: RentalTransaction, renewalId: string) {
    return tx.select().from(rentalRenewals).where(eq(rentalRenewals.id, renewalId)).for("update");
  }
  findRenewalRentalId(tx: RentalTransaction, renewalId: string) {
    return tx
      .select({ rentalId: rentalRenewals.rentalId })
      .from(rentalRenewals)
      .where(eq(rentalRenewals.id, renewalId));
  }
  findRenewalPaymentByCode(paymentCode: string) {
    return this.db.select().from(payments).where(eq(payments.paymentCode, paymentCode));
  }
  lockRenewalUnit(tx: RentalTransaction, unitId: string) {
    return tx
      .select({
        facilityId: storageUnits.facilityId,
        unitTypeId: storageUnits.unitTypeId,
        active: unitTypes.isActive,
      })
      .from(storageUnits)
      .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
      .where(eq(storageUnits.id, unitId))
      .for("update");
  }
  findPendingRenewalPayment(tx: RentalTransaction, rentalId: string, now: Date) {
    return tx
      .select({ id: payments.id })
      .from(rentalRenewals)
      .innerJoin(payments, eq(payments.renewalId, rentalRenewals.id))
      .where(
        and(
          eq(rentalRenewals.rentalId, rentalId),
          eq(rentalRenewals.status, RentalRenewalStatus.PENDING_PAYMENT),
          eq(payments.status, "PENDING"),
          gt(payments.expiresAt, now),
        ),
      )
      .limit(1);
  }
  lockRenewalPayment(tx: RentalTransaction, renewalId: string) {
    return tx.select().from(payments).where(eq(payments.renewalId, renewalId)).for("update");
  }
  lockRentalRenewal(tx: RentalTransaction, rentalId: string, renewalId: string) {
    return tx
      .select()
      .from(rentalRenewals)
      .where(and(eq(rentalRenewals.id, renewalId), eq(rentalRenewals.rentalId, rentalId)))
      .for("update");
  }
  findCustomerRenewal(rentalId: string, renewalId: string, customerId: string) {
    return this.db
      .select({ renewal: rentalRenewals, paymentId: payments.id })
      .from(rentalRenewals)
      .innerJoin(rentals, eq(rentals.id, rentalRenewals.rentalId))
      .leftJoin(
        payments,
        and(eq(payments.renewalId, rentalRenewals.id), eq(payments.type, PaymentType.CHARGE)),
      )
      .where(
        and(
          eq(rentals.id, rentalId),
          eq(rentals.userId, customerId),
          eq(rentalRenewals.id, renewalId),
        ),
      );
  }
  findRenewals(rentalId: string, query: RentalRenewalPageQuery) {
    return this.db
      .select({ renewal: rentalRenewals, paymentId: payments.id })
      .from(rentalRenewals)
      .leftJoin(
        payments,
        and(eq(payments.renewalId, rentalRenewals.id), eq(payments.type, PaymentType.CHARGE)),
      )
      .where(eq(rentalRenewals.rentalId, rentalId))
      .orderBy(desc(rentalRenewals.createdAt), desc(rentalRenewals.id))
      .limit(query.limit)
      .offset(query.offset);
  }
  countRenewals(rentalId: string) {
    return this.db
      .select({ value: count() })
      .from(rentalRenewals)
      .where(eq(rentalRenewals.rentalId, rentalId));
  }
  findOwnedRental(rentalId: string, customerId: string) {
    return this.db
      .select({ id: rentals.id })
      .from(rentals)
      .where(and(eq(rentals.id, rentalId), eq(rentals.userId, customerId)));
  }
  findRenewalUnit(tx: RentalTransaction, unitId: string) {
    return tx
      .select({
        facilityId: storageUnits.facilityId,
        unitTypeId: storageUnits.unitTypeId,
        price: unitTypes.monthlyPrice,
        active: unitTypes.isActive,
      })
      .from(storageUnits)
      .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
      .where(eq(storageUnits.id, unitId));
  }
  findRenewalByIdempotencyKey(tx: RentalTransaction, rentalId: string, idempotencyKey: string) {
    return tx
      .select()
      .from(rentalRenewals)
      .where(
        and(
          eq(rentalRenewals.rentalId, rentalId),
          eq(rentalRenewals.idempotencyKey, idempotencyKey),
        ),
      )
      .for("update");
  }
  lockRental(tx: RentalTransaction, rentalId: string) {
    return tx.select().from(rentals).where(eq(rentals.id, rentalId)).for("update");
  }
  async findRenewalPaymentId(tx: RentalTransaction, renewalId: string) {
    const [payment] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.renewalId, renewalId));
    return payment?.id ?? null;
  }

  async hasOpenReturn(tx: RentalTransaction, rentalId: string) {
    const [appointment] = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.rentalId, rentalId),
          eq(appointments.appointmentType, APPOINTMENT_TYPES.CHECK_OUT),
          inArray(appointments.status, [
            APPOINTMENT_STATUSES.SCHEDULED,
            APPOINTMENT_STATUSES.CONFIRMED,
          ]),
        ),
      )
      .limit(1);
    if (appointment) return true;
    const [inspection] = await tx
      .select({ id: inspections.id })
      .from(inspections)
      .where(
        and(
          eq(inspections.rentalId, rentalId),
          eq(inspections.inspectionType, InspectionType.CHECK_OUT),
          inArray(inspections.status, [InspectionStatus.PENDING, InspectionStatus.IN_PROGRESS]),
        ),
      )
      .limit(1);
    return Boolean(inspection);
  }

  createRenewal(tx: RentalTransaction, input: typeof rentalRenewals.$inferInsert) {
    return tx.insert(rentalRenewals).values(input).returning();
  }
  createRenewalPayment(tx: RentalTransaction, input: typeof payments.$inferInsert) {
    return tx
      .insert(payments)
      .values(input)
      .onConflictDoNothing({ target: payments.idempotencyKey })
      .returning();
  }
  createRenewalAllocation(tx: RentalTransaction, input: typeof capacityAllocations.$inferInsert) {
    return tx.insert(capacityAllocations).values(input);
  }
  updateRenewal(
    tx: RentalTransaction,
    id: string,
    input: Partial<typeof rentalRenewals.$inferInsert>,
  ) {
    return tx.update(rentalRenewals).set(input).where(eq(rentalRenewals.id, id));
  }
  updateRenewalPayment(
    tx: RentalTransaction,
    id: string,
    input: Partial<typeof payments.$inferInsert>,
  ) {
    return tx.update(payments).set(input).where(eq(payments.id, id));
  }
  updateRenewedRental(
    tx: RentalTransaction,
    id: string,
    input: Partial<typeof rentals.$inferInsert>,
  ) {
    return tx.update(rentals).set(input).where(eq(rentals.id, id));
  }
  confirmRenewalAllocation(
    tx: RentalTransaction,
    allocationId: string,
    input: Partial<typeof capacityAllocations.$inferInsert>,
  ) {
    return tx
      .update(capacityAllocations)
      .set(input)
      .where(eq(capacityAllocations.id, allocationId));
  }
  releaseRenewalAllocations(
    tx: RentalTransaction,
    renewalId: string,
    input: Partial<typeof capacityAllocations.$inferInsert>,
  ) {
    return tx
      .update(capacityAllocations)
      .set(input)
      .where(
        and(
          eq(capacityAllocations.referenceId, renewalId),
          eq(capacityAllocations.status, "ACTIVE"),
        ),
      );
  }
}
