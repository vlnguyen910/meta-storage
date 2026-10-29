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
} from "@metastorage/contracts";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";
import { RENTAL_MESSAGES as M } from "./rentals.messages";
import type { RentalsRepository } from "./rentals.repository";
import type { RentalActor, RentalWithDetails } from "./rentals.types";

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
  };
}
export class RentalsService {
  constructor(
    private readonly repository: RentalsRepository,
    private readonly facilityAssignments: FacilityAssignmentsService,
  ) {}
  async requireAppointmentContext(tx: TaskTransaction, rentalId: string, customerId: string) {
    const context = await this.repository.findAppointmentContext(tx, rentalId, customerId);
    if (!context) throw new NotFoundError(M.rentalNotFound);
    if (context.rental.status !== "ACTIVE") throw new ConflictError(M.rentalNotActive);
    return context;
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
    );
    return {
      items: result.items.map((payment) => ({
        id: payment.id,
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
    status: row.rental.status,
    bookingStatus: row.booking.status,
    actions: { canCancel: false, canReschedule: false, note: M.readOnly },
  };
}
