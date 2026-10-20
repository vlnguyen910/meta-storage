import {
  and,
  asc,
  bookingAccessAudit,
  bookingContracts,
  bookings,
  type Database,
  eq,
  exists,
  facilities,
  inArray,
  isNotNull,
  notificationOutbox,
  payments,
  rentals,
  returnRefunds,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import { bookingPaidAt, bookingReadFields } from "../bookings/bookings.projection";

export class GuestRentalAccessRepository {
  constructor(private readonly db: Database) {}

  async bookingByCode(code: string) {
    const [row] = await this.db
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        contactEmail: bookings.contactEmail,
        contactName: bookings.contactName,
        facilityId: bookings.facilityId,
        facilityName: facilities.name,
        unitTypeName: unitTypes.name,
        paidAt: bookingPaidAt,
      })
      .from(bookings)
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(
        and(
          eq(bookings.bookingCode, code),
          inArray(bookings.status, ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"]),
          exists(
            this.db
              .select({ id: payments.id })
              .from(payments)
              .where(
                and(
                  eq(payments.bookingId, bookings.id),
                  inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]),
                  isNotNull(payments.paidAt),
                ),
              ),
          ),
        ),
      );
    return row;
  }

  async recordLinkRequest(input: {
    bookingId: string;
    facilityId: string;
    bookingCode: string;
    paidAt: string;
    facilityName: string;
    unitTypeName: string;
    contactEmail: string;
    idempotencyKey: string;
    emailHash: string;
    ipHash: string;
    emailSubject: string;
    linkCreatedAt: Date;
    linkExpiresAt: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select({ id: bookings.id, contactEmail: bookings.contactEmail })
        .from(bookings)
        .where(eq(bookings.id, input.bookingId))
        .for("update");
      if (!booking) return false;
      const emailMatched = booking.contactEmail?.toLowerCase() === input.contactEmail.toLowerCase();
      const [audit] = await tx
        .insert(bookingAccessAudit)
        .values({
          bookingId: input.bookingId,
          idempotencyKey: input.idempotencyKey,
          action: emailMatched ? "GUEST_ACCESS_LINK_REQUESTED" : "GUEST_ACCESS_LINK_REJECTED",
          details: { emailHash: input.emailHash, ipHash: input.ipHash },
        })
        .onConflictDoNothing()
        .returning({ id: bookingAccessAudit.id });
      if (!audit) return true;
      if (!emailMatched) return false;
      await tx.insert(notificationOutbox).values({
        id: audit.id,
        eventKey: `booking:${input.bookingId}:tracking-link:${input.idempotencyKey}`,
        recipientKey: "customer",
        eventType: "BOOKING_CONFIRMED",
        bookingId: input.bookingId,
        facilityId: input.facilityId,
        recipientRole: "CUSTOMER",
        recipientEmail: booking.contactEmail ?? "",
        subject: input.emailSubject,
        body: "",
        bookingEmail: {
          bookingCode: input.bookingCode,
          facilityName: input.facilityName,
          unitTypeName: input.unitTypeName,
          paidAt: input.paidAt,
          kind: "TRACKING_LINK",
          deliveryId: audit.id,
          linkCreatedAt: input.linkCreatedAt.toISOString(),
          linkExpiresAt: input.linkExpiresAt.toISOString(),
        },
        mailExpiresAt: input.linkExpiresAt,
      });
      return true;
    });
  }

  rental(bookingId: string) {
    return this.db
      .select({
        rental: rentals,
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
        physicalUnit: storageUnits,
      })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(facilities, eq(facilities.id, rentals.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
      .where(eq(rentals.bookingId, bookingId));
  }

  payments(bookingId: string) {
    return this.db
      .select({
        id: payments.id,
        paymentCode: payments.paymentCode,
        status: payments.status,
        totalAmount: payments.totalAmount,
        currency: payments.currency,
        paidAt: payments.paidAt,
        refundAmount: payments.refundAmount,
        refundReason: payments.refundReason,
        refundedAt: payments.refundedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(bookings.id, bookingId))
      .orderBy(asc(payments.createdAt), asc(payments.id));
  }

  refunds(bookingId: string) {
    return this.db
      .select({
        id: returnRefunds.id,
        paymentId: returnRefunds.paymentId,
        amount: returnRefunds.amount,
        reference: returnRefunds.reference,
        confirmedAt: returnRefunds.confirmedAt,
        settlementId: returnRefunds.settlementId,
      })
      .from(returnRefunds)
      .innerJoin(payments, eq(payments.id, returnRefunds.paymentId))
      .where(eq(payments.bookingId, bookingId))
      .orderBy(asc(returnRefunds.confirmedAt), asc(returnRefunds.id));
  }

  issuedContracts(bookingId: string) {
    return this.db
      .select({
        id: bookingContracts.id,
        version: bookingContracts.version,
        filename: bookingContracts.filename,
        byteSize: bookingContracts.byteSize,
        issuedAt: bookingContracts.issuedAt,
      })
      .from(bookingContracts)
      .where(and(eq(bookingContracts.bookingId, bookingId), eq(bookingContracts.status, "ISSUED")))
      .orderBy(asc(bookingContracts.version));
  }

  async issuedContract(bookingId: string, contractId: string) {
    const [row] = await this.db
      .select({ id: bookingContracts.id, objectKey: bookingContracts.objectKey })
      .from(bookingContracts)
      .where(
        and(
          eq(bookingContracts.id, contractId),
          eq(bookingContracts.bookingId, bookingId),
          eq(bookingContracts.status, "ISSUED"),
        ),
      );
    return row;
  }
}
