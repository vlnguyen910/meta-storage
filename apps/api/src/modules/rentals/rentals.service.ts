import type { RentalPage, RentalPageQuery, RentalPaymentItem } from "@metastorage/contracts";
import { NotFoundError } from "../../common/errors/app-error";
import { RENTAL_MESSAGES } from "./rentals.messages";
import { type RentalsRepository, toListItem } from "./rentals.repository";

export class RentalsService {
  constructor(private readonly repository: RentalsRepository) {}

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
