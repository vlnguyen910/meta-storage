import {
  and,
  capacityAllocations,
  type Database,
  eq,
  facilities,
  inArray,
  payments,
  unitTypes,
} from "@metastorage/database";
import type { ReservationTransaction } from "../reservations/reservations.repository";

export class ReservationPaymentsRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(work: (tx: ReservationTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }

  async lockOffering(tx: ReservationTransaction, facilityId: string, unitTypeId: string) {
    const [offering] = await tx
      .select({ active: unitTypes.isActive, facilityActive: facilities.isActive })
      .from(unitTypes)
      .innerJoin(facilities, eq(facilities.id, unitTypes.facilityId))
      .where(and(eq(unitTypes.id, unitTypeId), eq(unitTypes.facilityId, facilityId)))
      .for("update");
    return offering;
  }

  async findByCode(code: string) {
    const [payment] = await this.db.select().from(payments).where(eq(payments.paymentCode, code));
    return payment;
  }

  async findByIdempotency(tx: ReservationTransaction, key: string) {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, key))
      .for("update");
    return payment;
  }

  async lockPayment(tx: ReservationTransaction, id: string) {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for("update");
    return payment;
  }

  async findOpenPayment(tx: ReservationTransaction, reservationId: string) {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.reservationId, reservationId),
          inArray(payments.status, ["PENDING", "SUCCEEDED", "REFUND_PENDING"]),
        ),
      )
      .for("update");
    return payment;
  }

  async createPayment(tx: ReservationTransaction, input: typeof payments.$inferInsert) {
    const [payment] = await tx
      .insert(payments)
      .values(input)
      .onConflictDoNothing({ target: payments.idempotencyKey })
      .returning();
    return payment;
  }

  async updatePayment(
    tx: ReservationTransaction,
    id: string,
    input: Partial<typeof payments.$inferInsert>,
  ) {
    const [payment] = await tx
      .update(payments)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async findHold(tx: ReservationTransaction, payment: typeof payments.$inferSelect) {
    if (!payment.reservationId || !payment.holdTokenHash) return undefined;
    const [hold] = await tx
      .select()
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.referenceId, payment.reservationId),
          eq(capacityAllocations.accessTokenHash, payment.holdTokenHash),
          eq(capacityAllocations.kind, "HOLD"),
        ),
      )
      .for("update");
    return hold;
  }

  async createHold(tx: ReservationTransaction, input: typeof capacityAllocations.$inferInsert) {
    const [hold] = await tx.insert(capacityAllocations).values(input).returning();
    return hold;
  }

  releaseCapacity(tx: ReservationTransaction, reservationId: string) {
    return tx
      .update(capacityAllocations)
      .set({ status: "RELEASED", updatedAt: new Date() })
      .where(
        and(
          eq(capacityAllocations.referenceId, reservationId),
          inArray(capacityAllocations.status, ["ACTIVE", "EXPIRED"]),
        ),
      );
  }

  confirmCapacity(tx: ReservationTransaction, id: string) {
    return tx
      .update(capacityAllocations)
      .set({
        kind: "RESERVATION",
        status: "ACTIVE",
        accessTokenHash: null,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(capacityAllocations.id, id));
  }
}
