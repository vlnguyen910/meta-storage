import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { paymentsRoutes } from "../../src/modules/payments/payments.routes";
import { reservationsRoutes } from "../../src/modules/reservations/reservations.routes";

const app = Fastify();
const id = "00000000-0000-4000-8000-000000000001";

describe("customer account required for reservation", () => {
  beforeAll(async () => {
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(reservationsRoutes, { prefix: "/api/reservations" });
    await app.register(paymentsRoutes, { prefix: "/api" });
    await app.ready();
  });
  afterAll(() => app.close());

  test.each([
    [
      "POST",
      "/reservations/drafts",
      {
        facilityId: id,
        unitTypeId: id,
        checkInSlotId: id,
        checkInDate: "2030-01-01",
        durationMonths: 1,
      },
    ],
    [
      "POST",
      `/reservations/${id}/make-payment`,
      { idempotencyKey: "00000000-0000-4000-8000-000000000002" },
    ],
    ["PATCH", `/reservations/${id}`, { status: "CANCELLED" }],
    ["GET", `/payments/${id}/status`, undefined],
  ] as const)("rejects anonymous %s %s", async (method, path, payload) => {
    const response = await app.inject({ method, url: `/api${path}`, payload });
    expect(response.statusCode).toBe(401);
  });
  test.each([
    ["POST", "/booking/magic-link/exchange"],
    ["POST", "/booking/access-link"],
    ["POST", "/booking/session/revoke"],
    ["GET", "/booking/tracking/OLD-GUEST"],
    ["GET", "/booking/tracking/OLD-GUEST/rental"],
    ["GET", "/booking/tracking/OLD-GUEST/payments"],
    ["GET", "/booking/tracking/OLD-GUEST/contracts"],
    ["GET", "/booking/tracking/OLD-GUEST/contracts/test/pdf"],
    ["GET", "/booking/tracking/OLD-GUEST/return-slots"],
    ["GET", "/booking/tracking/OLD-GUEST/return-requests"],
    ["POST", "/booking/tracking/OLD-GUEST/return-requests"],
  ] as const)("guest endpoint removed: %s %s", async (method, path) => {
    const response = await app.inject({
      method,
      url: `/api${path}`,
      headers: {
        cookie: `metastorage_booking_session=${"a".repeat(64)}`,
      },
    });
    expect(response.statusCode).toBe(404);
  });
});
