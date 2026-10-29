import { randomBytes } from "node:crypto";
import type {
  FacilityRentalHistoryQuery,
  FacilityRentalItem,
  FacilityRentalListQuery,
  FacilityRentalPage,
  FacilityRentalPaymentPage,
  RentalDetail,
  RentalListItem,
  RentalPage,
  RentalPageQuery,
  RentalPaymentItem,
  RentalRenewalDto,
  RentalRenewalPageQuery,
  RentalRenewalPaymentSession,
} from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import { RentalRenewalStatus, type rentalRenewals } from "@metastorage/database";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";
import { PAYMENT_MESSAGES } from "../payments/payments.messages";
import { PaymentsRepository } from "../payments/payments.repository";
import type { VerifiedPaymentEvent } from "../payments/payments.types";
import type { SepayPaymentGateway } from "../payments/sepay.gateway";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { SystemSettingsRepository } from "../system-settings/system-settings.repository";
import { SystemSettingsService } from "../system-settings/system-settings.service";
import { RENTAL_MESSAGES as M, RENTAL_RENEWAL_MESSAGES } from "./rentals.messages";
import { RentalsRepository } from "./rentals.repository";
import type { RentalActor, RentalWithDetails } from "./rentals.types";

const CHECKOUT_TTL_MS = 10 * 60_000;

function toFacilityRentalItem(row: RentalWithDetails): FacilityRentalItem {
  return {
    id: row.rental.id,
    bookingId: row.rental.bookingId,
    reservationId: row.rental.reservationId,
    userId: row.rental.userId,
    bookingCode: row.booking.bookingCode,
    facilityId: row.booking.facilityId,
    status: row.rental.status,
    customer: {
      userId: row.rental.userId,
      name: row.customer.name,
      email: row.customer.email,
      phone: row.booking.contactPhone,
    },
    unit: {
      id: row.storageUnit.id,
      code: row.storageUnit.code,
      unitTypeId: row.unitType.id,
      unitTypeName: row.unitType.name,
      sizeLabel: row.unitType.sizeLabel,
    },
    startAt: row.rental.startAt.toISOString(),
    endAt: row.rental.endAt.toISOString(),
    closedAt: row.rental.closedAt?.toISOString() ?? null,
  };
}
export class RentalsService {
  constructor(
    private readonly repository: RentalsRepository,
    private readonly facilityAssignments: FacilityAssignmentsService,
    private readonly gateway?: SepayPaymentGateway,
  ) {}
  async requireAppointmentContext(tx: TaskTransaction, rentalId: string, customerId: string) {
    const context = await this.repository.findAppointmentContext(tx, rentalId, customerId);
    if (!context) throw new NotFoundError(M.rentalNotFound);
    if (context.rental.status !== "ACTIVE") throw new ConflictError(M.rentalNotActive);
    return context;
  }
  async requireNoPendingRenewalPayment(tx: TaskTransaction, rentalId: string) {
    if (await this.repository.hasPendingRenewalPayment(tx, rentalId))
      throw new ConflictError(RENTAL_RENEWAL_MESSAGES.paymentOpen);
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
    return this.repository.createForHandover(tx, input);
  }
  findReservationRental(tx: TaskTransaction, reservationId: string) {
    return this.repository.findRentalByReservationId(tx, reservationId);
  }
  findHandoverRental(tx: TaskTransaction, bookingId: string) {
    return this.repository.findRentalByBookingId(tx, bookingId);
  }
  private async assertFacilityManagerAccess(actor: RentalActor, facilityId: string) {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(M.facilityAccessDenied);
    await this.facilityAssignments.requireFacilityAccess(
      facilityId,
      { kind: "assigned", userId: actor.id, role: actor.role },
      ["FACILITY_MANAGER"],
    );
  }
  async listFacilityRentals(
    actor: RentalActor,
    facilityId: string,
    query: FacilityRentalListQuery,
  ): Promise<FacilityRentalPage> {
    await this.assertFacilityManagerAccess(actor, facilityId);
    const result = await this.repository.findFacilityRentals(facilityId, query);
    return {
      items: result.items.map(toFacilityRentalItem),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async getFacilityRental(actor: RentalActor, facilityId: string, rentalId: string) {
    await this.assertFacilityManagerAccess(actor, facilityId);
    const row = await this.repository.findFacilityRentalById(facilityId, rentalId);
    if (!row) throw new NotFoundError(M.rentalNotFound);
    return toFacilityRentalItem(row);
  }
  async listFacilityRentalPayments(
    actor: RentalActor,
    facilityId: string,
    rentalId: string,
    query: FacilityRentalHistoryQuery,
  ): Promise<FacilityRentalPaymentPage> {
    const rental = await this.getFacilityRental(actor, facilityId, rentalId);
    const result = await this.repository.findBookingPayments(
      rental.bookingId,
      query,
      rental.reservationId,
      rental.id,
    );
    return {
      items: result.items.map((payment) => ({
        id: payment.id,
        type: payment.type,
        paymentCode: payment.paymentCode,
        status: payment.status,
        amount: payment.totalAmount,
        currency: payment.currency,
        paidAt: payment.paidAt?.toISOString() ?? null,
        refundAmount: payment.refundAmount,
        refundReason: payment.refundReason,
        refundedAt: payment.refundedAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
      })),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async listCustomerRentals(userId: string, query: RentalPageQuery): Promise<RentalPage> {
    const rows = await this.repository.findCustomerRentals(userId, query);
    const page = rows.slice(0, query.limit),
      last = page.at(-1);
    return {
      items: page.map(toCustomerRentalItem),
      nextCursor:
        rows.length > query.limit && last
          ? { afterEndAt: last.cursorEndAt, afterId: last.rental.id }
          : null,
    };
  }
  async getCustomerRental(rentalId: string, userId: string) {
    const row = await this.repository.findCustomerRentalById(rentalId, userId);
    if (!row) throw new NotFoundError(M.rentalNotFound);
    return {
      ...toCustomerRentalItem(row),
      customer: {
        userId: row.rental.userId,
        name: row.customer.name,
        email: row.customer.email,
        phone: row.booking.contactPhone,
      },
    } satisfies RentalDetail;
  }
  async listCustomerRentalPayments(rentalId: string, userId: string): Promise<RentalPaymentItem[]> {
    await this.getCustomerRental(rentalId, userId);
    return (await this.repository.findCustomerRentalPayments(rentalId, userId)).map(
      ({ payment }) => ({
        id: payment.id,
        type: payment.type,
        paymentCode: payment.paymentCode,
        provider: payment.provider,
        status: payment.status,
        totalAmount: payment.totalAmount,
        currency: payment.currency,
        paidAt: payment.paidAt?.toISOString() ?? null,
        refundAmount: payment.refundAmount,
        refundReason: payment.refundReason,
        refundedAt: payment.refundedAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
      }),
    );
  }
  async quoteRenewal(rentalId: string, customerId: string, months: number, idempotencyKey: string) {
    return this.repository.db.transaction(async (tx) => {
      const [rental] = await this.repository.lockRental(tx, rentalId);
      if (!rental || rental.userId !== customerId)
        throw new NotFoundError(RENTAL_RENEWAL_MESSAGES.rentalNotFound);
      const [existing] = await this.repository.findRenewalByIdempotencyKey(
        tx,
        rentalId,
        idempotencyKey,
      );
      if (existing) {
        if (existing.months !== months)
          throw new ConflictError(RENTAL_RENEWAL_MESSAGES.keyConflict);
        return this.toRenewalDto(
          existing,
          await this.repository.findRenewalPaymentId(tx, existing.id),
        );
      }
      const [unit] = await this.repository.findRenewalUnit(tx, rental.storageUnitId);
      const setting = await new SystemSettingsService(
        new SystemSettingsRepository(this.repository.db),
      ).getRenewalNoticeSetting(tx);
      if (!unit || !setting || !unit.active)
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.unavailable);
      const now = new Date();
      const noticeDays = Number(setting.value);
      const cutoffAt = new Date(rental.endAt.getTime() - noticeDays * 86_400_000);
      if (rental.status !== "ACTIVE" || now < rental.startAt || now >= cutoffAt)
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.requestWindowClosed);
      if (await this.repository.hasOpenReturn(tx, rentalId))
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.returnOpen);
      const newEndAt = new Date(rental.endAt.getTime() + months * 30 * 86_400_000);
      const available = await new StorageUnitsService(
        new StorageUnitsRepository(tx),
      ).getAvailableCapacity(unit.facilityId, unit.unitTypeId, rental.endAt, newEndAt);
      if (available < 1) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.capacityUnavailable);
      const expiresAt = new Date(Math.min(now.getTime() + CHECKOUT_TTL_MS, cutoffAt.getTime()));
      if (expiresAt <= now) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.requestWindowClosed);
      const [created] = await this.repository.createRenewal(tx, {
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
      });
      if (!created) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.quoteSaveFailed);
      return this.toRenewalDto(created, null);
    });
  }

  async listRenewals(rentalId: string, customerId: string, query: RentalRenewalPageQuery) {
    const [rental] = await this.repository.findOwnedRental(rentalId, customerId);
    if (!rental) throw new NotFoundError(RENTAL_RENEWAL_MESSAGES.rentalNotFound);
    const [total] = await this.repository.countRenewals(rentalId);
    const rows = await this.repository.findRenewals(rentalId, query);
    return {
      items: rows.map(({ renewal, paymentId }) => this.toRenewalDto(renewal, paymentId)),
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getRenewal(
    rentalId: string,
    renewalId: string,
    customerId: string,
  ): Promise<RentalRenewalDto> {
    const [row] = await this.repository.findCustomerRenewal(rentalId, renewalId, customerId);
    if (!row) throw new NotFoundError(RENTAL_RENEWAL_MESSAGES.renewalNotFound);
    return this.toRenewalDto(row.renewal, row.paymentId);
  }

  async startRenewalPayment(
    rentalId: string,
    renewalId: string,
    customerId: string,
    idempotencyKey: string,
  ): Promise<RentalRenewalPaymentSession> {
    const gateway = this.gateway;
    if (!gateway?.checkoutConfigured)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const prepared = await this.repository.db.transaction(async (tx) => {
      const [rental] = await this.repository.lockRental(tx, rentalId);
      if (!rental || rental.userId !== customerId)
        throw new NotFoundError(RENTAL_RENEWAL_MESSAGES.rentalNotFound);
      const [renewal] = await this.repository.lockRentalRenewal(tx, rentalId, renewalId);
      if (!renewal) throw new NotFoundError(RENTAL_RENEWAL_MESSAGES.renewalNotFound);
      const now = new Date();
      if (renewal.expiresAt <= now) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.quoteExpired);
      if (renewal.status === "PENDING_PAYMENT") {
        const [existing] = await this.repository.lockRenewalPayment(tx, renewalId);
        if (
          existing?.idempotencyKey === idempotencyKey &&
          existing.status === "PENDING" &&
          existing.expiresAt &&
          existing.expiresAt > now
        )
          return { renewal, payment: existing };
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.paymentOpen);
      }
      const [openPayment] = await this.repository.findPendingRenewalPayment(tx, rentalId, now);
      if (openPayment) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.paymentOpen);
      if (renewal.status !== "QUOTED" || renewal.expiresAt <= now)
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.quoteExpired);
      if (
        rental.status !== "ACTIVE" ||
        rental.endAt.getTime() !== renewal.oldEndAt.getTime() ||
        rental.storageUnitId !== renewal.storageUnitId ||
        rental.endAt <= now
      )
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.changed);
      if (await this.repository.hasOpenReturn(tx, rentalId))
        throw new ConflictError(RENTAL_RENEWAL_MESSAGES.returnOpen);
      const [unit] = await this.repository.lockRenewalUnit(tx, rental.storageUnitId);
      if (!unit?.active) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.unitUnavailable);
      const available = await new StorageUnitsService(
        new StorageUnitsRepository(tx),
      ).getAvailableCapacity(unit.facilityId, unit.unitTypeId, renewal.oldEndAt, renewal.newEndAt);
      if (available < 1) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.capacityUnavailable);
      const expiresAt = new Date(
        Math.min(
          now.getTime() + CHECKOUT_TTL_MS,
          renewal.expiresAt.getTime(),
          renewal.cutoffAt.getTime(),
        ),
      );
      const holdTokenHash = randomBytes(32).toString("hex");
      const paymentCode = `${gateway.paymentPrefix}${randomBytes(7).toString("hex").toUpperCase()}`;
      const [payment] = await this.repository.createRenewalPayment(tx, {
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
      });
      if (!payment) throw new ConflictError(RENTAL_RENEWAL_MESSAGES.idempotencyConflict);
      await this.repository.createRenewalAllocation(tx, {
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
      await this.repository.updateRenewal(tx, renewalId, {
        status: RentalRenewalStatus.PENDING_PAYMENT,
        updatedAt: now,
      });
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

  async processRenewalPaymentEvent(event: VerifiedPaymentEvent) {
    const [candidate] = await this.repository.findRenewalPaymentByCode(event.paymentCode);
    if (!candidate?.renewalId || candidate.provider !== "sepay") return null;
    const renewalId = candidate.renewalId;
    return this.repository.db.transaction(async (tx) => {
      const [renewalReference] = await this.repository.findRenewalRentalId(tx, renewalId);
      if (!renewalReference) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
      const [rental] = await this.repository.lockRental(tx, renewalReference.rentalId);
      const [renewal] = await this.repository.lockRenewal(tx, renewalId);
      const [payment] = await this.repository.lockPayment(tx, candidate.id);
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
      const recorded = await new PaymentsRepository(this.repository.db).recordEventInTransaction(
        tx,
        event,
        payment.id,
      );
      if (!recorded) return { duplicate: true, processed: false, paymentId: payment.id };

      const [unit] = await this.repository.lockRenewalUnit(tx, rental.storageUnitId);
      const paidAt = event.paidAt ?? new Date();
      if (!payment.holdTokenHash) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
      const [hold] = await this.repository.lockRenewalHold(tx, renewal.id, payment.holdTokenHash);
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
        await this.repository.updateRenewalPayment(tx, payment.id, {
          status: "REFUND_PENDING",
          paidAt,
          refundReason: "RENEWAL_NOT_APPLIED",
          refundAmount: payment.totalAmount,
          providerPaymentId: event.referenceCode ?? event.providerEventId,
          updatedAt: new Date(),
        });
        await this.repository.updateRenewal(tx, renewal.id, {
          status: RentalRenewalStatus.REFUND_REQUIRED,
          failureReason: failure,
          updatedAt: new Date(),
        });
        await this.repository.releaseRenewalAllocations(tx, renewal.id, {
          status: "RELEASED",
          updatedAt: new Date(),
        });
      } else {
        if (!unit) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
        if (hold?.status === "ACTIVE" && hold.expiresAt && hold.expiresAt > new Date()) {
          await this.repository.confirmRenewalAllocation(tx, hold.id, {
            kind: "BOOKING",
            accessTokenHash: null,
            expiresAt: null,
            updatedAt: new Date(),
          });
        } else {
          await this.repository.createRenewalAllocation(tx, {
            referenceId: renewal.id,
            facilityId: unit.facilityId,
            unitTypeId: unit.unitTypeId,
            startsAt: renewal.oldEndAt,
            endsAt: renewal.newEndAt,
            kind: "BOOKING",
          });
        }
        await this.repository.updateRenewalPayment(tx, payment.id, {
          status: "SUCCEEDED",
          paidAt,
          providerPaymentId: event.referenceCode ?? event.providerEventId,
          updatedAt: new Date(),
        });
        await this.repository.updateRenewedRental(tx, rental.id, {
          endAt: renewal.newEndAt,
          updatedAt: new Date(),
        });
        await this.repository.updateRenewal(tx, renewal.id, {
          status: RentalRenewalStatus.APPLIED,
          appliedAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return { duplicate: false, processed: true, paymentId: payment.id };
    });
  }

  private toRenewalDto(
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

function toCustomerRentalItem(row: RentalWithDetails): RentalListItem {
  return {
    id: row.rental.id,
    bookingId: row.rental.bookingId,
    reservationId: row.rental.reservationId,
    userId: row.rental.userId,
    bookingCode: row.booking.bookingCode ?? row.booking.id.slice(0, 8).toUpperCase(),
    facility: { id: row.facility.id, name: row.facility.name, address: row.facility.address },
    unitType: { id: row.unitType.id, name: row.unitType.name, sizeLabel: row.unitType.sizeLabel },
    storageUnit: { id: row.storageUnit.id, code: row.storageUnit.code },
    startAt: row.rental.startAt.toISOString(),
    endAt: row.rental.endAt.toISOString(),
    closedAt: row.rental.closedAt?.toISOString() ?? null,
    status: row.rental.status,
    bookingStatus: row.booking.status,
    actions: { canCancel: false, canReschedule: false, note: M.readOnly },
  };
}

export function createRentalsService(database: Database, gateway?: SepayPaymentGateway) {
  return new RentalsService(
    new RentalsRepository(database),
    new FacilityAssignmentsService(
      new FacilityAssignmentsRepository(database),
      new FacilitiesRepository(database),
    ),
    gateway,
  );
}
