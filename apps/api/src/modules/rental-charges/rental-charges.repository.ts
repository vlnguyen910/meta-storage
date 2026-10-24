import type {
  FacilityRentalChargeQuery,
  RentalChargeCategory,
  RentalChargeStatus,
} from "@metastorage/contracts/rental-charges";
import {
  and,
  bookings,
  count,
  type Database,
  desc,
  eq,
  exists,
  type FacilityRole,
  facilityAssignments,
  gt,
  inArray,
  isNull,
  or,
  payments,
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
  rentalCharges,
  rentals,
  sql,
  storageUnits,
  users,
} from "@metastorage/database";
import type { FacilityChargeReadExecutor } from "./rental-charges.types";

export class RentalChargesRepository {
  constructor(private readonly db: Database) {}

  private facilityReadQuery(executor: FacilityChargeReadExecutor = this.db) {
    const adjustments = executor
      .select({
        value: sql<string>`coalesce(sum(case when ${rentalChargeAdjustments.direction} = 'INCREASE' then ${rentalChargeAdjustments.amount} else -${rentalChargeAdjustments.amount} end), 0)`,
      })
      .from(rentalChargeAdjustments)
      .where(eq(rentalChargeAdjustments.chargeId, rentalCharges.id));
    const captured = executor
      .select({ value: sql<string>`coalesce(sum(${payments.totalAmount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.rentalChargeId, rentalCharges.id),
          inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]),
        ),
      );
    const appliedEvent = executor
      .select({ id: rentalChargeEvents.id })
      .from(rentalChargeEvents)
      .where(
        and(
          eq(rentalChargeEvents.chargeId, rentalCharges.id),
          eq(rentalChargeEvents.type, "PAID"),
          sql`${rentalChargeEvents.details}->>'paymentId' = ${payments.id}::text`,
        ),
      );
    const paid = executor
      .select({ value: sql<string>`coalesce(sum(${payments.totalAmount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.rentalChargeId, rentalCharges.id),
          or(eq(payments.status, "SUCCEEDED"), exists(appliedEvent)),
        ),
      );
    const refunded = executor
      .select({ value: sql<string>`coalesce(sum(${rentalChargeRefunds.amount}), 0)` })
      .from(rentalChargeRefunds)
      .where(
        and(
          eq(rentalChargeRefunds.chargeId, rentalCharges.id),
          eq(rentalChargeRefunds.status, "CONFIRMED"),
        ),
      );
    return executor
      .select({
        charge: rentalCharges,
        adjustedAmount: sql<string>`(${rentalCharges.amount} + (${adjustments}))::text`,
        capturedAmount: sql<string>`(${captured})::text`,
        // Applied receipts exclude late/duplicate captures that are only owed a refund.
        paidAmount: sql<string>`(${paid})::text`,
        refundedAmount: sql<string>`(${refunded})::text`,
        context: {
          facilityId: rentals.facilityId,
          bookingId: bookings.id,
          bookingCode: bookings.bookingCode,
          customerName: bookings.contactName,
          customerEmail: bookings.contactEmail,
          customerPhone: bookings.contactPhone,
          unitCode: storageUnits.code,
          rentalStatus: rentals.status,
          expectedEndAt: rentals.expectedEndAt,
        },
      })
      .from(rentalCharges)
      .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId));
  }

  listForFacility(facilityId: string, query: FacilityRentalChargeQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = and(
          eq(rentals.facilityId, facilityId),
          query.status ? eq(rentalCharges.status, query.status) : undefined,
          query.source ? eq(rentalCharges.source, query.source) : undefined,
          query.rentalId ? eq(rentalCharges.rentalId, query.rentalId) : undefined,
        );
        const [total] = await tx
          .select({ value: count() })
          .from(rentalCharges)
          .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
          .where(filter);
        const items = await this.facilityReadQuery(tx)
          .where(filter)
          .orderBy(desc(rentalCharges.createdAt), desc(rentalCharges.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async facilityDetail(facilityId: string, chargeId: string) {
    return this.db.transaction(
      async (tx) => {
        const [row] = await this.facilityReadQuery(tx).where(
          and(eq(rentals.facilityId, facilityId), eq(rentalCharges.id, chargeId)),
        );
        if (!row) return null;
        const events = await tx
          .select()
          .from(rentalChargeEvents)
          .where(eq(rentalChargeEvents.chargeId, chargeId))
          .orderBy(rentalChargeEvents.createdAt, rentalChargeEvents.id);
        const adjustments = await tx
          .select()
          .from(rentalChargeAdjustments)
          .where(eq(rentalChargeAdjustments.chargeId, chargeId))
          .orderBy(rentalChargeAdjustments.createdAt, rentalChargeAdjustments.id);
        const refunds = await tx
          .select()
          .from(rentalChargeRefunds)
          .where(eq(rentalChargeRefunds.chargeId, chargeId))
          .orderBy(rentalChargeRefunds.createdAt, rentalChargeRefunds.id);
        return { row, events, adjustments, refunds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async listForCustomer(rentalId: string, userId: string) {
    return this.db
      .select({
        charge: rentalCharges,
        adjustedAmount: sql<string>`(${rentalCharges.amount} + coalesce((select sum(case when direction = 'INCREASE' then amount else -amount end) from rental_charge_adjustments where charge_id = ${rentalCharges.id}), 0))::text`,
        paidAmount: sql<string>`coalesce((select sum(total_amount) from payments where rental_charge_id = ${rentalCharges.id} and status in ('SUCCEEDED','REFUND_PENDING','REFUNDED')), 0)::text`,
        refundedAmount: sql<string>`coalesce((select sum(amount) from rental_charge_refunds where charge_id = ${rentalCharges.id} and status = 'CONFIRMED'), 0)::text`,
      })
      .from(rentalCharges)
      .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(and(eq(rentals.id, rentalId), eq(bookings.userId, userId)))
      .orderBy(desc(rentalCharges.createdAt), desc(rentalCharges.id));
  }

  async getChargeContext(chargeId: string) {
    const [row] = await this.db
      .select({ charge: rentalCharges, rental: rentals, booking: bookings })
      .from(rentalCharges)
      .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(eq(rentalCharges.id, chargeId));
    return row;
  }

  async customerOwnsRental(rentalId: string, userId: string) {
    const [row] = await this.db
      .select({ id: rentals.id })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(and(eq(rentals.id, rentalId), eq(bookings.userId, userId)))
      .limit(1);
    return row;
  }

  async rental(rentalId: string) {
    const [row] = await this.db.select().from(rentals).where(eq(rentals.id, rentalId));
    return row;
  }

  async hasAssignment(facilityId: string, userId: string, role: FacilityRole) {
    const [assignment] = await this.db
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .limit(1);
    return Boolean(assignment);
  }

  createExtra(input: {
    rentalId: string;
    actorId: string;
    category: RentalChargeCategory;
    amount: number;
    evidence: string;
    dueDate: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [rental] = await tx
        .select({ facilityId: rentals.facilityId })
        .from(rentals)
        .where(eq(rentals.id, input.rentalId))
        .for("update");
      if (!rental) return null;
      const [charge] = await tx
        .insert(rentalCharges)
        .values({
          rentalId: input.rentalId,
          source: "EXTRA",
          category: input.category,
          amount: String(input.amount),
          evidence: input.evidence,
          dueDate: input.dueDate,
          createdBy: input.actorId,
        })
        .returning();
      if (!charge) return null;
      await tx
        .insert(rentalChargeEvents)
        .values({ chargeId: charge.id, type: "SUBMITTED", actorId: input.actorId });
      return charge;
    });
  }

  async transition(
    chargeId: string,
    input: {
      status: RentalChargeStatus;
      actorId: string;
      type: "APPROVED" | "REJECTED" | "DISPUTED" | "DISPUTE_UPHELD";
      reason?: string;
      disputedAt?: Date;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [charge] = await tx
        .select()
        .from(rentalCharges)
        .where(eq(rentalCharges.id, chargeId))
        .for("update");
      if (!charge) return null;
      const [updated] = await tx
        .update(rentalCharges)
        .set({
          status: input.status,
          approvedBy:
            input.type === "APPROVED" || input.type === "REJECTED"
              ? input.actorId
              : charge.approvedBy,
          decisionReason: input.reason ?? charge.decisionReason,
          disputedAt: input.disputedAt ?? charge.disputedAt,
          updatedAt: new Date(),
        })
        .where(eq(rentalCharges.id, chargeId))
        .returning();
      await tx.insert(rentalChargeEvents).values({
        chargeId,
        type: input.type,
        actorId: input.actorId,
        reason: input.reason,
      });
      return updated;
    });
  }

  async resolveDispute(
    chargeId: string,
    input: {
      actorId: string;
      outcome: "UPHOLD" | "REDUCE" | "WAIVE";
      amount?: number;
      reason: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [charge] = await tx
        .select()
        .from(rentalCharges)
        .where(eq(rentalCharges.id, chargeId))
        .for("update");
      if (!charge) return null;
      if (charge.status !== "DISPUTED") return { conflict: true as const };
      const adjustments = await tx
        .select()
        .from(rentalChargeAdjustments)
        .where(eq(rentalChargeAdjustments.chargeId, chargeId));
      const current = adjustments.reduce(
        (value, item) => value + (item.direction === "INCREASE" ? 1n : -1n) * BigInt(item.amount),
        BigInt(charge.amount),
      );
      const next =
        input.outcome === "UPHOLD"
          ? current
          : input.outcome === "WAIVE"
            ? 0n
            : BigInt(input.amount ?? -1);
      if (next < 0n || next > current) return { conflict: true as const };
      const delta = current - next;
      let eventType: "DISPUTE_UPHELD" | "DISPUTE_REDUCED" | "DISPUTE_WAIVED";
      if (input.outcome === "UPHOLD") eventType = "DISPUTE_UPHELD";
      else if (input.outcome === "WAIVE") eventType = "DISPUTE_WAIVED";
      else eventType = "DISPUTE_REDUCED";
      if (delta > 0n) {
        await tx.insert(rentalChargeAdjustments).values({
          chargeId,
          direction: "REDUCTION",
          amount: delta.toString(),
          reason: input.reason,
          createdBy: input.actorId,
        });
      }
      const [updated] = await tx
        .update(rentalCharges)
        .set({
          status: next === 0n ? "VOID" : "OPEN",
          decisionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(rentalCharges.id, chargeId))
        .returning();
      await tx.insert(rentalChargeEvents).values({
        chargeId,
        type: eventType,
        actorId: input.actorId,
        reason: input.reason,
        details: { previousAmount: current.toString(), adjustedAmount: next.toString() },
      });
      return updated ? { ...updated, adjustedAmount: next.toString() } : null;
    });
  }

  async applyAdjustment(
    chargeId: string,
    input: { actorId: string; direction: "INCREASE" | "REDUCTION"; amount: number; reason: string },
  ) {
    return this.db.transaction(async (tx) => {
      const [charge] = await tx
        .select()
        .from(rentalCharges)
        .where(eq(rentalCharges.id, chargeId))
        .for("update");
      if (!charge) return null;
      if (charge.source === "RENEWAL") return { conflict: true as const };
      if (charge.status !== "OPEN") return { conflict: true as const };
      const adjustments = await tx
        .select()
        .from(rentalChargeAdjustments)
        .where(eq(rentalChargeAdjustments.chargeId, chargeId));
      const balance = adjustments.reduce(
        (value, item) => value + (item.direction === "INCREASE" ? 1n : -1n) * BigInt(item.amount),
        BigInt(charge.amount),
      );
      const amount = BigInt(input.amount);
      if (input.direction === "REDUCTION" && amount > balance) return { conflict: true as const };
      await tx.insert(rentalChargeEvents).values({
        chargeId,
        type: "ADJUSTED",
        actorId: input.actorId,
        reason: input.reason,
        details: { direction: input.direction, amount: input.amount },
      });
      await tx.insert(rentalChargeAdjustments).values({
        chargeId,
        direction: input.direction,
        amount: String(input.amount),
        reason: input.reason,
        createdBy: input.actorId,
      });
      const next = input.direction === "INCREASE" ? balance + amount : balance - amount;
      const [updated] = await tx
        .update(rentalCharges)
        .set({ status: next === 0n ? "VOID" : "OPEN", updatedAt: new Date() })
        .where(eq(rentalCharges.id, chargeId))
        .returning();
      return updated ? { ...updated, adjustedAmount: next.toString() } : null;
    });
  }

  listRefunds(limit: number, offset: number) {
    return this.db
      .select({ refund: rentalChargeRefunds })
      .from(rentalChargeRefunds)
      .orderBy(desc(rentalChargeRefunds.createdAt), desc(rentalChargeRefunds.id))
      .limit(limit)
      .offset(offset);
  }

  async confirmRefund(refundId: string, reference: string, actorId: string) {
    return this.db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(rentalChargeRefunds)
        .where(eq(rentalChargeRefunds.id, refundId));
      if (!initial) return null;
      await tx
        .select({ id: rentalCharges.id })
        .from(rentalCharges)
        .where(eq(rentalCharges.id, initial.chargeId))
        .for("update");
      const [refund] = await tx
        .select()
        .from(rentalChargeRefunds)
        .where(eq(rentalChargeRefunds.id, refundId))
        .for("update");
      if (refund?.status !== "PENDING") return { conflict: true as const };
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(eq(payments.rentalChargeId, refund.chargeId));
      const captured = paymentRows.reduce(
        (sum, payment) =>
          sum +
          (["SUCCEEDED", "REFUND_PENDING", "REFUNDED"].includes(payment.status)
            ? Number(payment.totalAmount)
            : 0),
        0,
      );
      const refunds = await tx
        .select()
        .from(rentalChargeRefunds)
        .where(eq(rentalChargeRefunds.chargeId, refund.chargeId));
      const allocated = refunds.reduce(
        (sum, row) =>
          sum +
          (row.id === refund.id || ["PENDING", "CONFIRMED"].includes(row.status)
            ? Number(row.amount)
            : 0),
        0,
      );
      if (allocated > captured) return { conflict: true as const };
      const now = new Date();
      const [updated] = await tx
        .update(rentalChargeRefunds)
        .set({ status: "CONFIRMED", reference, confirmedBy: actorId, confirmedAt: now })
        .where(eq(rentalChargeRefunds.id, refund.id))
        .returning();
      if (!updated) return { conflict: true as const };
      const confirmed = refunds.reduce(
        (sum, row) =>
          sum + (row.id === refund.id || row.status === "CONFIRMED" ? Number(row.amount) : 0),
        0,
      );
      const [charge] = await tx
        .select()
        .from(rentalCharges)
        .where(eq(rentalCharges.id, refund.chargeId));
      if (charge) {
        await tx
          .update(rentalCharges)
          .set({
            status: confirmed >= captured ? "REFUNDED" : "PARTIALLY_REFUNDED",
            updatedAt: now,
          })
          .where(eq(rentalCharges.id, charge.id));
        await tx.insert(rentalChargeEvents).values({
          chargeId: charge.id,
          type: "REFUND_CONFIRMED",
          actorId,
          reason: reference,
          details: { refundId: refund.id, amount: refund.amount },
        });
      }
      return updated;
    });
  }
}
