import { randomBytes } from "node:crypto";
import {
  type CheckoutSessionInput,
  CheckoutSessionInputSchema,
  type ReservationPaymentSession,
} from "@metastorage/contracts";
import type { Database, PaymentRefundReason, ReservationRecord } from "@metastorage/database";
import { ReservationStatus } from "@metastorage/database/schema/reservations";
import { localDate } from "../../common/date";
import { AppError, ConflictError, NotFoundError } from "../../common/errors/app-error";
import { isDevelopmentEnvironment } from "../../config/env";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import {
  ReservationsRepository,
  type ReservationTransaction,
} from "../reservations/reservations.repository";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { PAYMENT_MESSAGES as m } from "./payments.messages";
import { PaymentsRepository } from "./payments.repository";
import type { VerifiedPaymentEvent } from "./payments.types";
import { ReservationPaymentsRepository } from "./reservation-payments.repository";
import type { SepayPaymentGateway } from "./sepay.gateway";

export class ReservationPaymentsService {
  constructor(
    private readonly repository: ReservationPaymentsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly events: PaymentsRepository,
    private readonly gateway?: SepayPaymentGateway,
  ) {}

  releaseAfterHandover(tx: ReservationTransaction, reservationId: string) {
    return this.repository.releaseCapacity(tx, reservationId);
  }

  async startPayment(
    reservationId: string,
    input: CheckoutSessionInput,
    customerId: string,
  ): Promise<ReservationPaymentSession> {
    input = CheckoutSessionInputSchema.parse(input);
    const gateway = this.gateway;
    if (!gateway?.checkoutConfigured)
      throw new AppError(m.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const prepared = await this.repository.transaction(async (tx) => {
      const reservation = await this.reservations.findByIdForUpdate(reservationId, tx);
      if (!reservation || reservation.customerId !== customerId)
        throw new NotFoundError(m.reservationNotFound);
      if (reservation.status !== ReservationStatus.DRAFT)
        throw new ConflictError(m.bookingNotDraft);
      const existing = await this.repository.findByIdempotency(tx, input.idempotencyKey);
      if (existing) {
        if (existing.reservationId !== reservation.id || existing.provider !== "sepay")
          throw new ConflictError(m.idempotencyKeyUsedForAnotherCheckout);
        const hold = await this.repository.findHold(tx, existing);
        if (
          existing.status !== "PENDING" ||
          hold?.status !== "ACTIVE" ||
          !hold.expiresAt ||
          hold.expiresAt <= new Date()
        )
          throw new ConflictError(m.holdExpired);
        return { payment: existing, expiresAt: hold.expiresAt };
      }
      if (await this.repository.findOpenPayment(tx, reservation.id))
        throw new ConflictError(m.paymentPendingReconciliation);
      if (
        !isDevelopmentEnvironment() &&
        localDate(reservation.rentalStartAt, "Asia/Ho_Chi_Minh") <=
          localDate(new Date(), "Asia/Ho_Chi_Minh")
      )
        throw new ConflictError(m.checkInTomorrow);
      const offering = await this.repository.lockOffering(
        tx,
        reservation.facilityId,
        reservation.unitTypeId,
      );
      if (!offering?.active || !offering.facilityActive)
        throw new ConflictError(m.bookingOfferingUnavailable);
      if ((await this.available(tx, reservation)) < 1)
        throw new ConflictError(m.bookingCapacityUnavailable);
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const holdTokenHash = randomBytes(32).toString("hex");
      await this.repository.createHold(tx, {
        referenceId: reservation.id,
        facilityId: reservation.facilityId,
        unitTypeId: reservation.unitTypeId,
        startsAt: reservation.rentalStartAt,
        endsAt: reservation.rentalEndAt,
        kind: "HOLD",
        accessTokenHash: holdTokenHash,
        expiresAt,
      });
      const paymentCode = `${gateway.paymentPrefix}${randomBytes(7).toString("hex").toUpperCase()}`;
      const payment = await this.repository.createPayment(tx, {
        reservationId: reservation.id,
        holdTokenHash,
        provider: "sepay",
        paymentCode,
        providerPaymentId: `pending_${paymentCode}`,
        idempotencyKey: input.idempotencyKey,
        totalAmount: String(reservation.totalAmount),
        currency: "VND",
        status: "PENDING",
        expiresAt,
      });
      if (!payment) throw new ConflictError(m.idempotencyKeyUsedForAnotherCheckout);
      return { payment, expiresAt };
    });
    const session = gateway.createCheckoutSession({
      paymentId: prepared.payment.id,
      reservationId,
      paymentCode: prepared.payment.paymentCode,
      amount: Number(prepared.payment.totalAmount),
      currency: prepared.payment.currency,
      description: m.checkoutDescription(prepared.payment.paymentCode),
    });
    if (!session) throw new AppError(m.sepayUnavailable, 503);
    return {
      reservationId,
      paymentId: prepared.payment.id,
      provider: "sepay" as const,
      status: "PENDING" as const,
      paymentCode: prepared.payment.paymentCode,
      checkoutUrl: session.checkoutUrl,
      checkoutFormFields: session.formFields,
      expiresAt: prepared.expiresAt.toISOString(),
    };
  }

  private available(tx: ReservationTransaction, reservation: ReservationRecord) {
    return new StorageUnitsService(new StorageUnitsRepository(tx)).getAvailableCapacity(
      reservation.facilityId,
      reservation.unitTypeId,
      reservation.rentalStartAt,
      reservation.rentalEndAt,
    );
  }

  async processEvent(event: VerifiedPaymentEvent) {
    const candidate = await this.repository.findByCode(event.paymentCode);
    if (!candidate?.reservationId || candidate.provider !== "sepay") return null;
    const reservationId = candidate.reservationId;
    return this.repository.transaction(async (tx) => {
      const reservation = await this.reservations.findByIdForUpdate(reservationId, tx);
      const payment = await this.repository.lockPayment(tx, candidate.id);
      if (!reservation || !payment) throw new NotFoundError(m.paymentNotFound);
      if (payment.status !== "PENDING")
        return { duplicate: true, processed: false, paymentId: payment.id };
      if (
        event.successful === false ||
        event.transferType !== "in" ||
        event.amount !== Number(payment.totalAmount) ||
        (event.currency && event.currency !== payment.currency)
      )
        return { duplicate: false, processed: false, paymentId: payment.id };
      if (!(await this.events.recordEventInTransaction(tx, event, payment.id)))
        return { duplicate: true, processed: false, paymentId: payment.id };
      const offering = await this.repository.lockOffering(
        tx,
        reservation.facilityId,
        reservation.unitTypeId,
      );
      const hold = await this.repository.findHold(tx, payment);
      let reason: PaymentRefundReason | null = null;
      if (reservation.status !== ReservationStatus.DRAFT) reason = "CUSTOMER_CANCELLATION";
      else if (
        reservation.rentalEndAt <= new Date() ||
        (!isDevelopmentEnvironment() && reservation.rentalStartAt <= new Date())
      )
        reason = "CHECK_IN_CLOSED";
      else if (!offering?.active || !offering.facilityActive) reason = "OFFERING_UNAVAILABLE";
      else if (
        !(hold?.status === "ACTIVE" && hold.expiresAt && hold.expiresAt > new Date()) &&
        (await this.available(tx, reservation)) < 1
      )
        reason = "NO_CAPACITY";
      if (reason) {
        await this.repository.updatePayment(tx, payment.id, {
          status: "REFUND_PENDING",
          paidAt: event.paidAt ?? new Date(),
          refundReason: reason,
          refundAmount: payment.totalAmount,
          providerPaymentId: event.referenceCode ?? event.providerEventId,
        });
        await this.repository.releaseCapacity(tx, reservation.id);
        if (reservation.status === ReservationStatus.DRAFT)
          await this.reservations.updateStatus(reservation.id, ReservationStatus.EXPIRED, tx);
      } else {
        let allocationId = hold?.id;
        if (!allocationId) {
          const created = await this.repository.createHold(tx, {
            referenceId: reservation.id,
            facilityId: reservation.facilityId,
            unitTypeId: reservation.unitTypeId,
            startsAt: reservation.rentalStartAt,
            endsAt: reservation.rentalEndAt,
            kind: "RESERVATION",
          });
          allocationId = created?.id;
        }
        if (!allocationId) throw new AppError(m.failedToFinalizePayment);
        await this.repository.confirmCapacity(tx, allocationId);
        await this.repository.updatePayment(tx, payment.id, {
          status: "SUCCEEDED",
          paidAt: event.paidAt ?? new Date(),
          providerPaymentId: event.referenceCode ?? event.providerEventId,
        });
        await this.reservations.updateStatus(reservation.id, ReservationStatus.CONFIRMED, tx);
        await recordLifecycleEvent(tx, {
          key: `reservation:${reservation.id}:confirmed`,
          type: "BOOKING_CONFIRMED",
          reservationId: reservation.id,
          managers: true,
          occurredAt: event.paidAt ?? new Date(),
        });
      }
      return { duplicate: false, processed: true, paymentId: payment.id };
    });
  }

  async cancel(
    tx: ReservationTransaction,
    reservation: ReservationRecord,
    reason: "CUSTOMER_CANCELLATION" | "NO_SHOW" = "CUSTOMER_CANCELLATION",
  ) {
    const payment = await this.repository.findOpenPayment(tx, reservation.id);
    if (reservation.status === ReservationStatus.CONFIRMED && payment?.status !== "SUCCEEDED")
      throw new ConflictError(m.paymentNotFound);
    if (payment?.status === "PENDING") throw new ConflictError(m.paymentPendingReconciliation);
    if (payment?.status === "SUCCEEDED") {
      await this.repository.updatePayment(tx, payment.id, {
        status: "REFUND_PENDING",
        refundReason: reason,
        refundAmount: String(reservation.rentalFeeAmount),
        depositForfeitedAmount: String(reservation.depositAmount),
      });
    }
    await this.repository.releaseCapacity(tx, reservation.id);
  }
}

export function createReservationPaymentsService(db: Database, gateway?: SepayPaymentGateway) {
  return new ReservationPaymentsService(
    new ReservationPaymentsRepository(db),
    new ReservationsRepository(db),
    new PaymentsRepository(db),
    gateway,
  );
}
