import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";
import type { SessionTokens } from "@metastorage/contracts";
import { beforeEach, expect, it } from "vitest";
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
  process.env.NEXT_PUBLIC_MOCK_DELAY_MS = "0";
  resetMockDatabase();
  installMockApi(http);
  tokens = null;
});
async function login(email: string) {
  tokens = await client.auth.login({ email, password: "Demo@123" });
}
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
it("keeps FM assignment separate from Staff inspection and persists handover", async () => {
  await login("manager@metastorage.test");
  expect(await client.facilities.myAssignments()).toHaveLength(1);
  const id = "b0000000-0000-0000-0000-000000000001";
  const units = await client.bookings.getEligibleUnits(id);
  const unit = units.find((u) => u.isAvailableForPeriod);
  if (!unit) throw new Error("Missing available unit");
  await client.bookings.assignUnit(id, { physicalUnitId: unit.id });
  await client.bookings.assignStaff(id, { staffId: "user-2" });
  await expect(client.checkIns.confirm(id)).rejects.toMatchObject({ response: { status: 403 } });
  await login("staff@metastorage.test");
  await client.checkIns.confirm(id);
  let inspection = await client.inspections.start(id);
  await expect(
    client.inspections.complete(inspection.id, inspection.version),
  ).rejects.toMatchObject({ response: { status: 409 } });
  inspection = await client.inspections.save(inspection.id, {
    version: inspection.version,
    correctUnit: true,
    conditionNotes: "Kho trống, sạch, không hư hại.",
  });
  inspection = await client.inspections.upload(inspection.id, {
    version: inspection.version,
    filename: "evidence.png",
    mimeType: "image/png",
    dataBase64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG3sAAAAASUVORK5CYII=",
  });
  inspection = await client.inspections.complete(inspection.id, inspection.version);
  inspection = await client.inspections.handover(inspection.id, inspection.version);
  expect((await client.inspections.get(inspection.id)).handedOverAt).toBeTruthy();
  expect((await client.bookings.get(id)).status).toBe("CHECKED_IN");
  expect(getMockDatabase().units.find((u) => u.id === unit.id)?.status).toBe("OCCUPIED");
  await login("customer@metastorage.test");
  // Guest bookings do not acquire ownership by matching a registered email.
  expect((await client.rentals.mine()).some((r) => r.bookingId === id)).toBe(false);
});
it("fails closed for unknown endpoints", async () => {
  await expect(http.get("/missing-offline-endpoint")).rejects.toMatchObject({
    response: { status: 404 },
  });
});
