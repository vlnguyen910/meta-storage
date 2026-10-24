import type {
  ConfirmRentalChargeRefund,
  CreateRentalCharge,
  RentalChargeAdjustment,
  RentalChargeDecision,
  RentalChargeDispute,
  RentalChargeDto,
  ResolveRentalChargeDispute,
} from "@metastorage/contracts/rental-charges";
import type { RentalCharge } from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { RENTAL_CHARGE_MESSAGES as m } from "./rental-charges.messages";
import type { RentalChargesRepository } from "./rental-charges.repository";
import type { RentalChargeActor } from "./rental-charges.types";

function chargeDto(charge: RentalCharge, adjustedAmount = charge.amount): RentalChargeDto {
  return {
    id: charge.id,
    rentalId: charge.rentalId,
    source: charge.source,
    category: charge.category,
    amount: charge.amount,
    adjustedAmount,
    paidAmount: "0",
    refundedAmount: "0",
    outstandingAmount: adjustedAmount,
    currency: charge.currency,
    evidence: charge.evidence,
    dueDate: charge.dueDate,
    status: charge.status,
    createdBy: charge.createdBy,
    approvedBy: charge.approvedBy,
    decisionReason: charge.decisionReason,
    disputedAt: charge.disputedAt?.toISOString() ?? null,
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
  };
}

export class RentalChargesService {
  constructor(private readonly repo: RentalChargesRepository) {}

  async listMine(actor: RentalChargeActor, rentalId: string) {
    if (actor.role !== "CUSTOMER") throw new ForbiddenError(m.forbidden);
    const rows = await this.repo.listForCustomer(rentalId, actor.id);
    const rental = await this.repo.customerOwnsRental(rentalId, actor.id);
    if (!rental) throw new NotFoundError(m.rentalNotFound);
    return rows.map(({ charge, adjustedAmount, paidAmount, refundedAmount }) => ({
      id: charge.id,
      rentalId: charge.rentalId,
      source: charge.source,
      category: charge.category,
      amount: charge.amount,
      adjustedAmount,
      paidAmount,
      refundedAmount,
      outstandingAmount: String(Math.max(0, Number(adjustedAmount) - Number(paidAmount))),
      currency: charge.currency,
      evidence: charge.evidence,
      dueDate: charge.dueDate,
      status: charge.status,
      createdBy: charge.createdBy,
      approvedBy: charge.approvedBy,
      decisionReason: charge.decisionReason,
      disputedAt: charge.disputedAt?.toISOString() ?? null,
      createdAt: charge.createdAt.toISOString(),
      updatedAt: charge.updatedAt.toISOString(),
    }));
  }

  async create(actor: RentalChargeActor, rentalId: string, input: CreateRentalCharge) {
    if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.forbidden);
    const rental = await this.repo.rental(rentalId);
    if (!rental) throw new NotFoundError(m.rentalNotFound);
    if (!(await this.repo.hasAssignment(rental.facilityId, actor.id, actor.role)))
      throw new ForbiddenError(m.forbidden);
    const charge = await this.repo.createExtra({ rentalId, actorId: actor.id, ...input });
    if (!charge) throw new NotFoundError(m.rentalNotFound);
    return chargeDto(charge);
  }

  async decide(
    actor: RentalChargeActor,
    chargeId: string,
    input: RentalChargeDecision,
    approved: boolean,
  ) {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(m.forbidden);
    const context = await this.repo.getChargeContext(chargeId);
    if (!context) throw new NotFoundError(m.notFound);
    if (!(await this.repo.hasAssignment(context.rental.facilityId, actor.id, actor.role)))
      throw new ForbiddenError(m.forbidden);
    if (context.charge.createdBy === actor.id) throw new ForbiddenError(m.selfApproval);
    if (context.charge.status !== "PENDING_APPROVAL") throw new ConflictError(m.invalidState);
    const updated = await this.repo.transition(chargeId, {
      status: approved ? "OPEN" : "VOID",
      actorId: actor.id,
      type: approved ? "APPROVED" : "REJECTED",
      reason: input.reason,
    });
    if (!updated) throw new NotFoundError(m.notFound);
    return chargeDto(updated);
  }

  async dispute(actor: RentalChargeActor, chargeId: string, input: RentalChargeDispute) {
    if (actor.role !== "CUSTOMER") throw new ForbiddenError(m.forbidden);
    const context = await this.repo.getChargeContext(chargeId);
    if (!context || context.booking.userId !== actor.id) throw new NotFoundError(m.notFound);
    if (context.charge.status !== "OPEN") throw new ConflictError(m.invalidState);
    const deadline = new Date(context.charge.createdAt);
    deadline.setDate(deadline.getDate() + 7);
    if (new Date() > deadline) throw new ConflictError(m.disputeExpired);
    const updated = await this.repo.transition(chargeId, {
      status: "DISPUTED",
      actorId: actor.id,
      type: "DISPUTED",
      reason: input.reason,
      disputedAt: new Date(),
    });
    if (!updated) throw new NotFoundError(m.notFound);
    return chargeDto(updated);
  }

  async adjust(actor: RentalChargeActor, chargeId: string, input: RentalChargeAdjustment) {
    if (actor.role !== "BUSINESS_OPERATION_MANAGER") throw new ForbiddenError(m.forbidden);
    const result = await this.repo.applyAdjustment(chargeId, { ...input, actorId: actor.id });
    if (!result) throw new NotFoundError(m.notFound);
    if ("conflict" in result) throw new ConflictError(m.invalidState);
    return chargeDto(result, result.adjustedAmount);
  }

  async resolveDispute(
    actor: RentalChargeActor,
    chargeId: string,
    input: ResolveRentalChargeDispute,
  ) {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(m.forbidden);
    const context = await this.repo.getChargeContext(chargeId);
    if (!context) throw new NotFoundError(m.notFound);
    if (!(await this.repo.hasAssignment(context.rental.facilityId, actor.id, actor.role)))
      throw new ForbiddenError(m.forbidden);
    if (context.charge.createdBy === actor.id) throw new ForbiddenError(m.selfApproval);
    const result = await this.repo.resolveDispute(chargeId, { ...input, actorId: actor.id });
    if (!result) throw new NotFoundError(m.notFound);
    if ("conflict" in result) throw new ConflictError(m.invalidState);
    return chargeDto(result, result.adjustedAmount);
  }

  async listRefunds(actor: RentalChargeActor, query: { limit: number; offset: number }) {
    if (actor.role !== "SYSTEM_ADMIN" && actor.role !== "BUSINESS_OPERATION_MANAGER")
      throw new ForbiddenError(m.forbidden);
    const rows = await this.repo.listRefunds(query.limit, query.offset);
    return rows.map(({ refund }) => ({
      id: refund.id,
      chargeId: refund.chargeId,
      paymentId: refund.paymentId,
      settlementId: refund.settlementId,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      reference: refund.reference,
      createdAt: refund.createdAt.toISOString(),
      confirmedAt: refund.confirmedAt?.toISOString() ?? null,
      confirmedBy: refund.confirmedBy,
    }));
  }

  async confirmRefund(
    actor: RentalChargeActor,
    refundId: string,
    input: ConfirmRentalChargeRefund,
  ) {
    if (actor.role !== "SYSTEM_ADMIN" && actor.role !== "BUSINESS_OPERATION_MANAGER")
      throw new ForbiddenError(m.forbidden);
    const result = await this.repo.confirmRefund(refundId, input.reference, actor.id);
    if (!result) throw new NotFoundError(m.refundNotFound);
    if ("conflict" in result) throw new ConflictError(m.refundState);
    return {
      id: result.id,
      chargeId: result.chargeId,
      paymentId: result.paymentId,
      amount: result.amount,
      reason: result.reason,
      status: result.status,
      reference: result.reference,
      createdAt: result.createdAt.toISOString(),
      confirmedAt: result.confirmedAt?.toISOString() ?? null,
      confirmedBy: result.confirmedBy,
    };
  }
}
