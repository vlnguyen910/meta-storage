import { randomUUID } from "node:crypto";
import { and, bookingConfirmationEmails, eq, isNotNull, lte } from "@metastorage/database";
import {
  BOOKING_EMAIL_MESSAGES,
  type BookingConfirmationEmailInput,
  decryptMailPayload,
} from "@metastorage/shared/mail";
import { sendBookingConfirmationEmail } from "./mail.service";
import type { BookingConfirmationDependencies } from "./mail.types";

const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 60;
const renewScript =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('EXPIRE', KEYS[1], ARGV[2]); end; return 0";
const releaseScript =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]); end; return 0";

export async function sendPendingBookingConfirmations(
  deps: BookingConfirmationDependencies,
): Promise<{ processed: number }> {
  const candidates = await deps.db
    .select({ id: bookingConfirmationEmails.id })
    .from(bookingConfirmationEmails)
    .where(
      and(
        eq(bookingConfirmationEmails.status, "PENDING"),
        isNotNull(bookingConfirmationEmails.payload),
        lte(bookingConfirmationEmails.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(bookingConfirmationEmails.createdAt)
    .limit(20);
  let processed = 0;
  for (const candidate of candidates) {
    const leaseKey = `booking:email-lock:${candidate.id}`;
    const owner = randomUUID();
    if ((await deps.redis.set(leaseKey, owner, "EX", LEASE_SECONDS, "NX")) !== "OK") continue;
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      void deps.redis
        .eval(renewScript, 1, leaseKey, owner, LEASE_SECONDS)
        .then((result) => {
          if (Number(result) !== 1) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        });
    }, 10_000);
    heartbeat.unref();
    try {
      const row = await deps.db.transaction(async (tx) => {
        const [current] = await tx
          .select({
            email: bookingConfirmationEmails,
          })
          .from(bookingConfirmationEmails)
          .where(
            and(
              eq(bookingConfirmationEmails.id, candidate.id),
              eq(bookingConfirmationEmails.status, "PENDING"),
              isNotNull(bookingConfirmationEmails.payload),
            ),
          )
          .for("update", { of: bookingConfirmationEmails });
        if (!current) return null;
        const expired = !current.email.expiresAt || current.email.expiresAt.getTime() <= Date.now();
        if (current.email.attempts >= MAX_ATTEMPTS || expired) {
          await tx
            .update(bookingConfirmationEmails)
            .set({
              status: "FAILED",
              lastError: expired
                ? BOOKING_EMAIL_MESSAGES.accessExpired
                : BOOKING_EMAIL_MESSAGES.sendFailed,
              updatedAt: new Date(),
            })
            .where(eq(bookingConfirmationEmails.id, candidate.id));
          return null;
        }
        const attempt = current.email.attempts + 1;
        await tx
          .update(bookingConfirmationEmails)
          .set({ attempts: attempt, updatedAt: new Date() })
          .where(eq(bookingConfirmationEmails.id, candidate.id));
        return { ...current, attempt };
      });
      if (!row) continue;
      processed++;
      const updateCondition = and(
        eq(bookingConfirmationEmails.id, candidate.id),
        eq(bookingConfirmationEmails.status, "PENDING"),
        eq(bookingConfirmationEmails.attempts, row.attempt),
      );
      try {
        const input = JSON.parse(
          decryptMailPayload(row.email.payload ?? "", deps.mailPayloadSecret, candidate.id),
        ) as BookingConfirmationEmailInput;
        if (
          leaseLost ||
          Number(await deps.redis.eval(renewScript, 1, leaseKey, owner, LEASE_SECONDS)) !== 1
        )
          continue;
        const sent = await sendBookingConfirmationEmail(deps.mailAdapter, input);
        if (
          leaseLost ||
          Number(await deps.redis.eval(renewScript, 1, leaseKey, owner, LEASE_SECONDS)) !== 1
        )
          continue;
        await deps.db
          .update(bookingConfirmationEmails)
          .set({
            status: "SENT",
            providerMessageId: sent.providerMessageId,
            sentAt: new Date(),
            updatedAt: new Date(),
            lastError: null,
          })
          .where(updateCondition);
      } catch {
        if (
          !leaseLost &&
          Number(await deps.redis.eval(renewScript, 1, leaseKey, owner, LEASE_SECONDS)) === 1
        ) {
          await deps.db
            .update(bookingConfirmationEmails)
            .set({
              status: row.attempt >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
              lastError: BOOKING_EMAIL_MESSAGES.sendFailed,
              updatedAt: new Date(),
            })
            .where(updateCondition);
        }
      }
    } finally {
      clearInterval(heartbeat);
      await deps.redis.eval(releaseScript, 1, leaseKey, owner).catch(() => undefined);
    }
  }
  return { processed };
}
