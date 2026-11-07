import { expect, test } from "bun:test";
import type { RentalListItem, RentalPaymentItem } from "@metastorage/contracts";
import {
  rentalTiming,
  storageMoney,
  storageRentals,
  storageTransactions,
} from "../src/common/my-storage.utils";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rental: RentalListItem = {
  id: id(1),
  bookingId: null,
  reservationId: id(2),
  userId: id(3),
  bookingCode: "MS01",
  facility: { id: id(4), name: "MetaStorage", address: "TP.HCM" },
  unitType: { id: id(5), name: "Kho tiêu chuẩn", sizeLabel: "2 m²" },
  storageUnit: { id: id(6), code: "HCM-023" },
  startAt: "2026-09-30T02:00:00.000Z",
  endAt: "2026-11-07T02:00:00.000Z",
  closedAt: null,
  status: "ACTIVE",
  bookingStatus: "CONFIRMED",
  actions: { canCancel: false, canReschedule: false, note: "" },
};
const payment: RentalPaymentItem = {
  id: id(7),
  type: "CHARGE",
  paymentCode: "MSPAY01",
  provider: "sepay",
  status: "SUCCEEDED",
  totalAmount: "2400000",
  currency: "VND",
  paidAt: "2026-09-30T02:00:00.000Z",
  refundAmount: null,
  refundReason: null,
  refundedAt: null,
  createdAt: "2026-09-30T01:00:00.000Z",
};

test("rental lists respect canonical status even when an active rental is overdue", () => {
  const overdue = { ...rental, id: id(10), endAt: "2026-10-01T02:00:00.000Z" };
  const closed = {
    ...rental,
    id: id(11),
    status: "CLOSED" as const,
    closedAt: "2026-11-01T02:00:00.000Z",
  };
  expect(storageRentals([rental, overdue, rental, closed], "current").map((r) => r.id)).toEqual([
    overdue.id,
    rental.id,
  ]);
  expect(storageRentals([rental, overdue, closed], "history").map((r) => r.id)).toEqual([
    closed.id,
  ]);
});
test("history sorts by actual close date and does not mutate the server list", () => {
  const older = {
    ...rental,
    id: id(10),
    status: "CLOSED" as const,
    closedAt: "2026-07-01T00:00:00Z",
  };
  const newer = { ...older, id: id(11), closedAt: "2026-10-01T00:00:00Z" };
  const input = [older, newer];
  expect(storageRentals(input, "history")).toEqual([newer, older]);
  expect(input).toEqual([older, newer]);
});
test("the remaining-time label changes to overdue without claiming that the rental has closed", () => {
  expect(rentalTiming(rental, Date.parse("2026-11-06T02:00:00Z"))).toMatchObject({
    label: "Còn 1 ngày",
    overdue: false,
  });
  expect(rentalTiming(rental, Date.parse("2026-11-08T02:00:00Z"))).toMatchObject({
    label: "Quá hạn 1 ngày",
    overdue: true,
  });
  expect(rentalTiming({ ...rental, status: "CLOSED" }, Date.now())).toBeNull();
});
test("transaction aggregation deduplicates a shared payment and sorts actual transaction dates", () => {
  const pending = {
    ...payment,
    id: id(8),
    status: "PENDING" as const,
    paidAt: null,
    createdAt: "2026-10-02T01:00:00Z",
  };
  const input = [
    { rental, payment },
    { rental, payment: pending },
    { rental: { ...rental, id: id(9) }, payment },
  ];
  expect(storageTransactions(input).map((t) => t.payment.id)).toEqual([pending.id, payment.id]);
  expect(storageTransactions(input, true).map((t) => t.payment.id)).toEqual([
    payment.id,
    pending.id,
  ]);
});
test("amount formatting retains currency and never displays an invalid amount as zero", () => {
  expect(storageMoney("2400000", "VND")).toContain("2.400.000");
  expect(storageMoney("12.50", "USD")).toContain("12,50");
  expect(storageMoney("invalid", "VND")).toBe("—");
});
