import { CustomerSignUpInputSchema } from "@metastorage/contracts";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import { AppError, ConflictError, UnauthorizedError } from "../../common/errors/app-error";
import { ERROR_MESSAGES } from "../../common/errors/error.messages";
import { errorResponse, successResponse } from "../../common/response/api-response";
import { env } from "../../config/env";
import { auth } from "./auth";
import { requireAuth } from "./auth.guard";
import { AUTH_MESSAGES } from "./auth.messages";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { getCustomerSignupCallbackUrl } from "./customer-signup.callback";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AuthService(new AuthRepository(fastify.db));

  fastify.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    // requireAuth guarantees that the request has an authenticated User.
    if (!request.user) throw new UnauthorizedError(AUTH_MESSAGES.loginRequired);
    return reply.send(successResponse(await service.getSessionUser(request.user.id)));
  });

  fastify.post("/customer-sign-up", async (request, reply) => {
    const input = CustomerSignUpInputSchema.parse(request.body);
    await service.assertEmailCanRegister(input.email);

    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      throw new AppError(
        AUTH_MESSAGES.customerSignupEmailDeliveryUnavailable,
        503,
        "EMAIL_DELIVERY_UNAVAILABLE",
      );
    }

    const callbackURL = getCustomerSignupCallbackUrl(
      input.callbackTarget,
      env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
    );

    if (!callbackURL) {
      throw new Error(AUTH_MESSAGES.noTrustedWebOriginForEmailVerification);
    }

    try {
      await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          phone: input.phone,
          callbackURL,
        },
        headers: fromNodeHeaders(request.headers),
      });
    } catch (error) {
      if (isEmailConflict(error)) {
        throw new ConflictError(AUTH_MESSAGES.accountRecovery);
      }
      throw error;
    }

    return reply.status(202).send({
      message: AUTH_MESSAGES.customerSignupVerificationEmailSent,
    });
  });

  fastify.route({
    method: ["GET", "POST"],
    url: "/*",
    async handler(request, reply) {
      // Construct request URL
      const url = new URL(request.url, env.BETTER_AUTH_URL);

      if (request.method === "POST" && url.pathname.endsWith("/sign-up/email")) {
        return reply.status(404).send(
          errorResponse({
            code: 404,
            message: AUTH_MESSAGES.customerSignupMustUseCustomerEndpoint,
          }),
        );
      }

      // Convert Fastify headers to standard Headers object
      const headers = fromNodeHeaders(request.headers);

      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      // Process authentication request
      const response = await auth.handler(req);

      // Forward response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== "content-length") reply.header(key, value);
      });
      if (response.status >= 400) {
        const body = await response.json().catch(() => null);
        return reply.type("application/json").send(
          errorResponse({
            code: response.status,
            message:
              body &&
              typeof body === "object" &&
              "message" in body &&
              typeof body.message === "string"
                ? body.message
                : ERROR_MESSAGES.unexpectedInternalServerError,
          }),
        );
      }
      return reply.send(response.body ? await response.text() : null);
    },
  });
};

function isEmailConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errorRecord = error as { code?: string; body?: { code?: string } };
  return (
    errorRecord.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    errorRecord.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  );
}
