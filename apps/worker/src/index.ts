import "./env";
import { db, queryClient } from "@metastorage/database";
import { BOOKING_EMAIL_MESSAGES } from "@metastorage/shared/mail";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { sendPendingBookingConfirmations } from "./mail/mail.job";
import { ResendMailAdapter } from "./mail/resend.adapter";

const emailQueueName = "booking-confirmation-email";
const mailPayloadSecret = process.env.BOOKING_MAGIC_LINK_SECRET ?? "";
if (mailPayloadSecret.length < 32) throw new Error(BOOKING_EMAIL_MESSAGES.payloadConfiguration);
if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
  throw new Error(BOOKING_EMAIL_MESSAGES.providerConfiguration);
const mailAdapter = new ResendMailAdapter({
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.RESEND_FROM_EMAIL,
});
// Queue connections can retry indefinitely; delivery commands must fail quickly.
const deliveryRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  commandTimeout: 2000,
  enableOfflineQueue: false,
  lazyConnect: true,
  connectTimeout: 5000,
});
await deliveryRedis.connect();
await deliveryRedis.ping();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const emailQueue = new Queue(emailQueueName, { connection: redis });

const emailWorker = new Worker(
  emailQueueName,
  () =>
    sendPendingBookingConfirmations({
      db,
      redis: deliveryRedis,
      mailAdapter,
      mailPayloadSecret,
    }),
  { connection: redis },
);
emailWorker.on("failed", (job) => {
  console.error(`Booking email job failed (${job?.id ?? "unknown"})`);
});

await emailQueue.upsertJobScheduler(
  "booking-confirmation-email-sweep",
  { every: 10_000 },
  { name: "send-booking-confirmation", data: {} },
);

async function shutdown() {
  await emailWorker.close();
  await emailQueue.close();
  await deliveryRedis.quit();
  await redis.quit();
  await queryClient.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
