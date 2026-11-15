import { describe, expect, mock, test } from "bun:test";
import { type MailJobData, MailJobKind } from "@metastorage/contracts/mail";
import type { notificationOutbox } from "@metastorage/database";
import { encryptMailPayload } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { MailService } from "../src/mail/mail.service";
import type { OutboxRepository } from "../src/notifications/outbox.repository";
import { OutboxService } from "../src/notifications/outbox.service";

const id = "11111111-1111-4111-8111-111111111111";
const secret = "worker-test-secret-at-least-32-characters";
const row = {
  id,
  eventType: "SUPPORT_UPDATED",
  subject: "Support",
  body: "Updated",
  recipientEmail: "customer@example.com",
  bookingEmail: null,
} as typeof notificationOutbox.$inferSelect;
const job: MailJobData = { kind: MailJobKind.NOTIFICATION, outboxId: id };
function setup() {
  const repository = {
    beginNotification: mock(async () => ({ kind: "SEND", row })),
    authorized: mock(async () => true),
    finish: mock(async () => {}),
    bookingDeliveryPayload: mock(async () => null),
    beginBooking: mock(async () => ({ kind: "SEND", id })),
    bookingSent: mock(async () => {}),
    claim: mock(async () => undefined as typeof row | undefined),
  };
  const queue = { getJob: mock(async () => undefined as unknown), add: mock(async () => {}) };
  const mail = new MailService(repository as unknown as OutboxRepository, {
    queue: queue as unknown as Queue<MailJobData>,
    secret,
    publicAppUrl: "https://example.com",
    qrTokenSecret: secret,
  });
  const adapter = { send: mock(async () => ({ providerMessageId: "provider-1" })) };
  return { mail, repository, queue, adapter };
}

describe("worker mail delivery", () => {
  test("outbox dispatch enqueues a reference without sending or copying recipient data to Redis", async () => {
    const { mail, repository, queue, adapter } = setup();
    repository.claim.mockResolvedValueOnce(row);
    await new OutboxService(repository as unknown as OutboxRepository, mail).dispatch();
    expect(queue.add.mock.calls[0]).toEqual([
      "notification",
      job,
      expect.objectContaining({ jobId: `notification-${id}`, attempts: 5 }),
    ]);
    expect(adapter.send).not.toHaveBeenCalled();
    expect(repository.finish).toHaveBeenCalledWith(row, "ENQUEUED", expect.any(Date), undefined);
  });
  test("existing active jobs are not added again; exhausted jobs require review", async () => {
    const { mail, queue } = setup();
    queue.getJob.mockResolvedValue({ getState: async () => "active" });
    expect(await mail.enqueue(row, new Date())).toEqual({ status: "ENQUEUED" });
    expect(queue.add).not.toHaveBeenCalled();
    queue.getJob.mockResolvedValue({ getState: async () => "failed" });
    expect(await mail.enqueue(row, new Date())).toEqual({ status: "REVIEW_REQUIRED" });
  });
  test("processor loads the durable row, renders HTML and acknowledges provider success", async () => {
    const { mail, repository, adapter } = setup();
    await mail.deliver(job, adapter);
    expect(adapter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: `notification-${id}`,
        recipientEmail: row.recipientEmail,
        html: expect.stringContaining("<!doctype html>"),
      }),
    );
    expect(repository.finish).toHaveBeenCalledWith(row, "SENT", expect.any(Date), "provider-1");
  });
  test("revoked access suppresses delivery", async () => {
    const { mail, repository, adapter } = setup();
    repository.authorized.mockResolvedValue(false);
    await mail.deliver(job, adapter);
    expect(adapter.send).not.toHaveBeenCalled();
    expect(repository.finish).toHaveBeenCalledWith(row, "SUPPRESSED", expect.any(Date));
  });
  test("provider failure escapes to BullMQ and is never acknowledged as SENT", async () => {
    const { mail, repository, adapter } = setup();
    adapter.send.mockRejectedValue(new Error("temporary provider failure"));
    await expect(mail.deliver(job, adapter)).rejects.toThrow("temporary provider failure");
    expect(repository.finish).not.toHaveBeenCalled();
    adapter.send.mockResolvedValue({ providerMessageId: "provider-1" });
    await mail.deliver(job, adapter);
    expect(adapter.send.mock.calls[0][0].deliveryId).toBe(adapter.send.mock.calls[1][0].deliveryId);
  });
  test("already acknowledged and suppressed rows never send again", async () => {
    const { mail, repository, adapter } = setup();
    repository.beginNotification.mockResolvedValue({
      kind: "DONE",
      providerMessageId: "original",
    } as never);
    expect(await mail.deliver(job, adapter)).toEqual({ providerMessageId: "original" });
    repository.beginNotification.mockResolvedValue({ kind: "STOP" } as never);
    await mail.deliver(job, adapter);
    expect(adapter.send).not.toHaveBeenCalled();
  });
  test("malformed and retired jobs stop without provider calls", async () => {
    const { mail, adapter } = setup();
    for (const data of [
      null,
      { kind: "UNKNOWN" },
      { kind: MailJobKind.NOTIFICATION, outboxId: "invalid" },
      { kind: MailJobKind.BOOKING_TRACKING_LINK },
    ]) {
      await expect(mail.deliver(data as MailJobData, adapter)).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
    }
    expect(adapter.send).not.toHaveBeenCalled();
  });
  test("booking delivery preserves encrypted payload, delivery ID and acknowledgement", async () => {
    const { mail, repository, adapter } = setup();
    const input = {
      deliveryId: id,
      recipientEmail: row.recipientEmail,
      bookingCode: "BK-1",
      facilityName: "Facility",
      unitTypeName: "Unit",
      trackingUrl: "https://example.com/reservation",
      qrUrl: "https://example.com/check-in",
    };
    await mail.deliver(
      {
        kind: MailJobKind.BOOKING_CONFIRMATION,
        deliveryId: id,
        payload: encryptMailPayload(JSON.stringify(input), secret, id),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      adapter,
    );
    expect(adapter.send).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: id, recipientEmail: row.recipientEmail }),
    );
    expect(repository.bookingSent).toHaveBeenCalledWith(id, "provider-1", expect.any(Date));
  });
});

describe("account mail jobs", () => {
  const input = {
    recipientEmail: "customer@example.test",
    name: '<img src=x onerror="alert(1)">',
    url: 'https://example.test/reset?token=private&callback="x"',
  };
  const makeJob = (kind: MailJobKind.VERIFY_EMAIL | MailJobKind.RESET_PASSWORD, values = input) => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    return {
      kind,
      deliveryId: id,
      expiresAt,
      payload: encryptMailPayload(
        JSON.stringify({ ...values, kind, deliveryId: id, expiresAt }),
        secret,
        id,
      ),
    };
  };
  test.each([MailJobKind.VERIFY_EMAIL, MailJobKind.RESET_PASSWORD] as const)(
    "%s decrypts and renders escaped HTML in the worker",
    async (kind) => {
      const { mail, adapter, repository } = setup();
      await mail.deliver(makeJob(kind), adapter);
      expect(repository.beginNotification).not.toHaveBeenCalled();
      const sent = adapter.send.mock.calls[0][0];
      expect(sent.recipientEmail).toBe(input.recipientEmail);
      expect(sent.html).toContain("&lt;img");
      expect(sent.html).not.toContain("<img");
      expect(sent.html).toContain("&amp;callback=&quot;x&quot;");
      expect(sent.text).toContain(input.url);
      expect(sent.subject).toContain(
        kind === MailJobKind.RESET_PASSWORD ? "Đặt lại mật khẩu" : "Xác minh email",
      );
    },
  );
  test("expired, tampered, kind-mismatched and unsafe URL jobs never reach the provider", async () => {
    const { mail, adapter } = setup();
    const valid = makeJob(MailJobKind.VERIFY_EMAIL);
    for (const job of [
      { ...valid, expiresAt: new Date(0).toISOString() },
      { ...valid, expiresAt: new Date(Date.now() + 120_000).toISOString() },
      { ...valid, kind: MailJobKind.RESET_PASSWORD as const },
      { ...valid, payload: "tampered" },
      makeJob(MailJobKind.VERIFY_EMAIL, { ...input, url: "javascript:alert(1)" }),
    ])
      await expect(mail.deliver(job, adapter)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(adapter.send).not.toHaveBeenCalled();
  });
  test("provider errors remain retryable by BullMQ", async () => {
    const { mail, adapter } = setup();
    adapter.send.mockRejectedValue(new Error("provider timeout"));
    await expect(mail.deliver(makeJob(MailJobKind.RESET_PASSWORD), adapter)).rejects.toThrow(
      "provider timeout",
    );
  });
});
