import type {
  RentalChargeCategory,
  RentalChargeStatus,
} from "@metastorage/contracts/rental-charges";
import {
  and,
  bookings,
  type Database,
  desc,
  eq,
  type FacilityRole,
  facilityAssignments,
  gt,
  isNull,
  or,
  payments,
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
  rentalCharges,
  rentals,
  sql,
  users,
} from "@metastorage/database";

export class RentalChargesRepository {
  constructor(private readonly db: Database) {}

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
