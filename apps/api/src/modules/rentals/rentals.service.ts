import type {
  FacilityRentalHistoryQuery,
  FacilityRentalItem,
  FacilityRentalListQuery,
  FacilityRentalPage,
  FacilityRentalPaymentPage,
  RentalPage,
  RentalPageQuery,
  RentalPaymentItem,
} from "@metastorage/contracts";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { RENTAL_MESSAGES as M } from "./rentals.messages";
import { type RentalsRepository, toListItem } from "./rentals.repository";
import type { FacilityRentalActor, FacilityRentalRow } from "./rentals.types";

function facilityRentalDto(row: FacilityRentalRow): FacilityRentalItem {
  return {
    id: row.rental.id,
    bookingId: row.booking.id,
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
  };
}
export class RentalsService {
  constructor(private readonly repository: RentalsRepository) {}
  private async managerScope(actor: FacilityRentalActor, facilityId: string) {
    if (
      actor.role !== "FACILITY_MANAGER" ||
      !(await this.repository.managerAssignment(facilityId, actor.id))
    )
      throw new ForbiddenError(M.facilityAccessDenied);
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
  async facilityDetail(actor: FacilityRentalActor, facilityId: string, id: string) {
    await this.managerScope(actor, facilityId);
    const row = await this.repository.findForFacility(facilityId, id);
    if (!row) throw new NotFoundError(M.rentalNotFound);
    return facilityRentalDto(row);
  }
  async facilityPayments(
    actor: FacilityRentalActor,
    facilityId: string,
    id: string,
    query: FacilityRentalHistoryQuery,
  ): Promise<FacilityRentalPaymentPage> {
    const rental = await this.facilityDetail(actor, facilityId, id);
    const result = await this.repository.facilityPayments(rental.bookingId, query);
    return {
      items: result.items.map((p) => ({
        id: p.id,
        paymentCode: p.paymentCode,
        status: p.status,
        amount: p.totalAmount,
        currency: p.currency,
        paidAt: p.paidAt?.toISOString() ?? null,
        refundAmount: p.refundAmount,
        refundReason: p.refundReason,
        refundedAt: p.refundedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async pageMine(userId: string, query: RentalPageQuery): Promise<RentalPage> {
    const rows = await this.repository.listPageByUserId(userId, query, query.view === "history");
    const page = rows.slice(0, query.limit),
      last = page.at(-1);
    return {
      items: page.map(toListItem),
      nextCursor:
        rows.length > query.limit && last
          ? { afterEndAt: last.cursorEndAt, afterId: last.rental.id }
          : null,
    };
  }
  async getMine(id: string, userId: string) {
    const rental = await this.repository.findByIdAndUserId(id, userId);
    if (!rental) throw new NotFoundError(M.rentalNotFound);
    return rental;
  }
  async paymentsMine(id: string, userId: string): Promise<RentalPaymentItem[]> {
    await this.getMine(id, userId);
    return (await this.repository.listPaymentsByUserId(id, userId)).map(({ payment: p }) => ({
      id: p.id,
      paymentCode: p.paymentCode,
      provider: p.provider,
      status: p.status,
      totalAmount: p.totalAmount,
      currency: p.currency,
      paidAt: p.paidAt?.toISOString() ?? null,
      refundAmount: p.refundAmount,
      refundReason: p.refundReason,
      refundedAt: p.refundedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
