import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { env } from "../../src/config/env";
import { auth } from "../../src/modules/auth/auth";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { AuthService } from "../../src/modules/auth/auth.service";

const app = Fastify();
const input = {
  name: "Customer",
  email: "signup@example.test",
  password: "SignupTest123!",
  confirmPassword: "SignupTest123!",
  callbackTarget: "web",
};
const previous = { key: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL };
const signup = spyOn(auth.api, "signUpEmail");
const available = spyOn(AuthService.prototype, "assertEmailCanRegister");

describe("customer signup phone", () => {
  beforeAll(async () => {
    signup.mockResolvedValue({} as never);
    available.mockResolvedValue(undefined);
    env.RESEND_API_KEY = "re_signup_test";
    env.RESEND_FROM_EMAIL = "test@example.test";
    setupErrorHandler(app);
    await app.register(authRoutes, { prefix: "/api/auth" });
  });
  afterAll(async () => {
    signup.mockRestore();
    available.mockRestore();
    env.RESEND_API_KEY = previous.key;
    env.RESEND_FROM_EMAIL = previous.from;
    await app.close();
  });
  test.each([undefined, "0901234567"])("accepts registration with phone %s", async (phone) => {
    signup.mockClear();
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/customer-sign-up",
      payload: { ...input, ...(phone ? { phone } : {}) },
    });
    expect(response.statusCode).toBe(202);
    expect(signup).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ email: input.email, phone }) }),
    );
  });
  test("rejects an explicitly invalid empty phone", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/customer-sign-up",
      payload: { ...input, phone: "" },
    });
    expect(response.statusCode).toBe(400);
  });
});
