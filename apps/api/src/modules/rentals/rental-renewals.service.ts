import { randomBytes } from "node:crypto";
import type {
  RentalRenewalDto,
  RentalRenewalPageQuery,
  RentalRenewalPaymentSession,
} from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  and,
  appointments,
  capacityAllocations,
  count,
  desc,
  eq,
  gt,
  InspectionStatus,
  InspectionType,
  inArray,
  inspections,
  PaymentType,
  paymentProviderEvents,
  payments,
  RentalRenewalStatus,
  rentalRenewals,
  rentals,
  storageUnits,
  systemSettings,
  unitTypes,
} from "@metastorage/database";
import { AppError, ConflictError, NotFoundError } from "../../common/errors/app-error";
import { PAYMENT_MESSAGES } from "../payments/payments.messages";
import type { SepayPaymentGateway } from "../payments/sepay.gateway";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { RENTAL_RENEWAL_MESSAGES as m } from "./rentals.messages";

const NOTICE_SETTING = "RENEWAL_NOTICE_DAYS";
const CHECKOUT_TTL_MS = 10 * 60_000;

export class RentalRenewalsService {
  constructor(
    private readonly db: Database,
    private readonly gateway?: SepayPaymentGateway,
  ) {}

  async quote(rentalId: string, customerId: string, months: number, idempotencyKey: string) {
    return this.db.transaction(async (tx) => {
      const [rental] = await tx
        .select()
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .for("update");
      if (!rental || rental.userId !== customerId) throw new NotFoundError(m.rentalNotFound);
      const [existing] = await tx
        .select()
        .from(rentalRenewals)
        .where(
          and(
            eq(rentalRenewals.rentalId, rentalId),
            eq(rentalRenewals.idempotencyKey, idempotencyKey),
          ),
        )
        .for("update");
      if (existing) {
        if (existing.months !== months) throw new ConflictError(m.keyConflict);
        return this.toDto(existing, await this.findPaymentId(tx, existing.id));
      }
      const [unit] = await tx
        .select({
          facilityId: storageUnits.facilityId,
          unitTypeId: storageUnits.unitTypeId,
          price: unitTypes.monthlyPrice,
          active: unitTypes.isActive,
        })
        .from(storageUnits)
        .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
        .where(eq(storageUnits.id, rental.storageUnitId));
      const [setting] = await tx
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, NOTICE_SETTING));
      if (!unit || !setting || !unit.active) throw new ConflictError(m.unavailable);
      const now = new Date();
      const noticeDays = Number(setting.value);
      const cutoffAt = new Date(rental.endAt.getTime() - noticeDays * 86_400_000);
      if (rental.status !== "ACTIVE" || now < rental.startAt || now >= cutoffAt)
        throw new ConflictError(m.requestWindowClosed);
      if (await this.hasOpenReturn(tx, rentalId)) throw new ConflictError(m.returnOpen);
      const newEndAt = new Date(rental.endAt.getTime() + months * 30 * 86_400_000);
      const available = await new StorageUnitsService(
        new StorageUnitsRepository(tx),
      ).getAvailableCapacity(unit.facilityId, unit.unitTypeId, rental.endAt, newEndAt);
      if (available < 1) throw new ConflictError(m.capacityUnavailable);
      const expiresAt = new Date(Math.min(now.getTime() + CHECKOUT_TTL_MS, cutoffAt.getTime()));
      if (expiresAt <= now) throw new ConflictError(m.requestWindowClosed);
      const [created] = await tx
        .insert(rentalRenewals)
        .values({
          rentalId,
          storageUnitId: rental.storageUnitId,
          idempotencyKey,
          oldEndAt: rental.endAt,
          newEndAt,
          months,
          monthlyRateSnapshot: String(unit.price),
          amount: String(BigInt(unit.price) * BigInt(months)),
          currency: "VND",
          noticeDaysSnapshot: noticeDays,
          settingVersionSnapshot: setting.version,
          cutoffAt,
          expiresAt,
        })
        .returning();
      if (!created) throw new ConflictError(m.quoteSaveFailed);
      return this.toDto(created, null);
    });
  }

  async list(rentalId: string, customerId: string, query: RentalRenewalPageQuery) {
    const [rental] = await this.db
      .select({ id: rentals.id })
      .from(rentals)
      .where(and(eq(rentals.id, rentalId), eq(rentals.userId, customerId)));
    if (!rental) throw new NotFoundError(m.rentalNotFound);
    const [total] = await this.db
      .select({ value: count() })
      .from(rentalRenewals)
      .where(eq(rentalRenewals.rentalId, rentalId));
    const rows = await this.db
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
    return {
      items: rows.map(({ renewal, paymentId }) => this.toDto(renewal, paymentId)),
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(rentalId: string, renewalId: string, customerId: string): Promise<RentalRenewalDto> {
    const [row] = await this.db
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
    if (!row) throw new NotFoundError(m.renewalNotFound);
    return this.toDto(row.renewal, row.paymentId);
  }

  async startPayment(
    rentalId: string,
    renewalId: string,
    customerId: string,
    idempotencyKey: string,
  ): Promise<RentalRenewalPaymentSession> {
    const gateway = this.gateway;
    if (!gateway?.checkoutConfigured)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const prepared = await this.db.transaction(async (tx) => {
      const [rental] = await tx
        .select()
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .for("update");
      if (!rental || rental.userId !== customerId) throw new NotFoundError(m.rentalNotFound);
      const [renewal] = await tx
        .select()
        .from(rentalRenewals)
        .where(and(eq(rentalRenewals.id, renewalId), eq(rentalRenewals.rentalId, rentalId)))
        .for("update");
      if (!renewal) throw new NotFoundError(m.renewalNotFound);
      const now = new Date();
      if (renewal.expiresAt <= now) throw new ConflictError(m.quoteExpired);
      if (renewal.status === "PENDING_PAYMENT") {
        const [existing] = await tx
          .select()
          .from(payments)
          .where(eq(payments.renewalId, renewalId))
          .for("update");
        if (
          existing?.idempotencyKey === idempotencyKey &&
          existing.status === "PENDING" &&
          existing.expiresAt &&
          existing.expiresAt > now
        )
          return { renewal, payment: existing };
        throw new ConflictError(m.paymentOpen);
      }
      const [openPayment] = await tx
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
      if (openPayment) throw new ConflictError(m.paymentOpen);
      if (renewal.status !== "QUOTED" || renewal.expiresAt <= now)
        throw new ConflictError(m.quoteExpired);
      if (
        rental.status !== "ACTIVE" ||
        rental.endAt.getTime() !== renewal.oldEndAt.getTime() ||
        rental.storageUnitId !== renewal.storageUnitId ||
        rental.endAt <= now
      )
        throw new ConflictError(m.changed);
      if (await this.hasOpenReturn(tx, rentalId)) throw new ConflictError(m.returnOpen);
      const [unit] = await tx
        .select({
          facilityId: storageUnits.facilityId,
          unitTypeId: storageUnits.unitTypeId,
          active: unitTypes.isActive,
        })
        .from(storageUnits)
        .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
        .where(eq(storageUnits.id, rental.storageUnitId))
        .for("update");
      if (!unit?.active) throw new ConflictError(m.unitUnavailable);
      const available = await new StorageUnitsService(
        new StorageUnitsRepository(tx),
      ).getAvailableCapacity(unit.facilityId, unit.unitTypeId, renewal.oldEndAt, renewal.newEndAt);
      if (available < 1) throw new ConflictError(m.capacityUnavailable);
      const expiresAt = new Date(
        Math.min(
          now.getTime() + CHECKOUT_TTL_MS,
          renewal.expiresAt.getTime(),
          renewal.cutoffAt.getTime(),
        ),
      );
      const holdTokenHash = randomBytes(32).toString("hex");
      const paymentCode = `${gateway.paymentPrefix}${randomBytes(7).toString("hex").toUpperCase()}`;
      const [payment] = await tx
        .insert(payments)
        .values({
          renewalId,
          holdTokenHash,
          provider: "sepay",
          paymentCode,
          providerPaymentId: `pending_${paymentCode}`,
          idempotencyKey,
          totalAmount: renewal.amount,
          currency: renewal.currency,
          status: "PENDING",
          expiresAt,
        })
        .onConflictDoNothing({ target: payments.idempotencyKey })
        .returning();
      if (!payment) throw new ConflictError(m.idempotencyConflict);
      await tx.insert(capacityAllocations).values({
        referenceId: renewalId,
        facilityId: unit.facilityId,
        unitTypeId: unit.unitTypeId,
        startsAt: renewal.oldEndAt,
        endsAt: renewal.newEndAt,
        kind: "HOLD",
        status: "ACTIVE",
        expiresAt,
        accessTokenHash: holdTokenHash,
      });
      await tx
        .update(rentalRenewals)
        .set({ status: RentalRenewalStatus.PENDING_PAYMENT, updatedAt: now })
        .where(eq(rentalRenewals.id, renewalId));
      return { renewal, payment };
    });
    const paymentCode = prepared.payment.paymentCode;
    const expiresAt = prepared.payment.expiresAt;
    if (!paymentCode || !expiresAt)
      throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
    const session = gateway.createCheckoutSession({
      paymentId: prepared.payment.id,
      renewalId,
      paymentCode,
      amount: Number(prepared.payment.totalAmount),
      currency: prepared.payment.currency,
      description: PAYMENT_MESSAGES.checkoutDescription(paymentCode),
    });
    if (!session)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    return {
      renewalId,
      paymentId: prepared.payment.id,
      provider: "sepay",
      status: "PENDING",
      paymentCode,
      checkoutUrl: session.checkoutUrl,
      checkoutFormFields: session.formFields,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async processEvent(event: import("../payments/payments.types").VerifiedPaymentEvent) {
    const [candidate] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.paymentCode, event.paymentCode));
    if (!candidate?.renewalId || candidate.provider !== "sepay") return null;
    const renewalId = candidate.renewalId;
    return this.db.transaction(async (tx) => {
      const [renewalRef] = await tx
        .select({ rentalId: rentalRenewals.rentalId })
        .from(rentalRenewals)
        .where(eq(rentalRenewals.id, renewalId));
      if (!renewalRef) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
      const [rental] = await tx
        .select()
        .from(rentals)
        .where(eq(rentals.id, renewalRef.rentalId))
        .for("update");
      const [renewal] = await tx
        .select()
        .from(rentalRenewals)
        .where(eq(rentalRenewals.id, renewalId))
        .for("update");
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, candidate.id))
        .for("update");
      if (!renewal || !rental || !payment)
        throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
      if (payment.status !== "PENDING")
        return { duplicate: true, processed: false, paymentId: payment.id };
      if (
        event.successful === false ||
        event.transferType !== "in" ||
        event.amount !== Number(payment.totalAmount) ||
        (event.currency && event.currency !== payment.currency)
      )
        return { duplicate: false, processed: false, paymentId: payment.id };
      const [recorded] = await tx
        .insert(paymentProviderEvents)
        .values({
          provider: "sepay",
          providerEventId: event.providerEventId,
          paymentId: payment.id,
          paymentCode: event.paymentCode,
          amount: event.amount,
          transferType: event.transferType,
          referenceCode: event.referenceCode,
          status: "PROCESSED",
          payloadMetadata: event.metadata,
        })
        .onConflictDoNothing({
          target: [paymentProviderEvents.provider, paymentProviderEvents.providerEventId],
        })
        .returning();
      if (!recorded) return { duplicate: true, processed: false, paymentId: payment.id };

      const [unit] = await tx
        .select({
          facilityId: storageUnits.facilityId,
          unitTypeId: storageUnits.unitTypeId,
          active: unitTypes.isActive,
        })
        .from(storageUnits)
        .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
        .where(eq(storageUnits.id, rental.storageUnitId))
        .for("update");
      const paidAt = event.paidAt ?? new Date();
      if (!payment.holdTokenHash) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
      const [hold] = await tx
        .select()
        .from(capacityAllocations)
        .where(
          and(
            eq(capacityAllocations.referenceId, renewal.id),
            eq(capacityAllocations.accessTokenHash, payment.holdTokenHash),
            eq(capacityAllocations.kind, "HOLD"),
          ),
        )
        .for("update");
      let failure: string | null = null;
      if (renewal.status !== RentalRenewalStatus.PENDING_PAYMENT) failure = "RENEWAL_STATE_CHANGED";
      else if (paidAt >= (payment.expiresAt ?? renewal.expiresAt))
        failure = "PAYMENT_AFTER_DEADLINE";
      else if (
        rental.status !== "ACTIVE" ||
        rental.endAt.getTime() !== renewal.oldEndAt.getTime() ||
        rental.storageUnitId !== renewal.storageUnitId ||
        rental.endAt <= new Date()
      )
        failure = "RENTAL_CHANGED";
      else if (!unit?.active) failure = "OFFERING_UNAVAILABLE";
      else if (
        !(hold?.status === "ACTIVE" && hold.expiresAt && hold.expiresAt > new Date()) &&
        (await new StorageUnitsService(new StorageUnitsRepository(tx)).getAvailableCapacity(
          unit.facilityId,
          unit.unitTypeId,
          renewal.oldEndAt,
          renewal.newEndAt,
        )) < 1
      )
        failure = "NO_CAPACITY";

      if (failure) {
        await tx
          .update(payments)
          .set({
            status: "REFUND_PENDING",
            paidAt,
            refundReason: "RENEWAL_NOT_APPLIED",
            refundAmount: payment.totalAmount,
            providerPaymentId: event.referenceCode ?? event.providerEventId,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
        await tx
          .update(rentalRenewals)
          .set({
            status: RentalRenewalStatus.REFUND_REQUIRED,
            failureReason: failure,
            updatedAt: new Date(),
          })
          .where(eq(rentalRenewals.id, renewal.id));
        await tx
          .update(capacityAllocations)
          .set({ status: "RELEASED", updatedAt: new Date() })
          .where(
            and(
              eq(capacityAllocations.referenceId, renewal.id),
              eq(capacityAllocations.status, "ACTIVE"),
            ),
          );
      } else {
        if (!unit) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
        if (hold?.status === "ACTIVE" && hold.expiresAt && hold.expiresAt > new Date()) {
          await tx
            .update(capacityAllocations)
            .set({ kind: "BOOKING", accessTokenHash: null, expiresAt: null, updatedAt: new Date() })
            .where(eq(capacityAllocations.id, hold.id));
        } else {
          await tx.insert(capacityAllocations).values({
            referenceId: renewal.id,
            facilityId: unit.facilityId,
            unitTypeId: unit.unitTypeId,
            startsAt: renewal.oldEndAt,
            endsAt: renewal.newEndAt,
            kind: "BOOKING",
          });
        }
        await tx
          .update(payments)
          .set({
            status: "SUCCEEDED",
            paidAt,
            providerPaymentId: event.referenceCode ?? event.providerEventId,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
        await tx
          .update(rentals)
          .set({ endAt: renewal.newEndAt, updatedAt: new Date() })
          .where(eq(rentals.id, rental.id));
        await tx
          .update(rentalRenewals)
          .set({
            status: RentalRenewalStatus.APPLIED,
            appliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(rentalRenewals.id, renewal.id));
      }
      return { duplicate: false, processed: true, paymentId: payment.id };
    });
  }

  private async findPaymentId(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    renewalId: string,
  ) {
    const [payment] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.renewalId, renewalId));
    return payment?.id ?? null;
  }

  private async hasOpenReturn(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    rentalId: string,
  ) {
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

  private toDto(
    row: typeof rentalRenewals.$inferSelect,
    paymentId: string | null,
  ): RentalRenewalDto {
    return {
      id: row.id,
      rentalId: row.rentalId,
      status:
        row.status !== "APPLIED" && row.status !== "REFUND_REQUIRED" && row.expiresAt <= new Date()
          ? "EXPIRED"
          : row.status,
      months: row.months,
      oldEndAt: row.oldEndAt.toISOString(),
      newEndAt: row.newEndAt.toISOString(),
      monthlyRateSnapshot: row.monthlyRateSnapshot,
      amount: row.amount,
      currency: "VND",
      cutoffAt: row.cutoffAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      appliedAt: row.appliedAt?.toISOString() ?? null,
      failureReason: row.failureReason,
      paymentId,
    };
  }
}
