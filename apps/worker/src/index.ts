import "./env";
import { db, queryClient } from "@metastorage/database";
import {
  BOOKING_EMAIL_MESSAGES,
  MAIL_QUEUE_NAME,
  type MailJobData,
} from "@metastorage/shared/mail";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { processMailJob } from "./mail/mail.job";
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
const emailWorker = new Worker<MailJobData>(
  MAIL_QUEUE_NAME,
  (job) => processMailJob(job.data, mailAdapter, mailPayloadSecret),
  { connection: redis },
);
emailWorker.on("failed", (job) => {
  console.error(`Mail job failed (${job?.id ?? "unknown"})`);
});
emailWorker.on("error", () => console.error("Mail worker error"));

const outbox = new OutboxService(new OutboxRepository(db), mailAdapter);
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

async function shutdown() {
  clearInterval(outboxTimer);
  await outboxRunning;
  await emailWorker.close();
  await redis.quit();
  await queryClient.end();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
