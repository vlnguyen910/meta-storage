import "./env";
import { db, queryClient } from "@metastorage/database";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { sendPendingBookingConfirmations } from "./booking-confirmation";
import { BOOKING_EMAIL_MESSAGES } from "./booking-email.messages";
import { MockMailAdapter } from "./mail-adapter";
import { ResendMailAdapter } from "./resend-mail-adapter";

const emailQueueName = "booking-confirmation-email";
const publicAppUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
const magicLinkSecret = process.env.BOOKING_MAGIC_LINK_SECRET ?? "";
const qrTokenSecret = process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret";
const mailProvider = process.env.MAIL_PROVIDER ?? (process.env.RESEND_API_KEY ? "resend" : "mock");
if (magicLinkSecret.length < 32 || !["https:", "http:"].includes(new URL(publicAppUrl).protocol))
  throw new Error(BOOKING_EMAIL_MESSAGES.accessConfiguration);
if (
  !["resend", "mock"].includes(mailProvider) ||
  (process.env.NODE_ENV === "production" && mailProvider !== "resend")
)
  throw new Error(BOOKING_EMAIL_MESSAGES.providerConfiguration);
if (mailProvider === "resend" && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL))
  throw new Error(BOOKING_EMAIL_MESSAGES.providerConfiguration);
const mailAdapter =
  mailProvider === "resend"
    ? new ResendMailAdapter({
        apiKey: process.env.RESEND_API_KEY ?? "",
        fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
      })
    : new MockMailAdapter();
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
      publicAppUrl,
      magicLinkSecret,
      qrTokenSecret,
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
