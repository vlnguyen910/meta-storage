import { expect, test } from "bun:test";
import { ResendMailer } from "../../src/common/adapters/mailer/resend.adapter";
import { RESEND_MESSAGES } from "../../src/common/adapters/mailer/resend.messages";

test("reset mail escapes names and URL attributes before sending to the provider", async () => {
  let body = "";
  const mail = new ResendMailer({
    apiKey: "test-key",
    fromEmail: "test@example.test",
    fetcher: (async (_url, init) => {
      body = String(init?.body);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({ id: "mail-id" });
    }) as typeof fetch,
  });
  await mail.sendPasswordResetEmail({
    to: "customer@example.test",
    name: '<img src=x onerror="alert(1)">',
    resetUrl: 'https://example.test/reset?token=a&callback="b"',
  });
  const data = JSON.parse(body);
  expect(data.to).toEqual(["customer@example.test"]);
  expect(data.html).toContain("&lt;img");
  expect(data.html).not.toContain("<img");
  expect(data.html).toContain("&amp;callback=&quot;b&quot;");
});

test("reset mail surfaces provider failure instead of reporting successful delivery", async () => {
  const mail = new ResendMailer({
    apiKey: "test-key",
    fromEmail: "test@example.test",
    fetcher: (async () => new Response(null, { status: 503 })) as typeof fetch,
  });
  await expect(
    mail.sendPasswordResetEmail({
      to: "customer@example.test",
      name: "Customer",
      resetUrl: "https://example.test/reset",
    }),
  ).rejects.toThrow(RESEND_MESSAGES.resetEmailRejected);
});
