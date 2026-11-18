import { MAIL_QUEUE_NAME, type MailJobData } from "@metastorage/contracts/mail";
import "./env";
import { db, queryClient } from "@metastorage/database";
import { BOOKING_EMAIL_MESSAGES } from "@metastorage/shared/mail";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { MailService } from "./mail/mail.service";
import { ResendMailAdapter } from "./mail/resend.adapter";
import { OutboxRepository } from "./notifications/outbox.repository";
import { OutboxService } from "./notifications/outbox.service";

const mailPayloadSecret = process.env.BOOKING_MAGIC_LINK_SECRET ?? "";
if (mailPayloadSecret.length < 32) throw new Error(BOOKING_EMAIL_MESSAGES.payloadConfiguration);
if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
  throw new Error(BOOKING_EMAIL_MESSAGES.providerConfiguration);
const mailAdapter = new ResendMailAdapter({
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.RESEND_FROM_EMAIL,
});
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
redis.on("error", () => console.error("Mail worker Redis connection error"));
const outboxRepository = new OutboxRepository(db);
const mailQueue = new Queue<MailJobData>(MAIL_QUEUE_NAME, { connection: redis });
const mail = new MailService(outboxRepository, {
  queue: mailQueue,
  secret: mailPayloadSecret,
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
  qrTokenSecret: process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
});
const emailWorker = new Worker<MailJobData>(
  MAIL_QUEUE_NAME,
  (job) => mail.deliver(job.data, mailAdapter),
  { connection: redis },
);
emailWorker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      event: "mail_job_failed",
      jobId: job?.id ?? "unknown",
      kind: job?.data.kind ?? "unknown",
      attemptsMade: job?.attemptsMade,
      attempts: job?.opts.attempts,
      failedReason: error.message,
    }),
  );
});
emailWorker.on("error", () => console.error("Mail worker error"));

const outbox = new OutboxService(outboxRepository, mail);
let outboxRunning: Promise<unknown> | undefined;
const dispatchOutbox = () => {
  if (outboxRunning) return;
  outboxRunning = outbox
    .dispatch()
    .catch(() => console.error("Notification outbox dispatch failed"))
    .finally(() => {
      outboxRunning = undefined;
    });
};
dispatchOutbox();
const outboxTimer = setInterval(dispatchOutbox, 5000);
outboxTimer.unref();

let reminderRunning: Promise<unknown> | undefined;
const remindExpiringRentals = () => {
  if (reminderRunning) return;
  reminderRunning = outbox
    .remindExpiringRentals()
    .catch(() => console.error("Rental expiry reminder scheduling failed"))
    .finally(() => {
      reminderRunning = undefined;
    });
};
remindExpiringRentals();
const reminderTimer = setInterval(remindExpiringRentals, 60_000);
reminderTimer.unref();

async function shutdown() {
  clearInterval(outboxTimer);
  clearInterval(reminderTimer);
  await reminderRunning;
  await outboxRunning;
  await emailWorker.close();
  await mailQueue.close();
  await redis.quit();
  await queryClient.end();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
