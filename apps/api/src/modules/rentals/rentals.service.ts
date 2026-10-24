import type {
  FacilityRentalHistoryQuery,
  FacilityRentalItem,
  FacilityRentalListQuery,
  FacilityRentalPage,
  FacilityRentalPaymentPage,
  FacilityRentalRenewalPage,
  RentalPage,
  RentalPageQuery,
  RentalPaymentItem,
} from "@metastorage/contracts";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { renewalDto } from "../renewals/renewals.service";
import { RENTAL_MESSAGES } from "./rentals.messages";
import { type RentalsRepository, toListItem } from "./rentals.repository";
import type { FacilityRentalActor, FacilityRentalRow } from "./rentals.types";

function facilityRentalDto(row: FacilityRentalRow): FacilityRentalItem {
  return {
    id: row.rental.id,
    bookingId: row.booking.id,
    bookingCode: row.booking.bookingCode,
    facilityId: row.rental.facilityId,
    status: row.rental.status,
    version: row.rental.version,
    customer: {
      userId: row.booking.userId,
      name: row.booking.name,
      email: row.booking.email,
      phone: row.booking.phone,
    },
    unit: row.unit,
    startAt: row.rental.startAt.toISOString(),
    expectedEndAt: row.rental.expectedEndAt.toISOString(),
    actualReturnAt: row.rental.actualReturnAt?.toISOString() ?? null,
    closedAt: row.rental.closedAt?.toISOString() ?? null,
    abandonedReviewAt: row.rental.abandonedReviewAt?.toISOString() ?? null,
    depositAmount: row.rental.depositAmount,
    initialPayment: row.initialPayment
      ? {
          ...row.initialPayment,
          paidAt: row.initialPayment.paidAt?.toISOString() ?? null,
        }
      : null,
    currentIssuedContract: row.contract?.issuedAt
      ? {
          id: row.contract.id,
          version: row.contract.version,
          issuedAt: row.contract.issuedAt.toISOString(),
        }
      : null,
  };
}

export class RentalsService {
  constructor(private readonly repository: RentalsRepository) {}

  private async managerScope(actor: FacilityRentalActor, facilityId: string) {
    if (
      actor.role !== "FACILITY_MANAGER" ||
      !(await this.repository.managerAssignment(facilityId, actor.id))
    )
      throw new ForbiddenError(RENTAL_MESSAGES.facilityAccessDenied);
  }

  async facilityList(
    actor: FacilityRentalActor,
    facilityId: string,
    query: FacilityRentalListQuery,
  ): Promise<FacilityRentalPage> {
    await this.managerScope(actor, facilityId);
    const result = await this.repository.listForFacility(facilityId, query);
    return {
      items: result.items.map(facilityRentalDto),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async facilityDetail(
    actor: FacilityRentalActor,
    facilityId: string,
    rentalId: string,
  ): Promise<FacilityRentalItem> {
    await this.managerScope(actor, facilityId);
    const result = await this.repository.findForFacility(facilityId, rentalId);
    if (!result) throw new NotFoundError(RENTAL_MESSAGES.rentalNotFound);
    return facilityRentalDto(result);
  }

  async facilityPayments(
    actor: FacilityRentalActor,
    facilityId: string,
    rentalId: string,
    query: FacilityRentalHistoryQuery,
  ): Promise<FacilityRentalPaymentPage> {
    const rental = await this.facilityDetail(actor, facilityId, rentalId);
    const result = await this.repository.facilityPayments(rental.bookingId, rentalId, query);
    return {
      items: result.items.map((row) => ({
        ...row,
        source: row.source ?? "BOOKING",
        paidAt: row.paidAt?.toISOString() ?? null,
        refundedAt: row.refundedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        confirmedRefunds: [
          ...result.returnTransfers
            .filter((refund) => refund.paymentId === row.id)
            .map((refund) => ({
              id: refund.id,
              source: "RETURN" as const,
              amount: refund.amount,
              reference: refund.reference,
              confirmedAt: refund.confirmedAt.toISOString(),
            })),
          ...result.chargeTransfers.flatMap((refund) =>
            refund.paymentId === row.id && refund.confirmedAt
              ? [
                  {
                    id: refund.id,
                    source: "CHARGE" as const,
                    amount: refund.amount,
                    reference: refund.reference,
                    confirmedAt: refund.confirmedAt.toISOString(),
                  },
                ]
              : [],
          ),
        ],
      })),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async facilityRenewals(
    actor: FacilityRentalActor,
    facilityId: string,
    rentalId: string,
    query: FacilityRentalHistoryQuery,
  ): Promise<FacilityRentalRenewalPage> {
    await this.facilityDetail(actor, facilityId, rentalId);
    const result = await this.repository.facilityRenewals(rentalId, query);
    return {
      items: result.items.map(renewalDto),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async pageMine(userId: string, query: RentalPageQuery): Promise<RentalPage> {
    const rows = await this.repository.listPageByUserId(userId, query, query.view === "history");
    const pageRows = rows.slice(0, query.limit);
    const items = pageRows.map(toListItem);
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? { afterEndAt: last.cursorEndAt, afterId: last.rental.id }
          : null,
    };
  }

  async paymentsMine(rentalId: string, userId: string): Promise<RentalPaymentItem[]> {
    await this.getMine(rentalId, userId);
    const rows = await this.repository.listPaymentsByUserId(rentalId, userId);
    const refunds = await this.repository.listReturnRefundsByUserId(rentalId, userId);
    return rows.map((row) => ({
      id: row.id,
      paymentCode: row.paymentCode,
      provider: row.provider,
      status: row.status,
      totalAmount: row.totalAmount,
      currency: row.currency,
      returnRefunds: refunds
        .filter((refund) => refund.paymentId === row.id)
        .map((refund) => ({
          id: refund.id,
          amount: refund.amount,
          reference: refund.reference,
          confirmedAt: refund.confirmedAt.toISOString(),
          settlementId: refund.settlementId,
        })),
      refundAmount: row.refundAmount,
      refundReason: row.refundReason,
      paidAt: row.paidAt?.toISOString() ?? null,
      refundedAt: row.refundedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getMine(rentalId: string, userId: string) {
    const rental = await this.repository.findByIdAndUserId(rentalId, userId);
    if (!rental) throw new NotFoundError(RENTAL_MESSAGES.rentalNotFound);
    return rental;
  }
}
