import { createHmac, randomUUID } from "node:crypto";
import {
  and,
  bookingConfirmationEmails,
  bookings,
  eq,
  facilities,
  inArray,
  lte,
  unitTypes,
} from "@metastorage/database";
import type { BookingConfirmationDependencies } from "./booking-confirmation.types";
import { BOOKING_EMAIL_MESSAGES } from "./booking-email.messages";
import { createBookingTrackingLink } from "./booking-tracking-link";

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
            bookingId: bookings.id,
            bookingCode: bookings.bookingCode,
            facilityName: facilities.name,
            unitTypeName: unitTypes.name,
          })
          .from(bookingConfirmationEmails)
          .innerJoin(bookings, eq(bookings.id, bookingConfirmationEmails.bookingId))
          .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
          .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
          .where(
            and(
              eq(bookingConfirmationEmails.id, candidate.id),
              eq(bookingConfirmationEmails.status, "PENDING"),
              inArray(bookings.status, ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"]),
            ),
          )
          .for("update", { of: bookingConfirmationEmails });
        if (!current) return null;
        if (current.email.attempts >= MAX_ATTEMPTS) {
          await tx
            .update(bookingConfirmationEmails)
            .set({
              status: "FAILED",
              lastError: BOOKING_EMAIL_MESSAGES.sendFailed,
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
        const link = await createBookingTrackingLink(deps.redis, {
          deliveryId: candidate.id,
          bookingId: row.bookingId,
          secret: deps.magicLinkSecret,
          publicAppUrl: deps.publicAppUrl,
        });
        if (
          leaseLost ||
          Number(await deps.redis.eval(renewScript, 1, leaseKey, owner, LEASE_SECONDS)) !== 1
        )
          continue;
        const sent = await deps.mailAdapter.sendBookingConfirmation({
          deliveryId: candidate.id,
          recipientEmail: row.email.recipientEmail,
          bookingCode: row.bookingCode,
          facilityName: row.facilityName,
          unitTypeName: row.unitTypeName,
          trackingUrl: link.trackingUrl,
          qrUrl: `${new URL("/check-in", deps.publicAppUrl)}?token=${createHmac("sha256", deps.qrTokenSecret).update(row.bookingId).digest("hex")}`,
        });
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
