import { expect, spyOn, test } from "bun:test";
import { AUTH_MAIL_TTL_SECONDS, MailJobKind } from "@metastorage/contracts/mail";

import { mailProducer } from "../../src/common/mail/mail.service";
import { auth } from "../../src/modules/auth/auth";

test("Better Auth callbacks enqueue the shared account mail jobs and retain token TTL", async () => {
  const enqueue = spyOn(mailProducer, "enqueue").mockResolvedValue(undefined);
  try {
    const user = {
      id: "user",
      email: "customer@example.test",
      name: "Customer",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const url = "http://localhost:4000/api/auth/verify-email?token=token";
    await auth.options.emailVerification?.sendVerificationEmail?.({ user, url, token: "token" });
    expect(enqueue).toHaveBeenLastCalledWith({
      kind: MailJobKind.VERIFY_EMAIL,
      recipientEmail: user.email,
      name: user.name,
      url,
    });
    await auth.options.emailAndPassword?.sendResetPassword?.({ user, url, token: "token" });
    expect(enqueue).toHaveBeenLastCalledWith({
      kind: MailJobKind.RESET_PASSWORD,
      recipientEmail: user.email,
      name: user.name,
      url,
    });
    expect(auth.options.emailVerification?.expiresIn).toBe(AUTH_MAIL_TTL_SECONDS);
    expect(auth.options.emailAndPassword?.resetPasswordTokenExpiresIn).toBe(AUTH_MAIL_TTL_SECONDS);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  } finally {
    enqueue.mockRestore();
  }
});
