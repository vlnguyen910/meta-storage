import type { Booking, Database } from "@metastorage/database";
import type { MailJobData } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import type Redis from "ioredis";

export type BookingTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type BookingQueryExecutor = Database | BookingTransaction;

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
