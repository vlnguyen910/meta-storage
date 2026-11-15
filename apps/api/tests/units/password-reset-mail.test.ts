import { expect, mock, test } from "bun:test";
import { AUTH_MAIL_TTL_SECONDS, type MailJobData, MailJobKind } from "@metastorage/contracts/mail";
import { decryptMailPayload } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import { MailProducer } from "../../src/common/mail/mail.service";

const secret = "auth-mail-test-secret-at-least-32-characters";
const input = {
  kind: MailJobKind.RESET_PASSWORD as const,
  recipientEmail: "customer@example.test",
  name: "Customer",
  url: "https://example.test/reset?token=private-token",
};
const setup = () => {
  const add = mock(async (..._args: unknown[]) => {});
  const queue = { add } as unknown as Queue<MailJobData>;
  const producer = new MailProducer();
  producer.connect(queue, secret);
  return { producer, queue, add };
};

test.each([MailJobKind.RESET_PASSWORD, MailJobKind.VERIFY_EMAIL] as const)(
  "%s queues only encrypted data with bounded retries and expiry",
  async (kind) => {
    const { producer, add } = setup();
    const before = Date.now();
    await producer.enqueue({ ...input, kind });
    const [name, data, options] = add.mock.calls[0] as [
      string,
      Exclude<MailJobData, { kind: MailJobKind.NOTIFICATION }>,
      { jobId: string; attempts: number },
    ];
    expect(name).toBe(kind);
    expect(data.kind).toBe(kind);
    expect(options.jobId).toBe(data.deliveryId);
    expect(options.attempts).toBe(5);
    expect(Date.parse(data.expiresAt)).toBeGreaterThanOrEqual(
      before + AUTH_MAIL_TTL_SECONDS * 1000,
    );
    expect(JSON.stringify(data)).not.toContain(input.url);
    expect(JSON.stringify(data)).not.toContain(input.recipientEmail);
    expect(JSON.parse(decryptMailPayload(data.payload, secret, data.deliveryId))).toEqual({
      ...input,
      kind,
      deliveryId: data.deliveryId,
      expiresAt: data.expiresAt,
    });
  },
);
test("re-enqueueing the same auth link has the same job ID; different link has a new ID", async () => {
  const { producer, add } = setup();
  await producer.enqueue(input);
  await producer.enqueue(input);
  await producer.enqueue({ ...input, url: `${input.url}-new` });
  const ids = add.mock.calls.map((call) => (call[2] as { jobId: string }).jobId);
  expect(ids[0]).toBe(ids[1]);
  expect(ids[0]).not.toBe(ids[2]);
});
test("enqueue failure propagates and shutdown releases only its own queue", async () => {
  const { producer, queue, add } = setup();
  add.mockRejectedValue(new Error("queue unavailable"));
  await expect(producer.enqueue(input)).rejects.toThrow("queue unavailable");
  producer.disconnect({} as Queue<MailJobData>);
  expect(await producer.enqueue(input).catch((error) => error.message)).toBe("queue unavailable");
  producer.disconnect(queue);
  await expect(producer.enqueue(input)).rejects.toThrow("Mail queue is not configured");
});

test("producer validates input before enqueueing to Redis", async () => {
  const { producer, add } = setup();
  for (const invalid of [
    { ...input, recipientEmail: "invalid" },
    { ...input, url: "javascript:alert(1)" },
  ])
    await expect(producer.enqueue(invalid)).rejects.toThrow();
  expect(add).not.toHaveBeenCalled();
});
