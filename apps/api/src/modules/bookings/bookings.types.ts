import type { Booking, Database, Facility, Payment, UnitType } from "@metastorage/database";
import type { MailJobData } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import type Redis from "ioredis";

export type BookingTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type BookingQueryExecutor = Database | BookingTransaction;
export type CustomerBookingQueryRow = {
  booking: Pick<
    Booking,
    | "id"
    | "bookingCode"
    | "status"
    | "rentalEndAt"
    | "requestedMonths"
    | "monthlyRateSnapshot"
    | "rentalFeeAmount"
    | "depositAmount"
    | "totalAmount"
    | "createdAt"
  >;
  facility: Pick<Facility, "id" | "name" | "address">;
  unitType: Pick<UnitType, "id" | "name" | "sizeLabel">;
  checkInSlotStart: Date;
  checkInSlotEnd: Date;
  latestPayment: Pick<Payment, "status" | "paidAt"> | null;
  assignedUnit: { code: string | null; assignedAt: Date | null } | null;
  cursorCreatedAt: string;
};

export type BookingCancellationAccess = {
  userId?: string;
  tokenHash?: string;
};

export type BookingReadRecord = Booking & {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  checkInSlotStart: Date;
  checkInSlotEnd: Date;
  paidAt: Date | null;
};

export interface BookingEmailConfiguration {
  publicAppUrl: string;
  magicLinkSecret: string;
  qrTokenSecret: string;
  onEnqueueFailure?: (bookingId: string) => void;
}

export type BookingMailDependencies = {
  redis: Redis;
  queue: Queue<MailJobData>;
  config: BookingEmailConfiguration;
};
