import { createHmac } from "node:crypto";
import type { RentalDetail } from "@metastorage/contracts";
import { BOOKING_ACCESS, bookingSessionKey } from "@metastorage/shared/booking-access";
import type Redis from "ioredis";
import { AppError, NotFoundError } from "../../common/errors/app-error";
import type { RedisService } from "../../common/redis/redis.service";
import { env } from "../../config/env";
import { CloudinaryContractStorage } from "../contracts/cloudinary-contract.storage";
import type { ContractStorage } from "../contracts/contracts.types";
import { GUEST_RENTAL_ACCESS_MESSAGES as messages } from "./guest-rental-access.messages";
import type { GuestRentalAccessRepository } from "./guest-rental-access.repository";
import type { GuestIssuedContract, GuestRentalPaymentItem } from "./guest-rental-access.types";

type GuestSession = { bookingId: string; bookingCode: string; expiresAt: string };
export class GuestRentalAccessService {
  constructor(
    private readonly repository: GuestRentalAccessRepository,
    private readonly redis: Redis,
    private readonly redisService: RedisService,
    private readonly contractStorage: ContractStorage = new CloudinaryContractStorage(),
  ) {}

  private async session(token: string | undefined, bookingCode: string): Promise<GuestSession> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AppError(messages.accessInvalid, 401);
    let raw: string | null;
    try {
      raw = await this.redis.get(bookingSessionKey(token));
    } catch {
      throw new AppError(messages.accessUnavailable, 503);
    }
    if (!raw) throw new AppError(messages.accessInvalid, 401);
    let session: GuestSession;
    try {
      session = JSON.parse(raw) as GuestSession;
    } catch {
      throw new AppError(messages.accessInvalid, 401);
    }
    if (
      !session.bookingId ||
      session.bookingCode !== bookingCode ||
      !(Date.parse(session.expiresAt) > Date.now())
    )
      throw new AppError(messages.accessInvalid, 401);
    return session;
  }

  async requestLink(
    input: { bookingCode: string; email: string; idempotencyKey: string },
    ip: string,
  ) {
    const ipHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`guest-access-ip:${ip}`)
      .digest("hex");
    const bookingHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`guest-access-booking:${input.bookingCode.trim().toUpperCase()}`)
      .digest("hex");
    const [ipCount, bookingCount] = await Promise.all([
      this.redisService.incrementWithExpiry(
        `booking:rate:resend:ip:${ipHash}`,
        BOOKING_ACCESS.resendRateWindow,
      ),
      this.redisService.incrementWithExpiry(
        `booking:rate:resend:booking:${bookingHash}`,
        BOOKING_ACCESS.resendRateWindow,
      ),
    ]);
    if (
      ipCount > BOOKING_ACCESS.resendPerIpLimit ||
      bookingCount > BOOKING_ACCESS.resendPerBookingLimit
    )
      return { message: messages.accessLinkRequested };

    const booking = await this.repository.bookingByCode(input.bookingCode.trim().toUpperCase());
    if (!booking?.contactEmail || !booking.bookingCode || !booking.paidAt)
      return { message: messages.accessLinkRequested };
    const emailHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`guest-access-email:${input.email.trim().toLowerCase()}`)
      .digest("hex");
    const linkCreatedAt = new Date();
    const linkExpiresAt = new Date(linkCreatedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000);
    await this.repository.recordLinkRequest({
      bookingId: booking.id,
      facilityId: booking.facilityId,
      bookingCode: booking.bookingCode,
      paidAt: booking.paidAt?.toISOString() ?? "",
      facilityName: booking.facilityName,
      unitTypeName: booking.unitTypeName,
      contactEmail: input.email.trim(),
      idempotencyKey: input.idempotencyKey,
      emailHash,
      ipHash,
      emailSubject: messages.accessLinkEmailSubject,
      linkCreatedAt,
      linkExpiresAt,
    });
    return { message: messages.accessLinkRequested };
  }

  async rental(bookingCode: string, token?: string): Promise<RentalDetail> {
    const session = await this.session(token, bookingCode);
    const [row] = await this.repository.rental(session.bookingId);
    if (!row) throw new NotFoundError(messages.rentalNotFound);
    const item: RentalDetail = {
      id: row.rental.id,
      bookingId: row.booking.id,
      bookingCode: row.booking.bookingCode ?? row.booking.id.slice(0, 8).toUpperCase(),
      facility: {
        id: row.facility.id,
        name: row.facility.name,
        address: row.facility.address,
      },
      unitType: {
        id: row.unitType.id,
        name: row.unitType.name,
        sizeLabel: row.unitType.sizeLabel,
      },
      physicalUnit: row.physicalUnit
        ? { id: row.physicalUnit.id, code: row.physicalUnit.code }
        : null,
      startAt: row.rental.startAt.toISOString(),
      expectedEndAt: row.rental.expectedEndAt.toISOString(),
      status: row.rental.status as RentalDetail["status"],
      bookingStatus: row.booking.status as RentalDetail["bookingStatus"],
      actions: { canCancel: false, canReschedule: false, note: messages.noRentalActions },
      actualReturnAt: row.rental.actualReturnAt?.toISOString() ?? null,
      closedAt: row.rental.closedAt?.toISOString() ?? null,
      depositAmount: row.rental.depositAmount,
      checkInSlotStart: row.booking.checkInSlotStart.toISOString(),
      checkInSlotEnd: row.booking.checkInSlotEnd?.toISOString() ?? null,
      timeline: [
        {
          label: messages.bookingConfirmed,
          status: "DONE",
          at: row.booking.paidAt?.toISOString() ?? null,
        },
        {
          label: messages.checkIn,
          status: row.rental.status === "ACTIVE" ? "CURRENT" : "DONE",
          at: row.rental.startAt.toISOString(),
        },
        {
          label: messages.return,
          status: row.rental.closedAt ? "DONE" : "UPCOMING",
          at: row.rental.expectedEndAt.toISOString(),
        },
      ],
    };
    return item;
  }

  async payments(bookingCode: string, token?: string): Promise<GuestRentalPaymentItem[]> {
    const session = await this.session(token, bookingCode);
    const rentalRows = await this.repository.rental(session.bookingId);
    if (!rentalRows.length) throw new NotFoundError(messages.rentalNotFound);
    const [payments, refunds] = await Promise.all([
      this.repository.payments(session.bookingId),
      this.repository.refunds(session.bookingId),
    ]);
    return payments.map((payment) => ({
      ...payment,
      paidAt: payment.paidAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      returnRefunds: refunds
        .filter((refund) => refund.paymentId === payment.id)
        .map((refund) => ({
          id: refund.id,
          amount: refund.amount,
          reference: refund.reference,
          confirmedAt: refund.confirmedAt.toISOString(),
          settlementId: refund.settlementId,
        })),
    }));
  }

  async contracts(bookingCode: string, token?: string): Promise<GuestIssuedContract[]> {
    const session = await this.session(token, bookingCode);
    const rows = await this.repository.issuedContracts(session.bookingId);
    return rows.map((row) => ({ ...row, issuedAt: row.issuedAt?.toISOString() ?? null }));
  }

  async contractPdf(bookingCode: string, contractId: string, token?: string) {
    const session = await this.session(token, bookingCode);
    const contract = await this.repository.issuedContract(session.bookingId, contractId);
    if (!contract) throw new NotFoundError(messages.contractNotFound);
    return { id: contract.id, bytes: await this.contractStorage.get(contract.objectKey) };
  }
}
