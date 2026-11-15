import { expect, mock, test } from "bun:test";
import type { PaymentsRepository } from "../../src/modules/payments/payments.repository";
import { PaymentsService } from "../../src/modules/payments/payments.service";

function setup(failOutbox = false) {
  let payment = {
    id: "payment",
    status: "REFUND_PENDING",
    type: "RESERVATION",
    bookingId: null,
    reservationId: "reservation",
    rentalId: null,
    renewalId: null,
    totalAmount: "1000",
    refundAmount: "1000",
    currency: "VND",
    refundReference: null,
    refundedAt: null,
    refundedBy: null,
    depositForfeitedAmount: "0",
  } as Record<string, unknown>;
  let outbox: unknown[] = [];
  const tx = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [
            {
              id: "reservation",
              userId: "customer",
              facilityId: "facility",
              bookingCode: "BK-1",
              contactEmail: "customer@example.test",
            },
          ],
        }),
      }),
    }),
    insert: () => ({
      values: (values: unknown[]) => ({
        onConflictDoNothing: async () => {
          if (failOutbox) throw new Error("outbox unavailable");
          outbox.push(...values);
        },
      }),
    }),
  };
  const repository = {
    transaction: async (callback: (value: unknown) => Promise<unknown>) => {
      const before = { ...payment },
        beforeOutbox = [...outbox];
      try {
        return await callback(tx);
      } catch (error) {
        payment = before;
        outbox = beforeOutbox;
        throw error;
      }
    },
    lockPayment: mock(async (transaction: unknown) => {
      expect(transaction).toBe(tx);
      return payment;
    }),
    confirmManualRefund: mock(
      async (transaction: unknown, _id: string, reference: string, actor: string, now: Date) => {
        expect(transaction).toBe(tx);
        payment = {
          ...payment,
          status: "REFUNDED",
          refundReference: reference,
          refundedAt: now,
          refundedBy: actor,
        };
        return payment;
      },
    ),
  };
  return {
    service: new PaymentsService(repository as unknown as PaymentsRepository),
    repository,
    payment: () => payment,
    outbox: () => outbox,
  };
}

test("refund and its notification commit together; replay does not create another email", async () => {
  const { service, repository, payment, outbox } = setup();
  expect((await service.confirmManualRefund("payment", "REF-1", "actor")).status).toBe("REFUNDED");
  expect(payment().status).toBe("REFUNDED");
  expect(outbox()).toHaveLength(1);
  expect(outbox()[0]).toEqual(
    expect.objectContaining({ eventType: "RETURN_REFUND", eventKey: "payment:payment:refunded" }),
  );
  await service.confirmManualRefund("payment", "REF-1", "actor");
  expect(repository.confirmManualRefund).toHaveBeenCalledTimes(1);
  expect(outbox()).toHaveLength(1);
  await expect(service.confirmManualRefund("payment", "DIFFERENT", "actor")).rejects.toThrow();
});
test("outbox failure aborts the enclosing refund transaction", async () => {
  const { service, payment, outbox } = setup(true);
  await expect(service.confirmManualRefund("payment", "REF-1", "actor")).rejects.toThrow(
    "outbox unavailable",
  );
  expect(payment().status).toBe("REFUND_PENDING");
  expect(outbox()).toHaveLength(0);
});
