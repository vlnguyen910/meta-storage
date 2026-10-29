import { describe, expect, mock, test } from "bun:test";
import type { FacilityAssignmentsService } from "../../src/modules/facilities/facility-assignments.service";
import type { VerifiedPaymentEvent } from "../../src/modules/payments/payments.types";
import type { RentalsRepository } from "../../src/modules/rentals/rentals.repository";
import { RentalsService } from "../../src/modules/rentals/rentals.service";

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
