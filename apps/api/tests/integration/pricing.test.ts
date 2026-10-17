import { afterAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { PRICING_MESSAGES } from "@metastorage/contracts";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { PricingRepository } from "../../src/modules/pricing/pricing.repository";
import { pricingRoutes } from "../../src/modules/pricing/pricing.routes";
import { PricingService } from "../../src/modules/pricing/pricing.service";

const actor = "11111111-1111-4111-8111-111111111111";
const type = "22222222-2222-4222-8222-222222222222";
const session = spyOn(auth.api, "getSession");
const findQuote = spyOn(PricingRepository.prototype, "findQuote");
const read = spyOn(PricingRepository.prototype, "getConfiguration");
const update = spyOn(PricingRepository.prototype, "updateDeposit");
const updatePrice = spyOn(PricingRepository.prototype, "updatePrice");
const service = new PricingService(new PricingRepository({} as never));
const app = Fastify();
app.decorate("db", {});
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
setupErrorHandler(app);
await app.register(pricingRoutes, { prefix: "/api/business-rules" });
await app.ready();

beforeEach(() => {
  session.mockReset().mockResolvedValue({
    user: { id: actor, role: "BUSINESS_OPERATION_MANAGER", status: "ACTIVE" },
    session: {},
  } as never);
  findQuote.mockReset().mockResolvedValue({ monthlyPrice: 750000, depositMonths: 2 });
  read.mockReset().mockResolvedValue({
    version: 1,
    depositMonths: 1,
    updatedBy: null,
    updatedAt: new Date("2026-01-01"),
    prices: [],
  });
  update.mockReset().mockResolvedValue({ version: 2 });
  updatePrice.mockReset().mockResolvedValue({ version: 2 });
});
afterAll(async () => {
  await app.close();
  session.mockRestore();
  findQuote.mockRestore();
  read.mockRestore();
  update.mockRestore();
  updatePrice.mockRestore();
});

describe("database-backed pricing policy", () => {
  test("validates global monthly prices and forwards only the requested type and actor", async () => {
    const url = `/api/business-rules/pricing/${type}`;
    for (const monthlyPrice of [-1, 1.5, "900000", 2147483648]) {
      expect(
        (await app.inject({ method: "PATCH", url, payload: { expectedVersion: 1, monthlyPrice } }))
          .statusCode,
      ).toBe(400);
    }
    expect(updatePrice).not.toHaveBeenCalled();
    const response = await app.inject({
      method: "PATCH",
      url,
      payload: { expectedVersion: 1, monthlyPrice: 900000 },
    });
    expect(response.statusCode).toBe(200);
    expect(updatePrice).toHaveBeenCalledWith(
      type,
      { expectedVersion: 1, monthlyPrice: 900000 },
      actor,
    );
  });
  test("computes rent and deposit independently of rental duration using stored months", async () => {
    expect(await service.quote(type, 3)).toEqual({
      monthlyRateSnapshot: "750000",
      rentalFeeAmount: "2250000",
      depositAmount: "1500000",
      totalAmount: "3750000",
      currency: "VND",
    });
  });
  test("does not silently fall back to one month when configuration is missing", async () => {
    findQuote.mockResolvedValue(null);
    await expect(service.quote(type, 3)).rejects.toThrow(PRICING_MESSAGES.unavailable);
  });
  test("rejects totals outside the database money range", async () => {
    findQuote.mockResolvedValue({ monthlyPrice: 2147483647, depositMonths: 2147483647 });
    await expect(service.quote(type, 12)).rejects.toThrow(PRICING_MESSAGES.amountTooLarge);
  });
  test("returns explicit public fields with ISO dates", async () => {
    const response = await app.inject({ method: "GET", url: "/api/business-rules/pricing" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      version: 1,
      depositMonths: 1,
      updatedBy: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      prices: [],
    });
  });
  test("requires login and rejects other roles including administrator", async () => {
    session.mockResolvedValue(null);
    expect(
      (await app.inject({ method: "GET", url: "/api/business-rules/pricing" })).statusCode,
    ).toBe(401);
    for (const role of ["CUSTOMER", "FACILITY_STAFF", "FACILITY_MANAGER", "SYSTEM_ADMIN"]) {
      session.mockResolvedValue({
        user: { id: actor, role, status: "ACTIVE" },
        session: {},
      } as never);
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: "/api/business-rules/pricing",
            payload: { expectedVersion: 1, depositMonths: 2 },
          })
        ).statusCode,
      ).toBe(403);
    }
    expect(update).not.toHaveBeenCalled();
  });
  test("validates deposit and forwards only confirmed input and authenticated actor", async () => {
    const url = "/api/business-rules/pricing";
    for (const depositMonths of [0, -1, 1.5, "2"]) {
      expect(
        (await app.inject({ method: "PATCH", url, payload: { expectedVersion: 1, depositMonths } }))
          .statusCode,
      ).toBe(400);
    }
    expect(
      (
        await app.inject({
          method: "PATCH",
          url,
          payload: { expectedVersion: 1, depositMonths: 2, updatedBy: actor },
        })
      ).statusCode,
    ).toBe(400);
    expect(update).not.toHaveBeenCalled();
    expect(
      (
        await app.inject({
          method: "PATCH",
          url,
          payload: { expectedVersion: 1, depositMonths: 2 },
        })
      ).statusCode,
    ).toBe(200);
    expect(update).toHaveBeenCalledWith({ expectedVersion: 1, depositMonths: 2 }, actor);
  });
});
