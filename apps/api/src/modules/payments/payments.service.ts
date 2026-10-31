import type {
  DebtPaymentInput,
  DebtQuery,
  DebtRecord,
  ManualRefund,
  ManualRefundConfirmation,
  ManualRefundQuery,
  PaymentStatusResponse,
} from "@metastorage/contracts";
import { DebtStatus, PaymentMethod, PaymentType } from "@metastorage/database";
import { UserRole } from "@metastorage/database/schema/user-enums";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../common/errors/app-error";
import { mapPageDto } from "../../common/types/page.dto";
import { env } from "../../config/env";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { createRentalsService, type RentalsService } from "../rentals/rentals.service";
import { PAYMENT_MESSAGES } from "./payments.messages";
import { PaymentsRepository } from "./payments.repository";
import type { PaymentStatusCredentials } from "./payments.types";
import {
  createReservationPaymentsService,
  type ReservationPaymentsService,
} from "./reservation-payments.service";
import { SepayPaymentGateway } from "./sepay.gateway";

function requirePaymentCode(code: string | null): string {
  if (!code) throw new AppError(PAYMENT_MESSAGES.paymentCodeMissing, 500);
  return code;
}

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly sepayGateway?: SepayPaymentGateway,
    private readonly logger?: Pick<FastifyBaseLogger, "warn">,
    private readonly reservationPayments?: ReservationPaymentsService,
    private readonly rentals?: RentalsService,
    private readonly assignments?: FacilityAssignmentsService,
  ) {}

  private toDebtRecord(
    row: Omit<NonNullable<Awaited<ReturnType<PaymentsRepository["findDebt"]>>>, "facilityId">,
  ): DebtRecord {
    return {
      id: row.debt.id,
      rentalId: row.rentalId,
      customerId: row.customerId,
      customerName: row.customerName,
      unitCode: row.unitCode,
      originalAmount: row.debt.originalAmount,
      paidAmount: row.debt.paidAmount,
      remainingAmount: String(Number(row.debt.originalAmount) - Number(row.debt.paidAmount)),
      status: row.debt.status,
      currency: row.currency,
      createdAt: row.debt.createdAt.toISOString(),
    };
  }

  async listDebts(query: DebtQuery, actor: { id: string; role: string }) {
    if (!this.assignments) throw new ForbiddenError(PAYMENT_MESSAGES.debtAccessDenied);
    const scope =
      actor.role === UserRole.STORAGE_CUSTOMER
        ? { customerId: actor.id }
        : {
            facilityIds: (
              await this.assignments.listUserAssignments(actor.id, actor.role as UserRole)
            ).map((row) => row.facilityId),
          };
    const page = await this.repository.listDebts(scope, query);
    return mapPageDto(page, query, (row) => this.toDebtRecord(row));
  }

  async getDebt(id: string, actor: { id: string; role: string }) {
    const row = await this.repository.findDebt(id);
    if (!row) throw new NotFoundError(PAYMENT_MESSAGES.debtNotFound);
    if (actor.role === UserRole.STORAGE_CUSTOMER) {
      if (row.customerId !== actor.id) throw new NotFoundError(PAYMENT_MESSAGES.debtNotFound);
    } else {
      if (
        !this.assignments ||
        (actor.role !== UserRole.FACILITY_STAFF && actor.role !== UserRole.FACILITY_MANAGER)
      )
        throw new ForbiddenError(PAYMENT_MESSAGES.debtAccessDenied);
      await this.assignments.requireFacilityAccess(
        row.facilityId,
        { kind: "assigned", userId: actor.id, role: actor.role },
        [actor.role],
      );
    }
    const history = await this.repository.listDebtPayments(id);
    return {
      ...this.toDebtRecord(row),
      payments: history.map((payment) => ({
        ...payment,
        paidAt: payment.paidAt?.toISOString() ?? null,
      })),
    };
  }

  async collectDebt(id: string, input: DebtPaymentInput, actor: { id: string; role: string }) {
    if (actor.role !== UserRole.FACILITY_STAFF || !this.assignments)
      throw new ForbiddenError(PAYMENT_MESSAGES.debtAccessDenied);
    const assignments = this.assignments;
    await this.repository.transaction(async (tx) => {
      const context = await this.repository.findDebt(id, tx);
      if (!context) throw new NotFoundError(PAYMENT_MESSAGES.debtNotFound);
      await assignments.requireActiveAssignments(tx, context.facilityId, [
        { userId: actor.id, role: UserRole.FACILITY_STAFF },
      ]);
      const debt = await this.repository.lockDebt(tx, id);
      if (!debt) throw new NotFoundError(PAYMENT_MESSAGES.debtNotFound);
      const key = `debt:${input.idempotencyKey}`;
      const existing = await this.repository.findDebtPayment(tx, key);
      if (existing) {
        if (
          existing.debtId !== id ||
          Number(existing.totalAmount) !== input.amount ||
          existing.method !== input.method ||
          existing.reference !== (input.reference ?? null) ||
          existing.recordedBy !== actor.id
        )
          throw new ConflictError(PAYMENT_MESSAGES.debtPaymentConflict);
        return;
      }
      const paidAmount = Number(debt.paidAmount) + input.amount;
      if (paidAmount > Number(debt.originalAmount))
        throw new ConflictError(PAYMENT_MESSAGES.debtAmountExceeded);
      const now = new Date();
      const recorded = await this.repository.insertDebtPayment(tx, {
        debtId: id,
        rentalId: context.rentalId,
        type: PaymentType.DEBT_COLLECTION,
        totalAmount: String(input.amount),
        currency: context.currency,
        method: PaymentMethod[input.method],
        reference: input.reference,
        recordedBy: actor.id,
        status: "SUCCEEDED",
        paidAt: now,
        idempotencyKey: key,
      });
      if (!recorded.length) throw new ConflictError(PAYMENT_MESSAGES.debtPaymentConflict);
      await this.repository.updateDebt(tx, id, {
        paidAmount: String(paidAmount),
        status:
          paidAmount === Number(debt.originalAmount) ? DebtStatus.PAID : DebtStatus.PARTIALLY_PAID,
        updatedAt: now,
      });
    });
    return this.getDebt(id, actor);
  }

  async listManualRefunds(query: ManualRefundQuery): Promise<ManualRefund[]> {
    const rows = await this.repository.listManualRefunds(query);
    return rows.map((row) => ({ ...row, paidAt: row.paidAt?.toISOString() ?? null }));
  }

  async confirmManualRefund(
    paymentId: string,
    reference: string,
    actorId: string,
  ): Promise<ManualRefundConfirmation> {
    const payment = await this.repository.confirmManualRefund(paymentId, reference, actorId);
    if (!payment.refundReference || !payment.refundedAt || !payment.refundedBy)
      throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
    return {
      paymentId: payment.id,
      type: payment.type,
      status: "REFUNDED",
      amount: payment.refundAmount ?? payment.totalAmount,
      depositForfeitedAmount: payment.depositForfeitedAmount,
      currency: payment.currency,
      reference: payment.refundReference,
      refundedAt: payment.refundedAt.toISOString(),
      refundedBy: payment.refundedBy,
    };
  }

  async handleSepayWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    if (!this.sepayGateway)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const event = this.sepayGateway.verifyWebhook(headers, rawBody);
    const renewalResult = await this.rentals?.processRenewalPaymentEvent(event);
    if (renewalResult) return renewalResult;
    const reservationResult = await this.reservationPayments?.processEvent(event);
    if (reservationResult) return reservationResult;
    const existingEvent = await this.repository.findProviderEvent("sepay", event.providerEventId);
    if (existingEvent && existingEvent.status !== "FAILED") return { duplicate: true };
    const recorded =
      existingEvent ??
      (await this.repository.recordProviderEvent({
        provider: "sepay",
        providerEventId: event.providerEventId,
        paymentId: null,
        paymentCode: event.paymentCode,
        amount: event.amount,
        transferType: event.transferType,
        referenceCode: event.referenceCode,
        status: "FAILED",
        payloadMetadata: event.metadata,
      }));
    if (!recorded) return { duplicate: true };
    const payment = await this.repository.findPendingByPaymentCode(event.paymentCode);
    if (
      !payment ||
      event.successful === false ||
      event.transferType !== "in" ||
      event.amount !== Number(payment.totalAmount) ||
      (event.currency && event.currency !== payment.currency)
    ) {
      await this.repository.updateProviderEvent(recorded.id, "IGNORED");
      return { duplicate: false, processed: false };
    }
    await this.repository.updateProviderEvent(recorded.id, "IGNORED");
    return { duplicate: false, processed: false };
  }

  private async reconcilePayment(paymentId: string): Promise<void> {
    if (!this.sepayGateway?.checkoutConfigured) return;
    const payment = await this.repository.claimPaymentReconciliation(paymentId);
    if (!payment) return;
    try {
      const event = await this.sepayGateway.retrievePayment({
        ...payment,
        paymentCode: requirePaymentCode(payment.paymentCode),
      });
      if (!event) return;
      const renewalResult = await this.rentals?.processRenewalPaymentEvent(event);
      if (!renewalResult) await this.reservationPayments?.processEvent(event);
    } catch (error) {
      this.logger?.warn(
        {
          paymentId,
          reason: error instanceof AppError ? error.code : "PAYMENT_RECONCILIATION_FAILED",
        },
        "Payment reconciliation failed; will retry",
      );
      throw error;
    }
  }

  async reconcilePendingPayments(
    facilityId?: string,
  ): Promise<{ checked: number; failed: number }> {
    if (!this.sepayGateway?.checkoutConfigured) return { checked: 0, failed: 0 };
    const pending = await this.repository.listPendingSepayPayments(facilityId);
    const results = await Promise.allSettled(pending.map(({ id }) => this.reconcilePayment(id)));
    return {
      checked: pending.length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  }

  async getStatus(
    paymentId: string,
    credentials: PaymentStatusCredentials,
  ): Promise<PaymentStatusResponse> {
    if (!credentials.userId) throw new UnauthorizedError(PAYMENT_MESSAGES.paymentAccessRequired);
    let payment = await this.repository.findPaymentForStatus(paymentId, {
      userId: credentials.userId,
    });
    if (!payment) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
    // Authorize before any provider request or state transition. Never use data
    // from the browser return URL to decide whether payment was received.
    if (payment.status === "PENDING") {
      requirePaymentCode(payment.paymentCode);
      await this.reconcilePayment(payment.id);
      payment = (await this.repository.findPayment(payment.id)) ?? payment;
    }
    if (payment.status === "PENDING") requirePaymentCode(payment.paymentCode);
    const hold =
      payment.status === "PENDING" ? await this.repository.findActiveHoldForPayment(payment) : null;
    const transferInstructions =
      payment.status === "PENDING" && this.sepayGateway && hold
        ? this.sepayGateway.createInstructions({
            paymentCode: requirePaymentCode(payment.paymentCode),
            amount: payment.totalAmount,
            currency: payment.currency,
            expiresAt: hold?.expiresAt ?? payment.expiresAt ?? new Date(Date.now() + 10 * 60_000),
          })
        : undefined;
    const rentalId = payment.renewalId
      ? await this.repository.findRenewalRentalId(payment.renewalId)
      : undefined;
    const checkoutSession =
      payment.status === "PENDING" &&
      this.sepayGateway &&
      (payment.bookingId || payment.reservationId || payment.renewalId) &&
      hold
        ? this.sepayGateway.createCheckoutSession({
            paymentCode: requirePaymentCode(payment.paymentCode),
            amount: Number(payment.totalAmount),
            currency: payment.currency,
            description: PAYMENT_MESSAGES.checkoutDescription(
              requirePaymentCode(payment.paymentCode),
            ),
            bookingId: payment.bookingId ?? undefined,
            reservationId: payment.reservationId ?? undefined,
            renewalId: payment.renewalId ?? undefined,
            rentalId,
            paymentId: payment.id,
          })
        : null;
    return {
      paymentId: payment.id,
      type: payment.type,
      ...(payment.reservationId ? { reservationId: payment.reservationId } : {}),
      status: payment.status,
      provider: payment.provider,
      paymentCode: payment.paymentCode,
      transferInstructions,
      refund:
        payment.status === "REFUND_PENDING" || payment.status === "REFUNDED"
          ? {
              amount: payment.refundAmount ?? payment.totalAmount,
              depositForfeitedAmount: payment.depositForfeitedAmount,
              reason: payment.refundReason,
            }
          : undefined,
      checkoutUrl: checkoutSession?.checkoutUrl,
      checkoutFormFields: checkoutSession?.formFields,
    };
  }
}

export function createSepayGateway() {
  const isSepay = env.PAYMENT_PROVIDER === "sepay";
  const hasPgConfig = Boolean(env.SEPAY_MERCHANT_ID && env.SEPAY_SECRET_KEY);

  return isSepay && hasPgConfig
    ? new SepayPaymentGateway({
        paymentPrefix: env.SEPAY_PAYMENT_PREFIX,
        env: env.SEPAY_ENV,
        merchantId: env.SEPAY_MERCHANT_ID,
        secretKey: env.SEPAY_SECRET_KEY,
        webUrl: env.WEB_URL,
        bankName: env.SEPAY_BANK_NAME,
        accountNumber: env.SEPAY_BANK_ACCOUNT_NUMBER,
        accountName: env.SEPAY_BANK_ACCOUNT_NAME,
      })
    : undefined;
}

export function createPaymentsService(fastify: FastifyInstance): PaymentsService {
  const sepayGateway = createSepayGateway();
  const repository = new PaymentsRepository(fastify.db);
  return new PaymentsService(
    repository,
    sepayGateway,
    fastify.log,
    createReservationPaymentsService(fastify.db, sepayGateway),
    createRentalsService(fastify.db, sepayGateway),
    new FacilityAssignmentsService(
      new FacilityAssignmentsRepository(fastify.db),
      new FacilitiesRepository(fastify.db),
    ),
  );
}
