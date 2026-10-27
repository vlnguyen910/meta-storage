import type { notificationOutbox } from "@metastorage/database";
import type { MailJobData } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
export interface BookingMailOptions {
  redis: Redis;
  queue: Queue<MailJobData>;
  secret: string;
  qrTokenSecret: string;
  publicAppUrl: string;
}
export type BookingMailRow = typeof notificationOutbox.$inferSelect;
