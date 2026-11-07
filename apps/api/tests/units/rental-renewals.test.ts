import { describe, expect, mock, spyOn, test } from "bun:test";
import type { FacilityAssignmentsService } from "../../src/modules/facilities/facility-assignments.service";
import type { VerifiedPaymentEvent } from "../../src/modules/payments/payments.types";
import { PricingRepository } from "../../src/modules/pricing/pricing.repository";
import type { RentalsRepository } from "../../src/modules/rentals/rentals.repository";
import { RentalsService } from "../../src/modules/rentals/rentals.service";
import { StorageUnitsService } from "../../src/modules/storage-units/storage-units.service";
import { SystemSettingsRepository } from "../../src/modules/system-settings/system-settings.repository";

function fixture(overrides: Record<string, unknown>) {
  const lockRenewal = mock(async () => [{ id: "renewal" }]);
  const repository = {
    db: { transaction: async (work: (tx: object) => unknown) => work({}) },
    lockRental: async () => [{ id: "rental", userId: "owner" }],
    lockRenewal,
    ...overrides,
  } as unknown as RentalsRepository;
  return {
    service: new RentalsService(repository, {} as FacilityAssignmentsService),
    lockRenewal,
  };
}

describe("rental renewal service", () => {
  test("refuses to quote another customer's rental before reading renewal data", async () => {
    const findRenewalByIdempotencyKey = mock(async () => []);
    const { service } = fixture({ findRenewalByIdempotencyKey });
    await expect(service.quoteRenewal("rental", "other", 1, "key")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(findRenewalByIdempotencyKey).not.toHaveBeenCalled();
  });

  test("rejects reuse of a quote key for a different duration", async () => {
    const { service } = fixture({
      findRenewalByIdempotencyKey: async () => [{ months: 1 }],
    });
    await expect(service.quoteRenewal("rental", "owner", 2, "key")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test("ignores unrelated payments without locking a rental", async () => {
    const lockRental = mock(async () => []);
    const { service } = fixture({
      lockRental,
      findRenewalPaymentByCode: async () => [{ renewalId: null, provider: "sepay" }],
    });
    expect(
      await service.processRenewalPaymentEvent({
        paymentCode: "unrelated",
      } as VerifiedPaymentEvent),
    ).toBeNull();
    expect(lockRental).not.toHaveBeenCalled();
  });

  test("treats an already settled payment as a duplicate", async () => {
    const { service } = fixture({
      findRenewalPaymentByCode: async () => [
        { id: "payment", renewalId: "renewal", provider: "sepay" },
      ],
      findRenewalRentalId: async () => [{ rentalId: "rental" }],
      lockPayment: async () => [{ id: "payment", status: "SUCCEEDED" }],
    });
    expect(
      await service.processRenewalPaymentEvent({ paymentCode: "paid" } as VerifiedPaymentEvent),
    ).toEqual({ duplicate: true, processed: false, paymentId: "payment" });
  });
});

test("renewals include VAT without collecting another deposit and keep idempotent quote snapshots", async () => {
  const vat = spyOn(PricingRepository.prototype, "getVatRate").mockResolvedValue(8);
  const notice = spyOn(SystemSettingsRepository.prototype, "find").mockResolvedValue({
    value: 7,
    version: 1,
  } as never);
  const capacity = spyOn(StorageUnitsService.prototype, "getAvailableCapacity").mockResolvedValue(
    1,
  );
  const now = Date.now();
  let stored: Record<string, unknown> | undefined;
  const createRenewal = mock(async (_tx: unknown, input: Record<string, unknown>) => {
    stored = {
      ...input,
      id: "renewal",
      status: "QUOTED",
      createdAt: new Date(now),
      appliedAt: null,
      failureReason: null,
    };
    return [stored];
  });
  const { service } = fixture({
    lockRental: async () => [
      {
        id: "rental",
        userId: "owner",
        storageUnitId: "unit",
        status: "ACTIVE",
        startAt: new Date(now - 86400000),
        endAt: new Date(now + 60 * 86400000),
      },
    ],
    findRenewalByIdempotencyKey: async (_tx: unknown, _id: string, key: string) =>
      stored?.idempotencyKey === key ? [stored] : [],
    findRenewalUnit: async () => [
      { price: 100000, active: true, facilityId: "facility", unitTypeId: "type" },
    ],
    hasOpenReturn: async () => false,
    findRenewalPaymentId: async () => null,
    createRenewal,
  });
  try {
    const first = await service.quoteRenewal("rental", "owner", 1, "first");
    expect(first).toMatchObject({
      monthlyRateSnapshot: "100000",
      vatRateSnapshot: 8,
      vatAmount: "8000",
      amount: "108000",
    });
    vat.mockResolvedValue(10);
    expect(await service.quoteRenewal("rental", "owner", 1, "first")).toEqual(first);
    expect(createRenewal).toHaveBeenCalledTimes(1);
    expect(await service.quoteRenewal("rental", "owner", 2, "second")).toMatchObject({
      vatRateSnapshot: 10,
      vatAmount: "20000",
      amount: "220000",
    });
  } finally {
    vat.mockRestore();
    notice.mockRestore();
    capacity.mockRestore();
  }
});
