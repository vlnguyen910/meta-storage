import { expect, test } from "bun:test";
import type { Database, notificationOutbox } from "@metastorage/database";
import { OutboxRepository } from "../src/notifications/outbox.repository";

test("expiry delivery suppresses renewed, closed and changed-recipient reminders", async () => {
  const endAt = new Date("2026-12-01T00:00:00Z");
  const row = {
    eventType: "UPCOMING_EXPIRY",
    reservationId: "reservation",
    recipientUserId: "customer",
    recipientEmail: "customer@example.com",
    eventKey: `rental:rental:expiry:${endAt.toISOString()}`,
  } as typeof notificationOutbox.$inferSelect;
  let results: unknown[] = [];
  const query = { innerJoin: () => query, where: async () => results };
  const db = { select: () => ({ from: () => query }) } as unknown as Database;
  const repository = new OutboxRepository(db);
  const now = new Date("2026-11-25T00:00:00Z");
  expect(await repository.authorized(row, now)).toBe(false);
  results = [{ rental: { id: "rental", endAt }, email: row.recipientEmail }];
  expect(await repository.authorized(row, now)).toBe(true);
  results = [
    { rental: { id: "rental", endAt: new Date("2027-01-01") }, email: row.recipientEmail },
  ];
  expect(await repository.authorized(row, now)).toBe(false);
  results = [{ rental: { id: "rental", endAt }, email: "new@example.com" }];
  expect(await repository.authorized(row, now)).toBe(false);
});
