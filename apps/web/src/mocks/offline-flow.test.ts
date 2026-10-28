import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";
import type { SessionTokens } from "@metastorage/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getMockDatabase, resetMockDatabase } from "./database";
import { installMockApi } from "./install-mock-api";

let tokens: SessionTokens | null = null;
const http = createHttpClient({
  baseURL: "/api",
  tokenProvider: {
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    updateTokens: (value) => {
      tokens = value;
    },
    clearSession: () => {
      tokens = null;
    },
  },
});
const client = createMetastorageApiClient(http);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T15:31:00+07:00"));
  process.env.NEXT_PUBLIC_MOCK_DELAY_MS = "0";
  resetMockDatabase();
  installMockApi(http);
  tokens = null;
});
afterEach(() => vi.useRealTimers());
it("keeps guest pricing and payment booking together without an API server", async () => {
  const draft = await client.reservations.createDraft({
    facilityId: "fac-hcm-central",
    unitTypeId: "00000000-0000-0000-0001-000000000003",
    checkInAt: new Date(Date.now() + 86400000).toISOString(),
    durationMonths: 3,
    contact: { fullName: "Demo", email: "customer@metastorage.test", phone: "+84901234567" },
  });
  const hold = await client.reservations.createHold(draft.id, draft.draftAccessToken);
  const input = {
    draftAccessToken: draft.draftAccessToken,
    holdToken: hold.holdToken,
    idempotencyKey: crypto.randomUUID(),
    paymentMethodToken: "fail",
  };
  await expect(client.reservations.pay(draft.id, input)).rejects.toMatchObject({
    response: { status: 402 },
  });
  const result = await client.reservations.pay(draft.id, {
    ...input,
    paymentMethodToken: "success",
  });
  if (result.status !== "SUCCEEDED") throw new Error("Mock payment must succeed");
  expect(result.pricing.totalAmount).toBe("6000000");
  expect(result.pricing.depositAmount).toBe("1500000");
  expect(getMockDatabase().bookings.some((b) => b.id === result.booking?.id)).toBe(true);
  const retry = await client.reservations.pay(draft.id, {
    ...input,
    paymentMethodToken: "success",
  });
  if (retry.status !== "SUCCEEDED") throw new Error("Mock retry must succeed");
  expect(retry.id).toBe(result.id);
});
it("fails closed for unknown endpoints", async () => {
  await expect(http.get("/missing-offline-endpoint")).rejects.toMatchObject({
    response: { status: 404 },
  });
});
