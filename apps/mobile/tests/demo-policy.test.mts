import { describe, expect, test } from "bun:test";
import {
  CheckInLookupResultSchema,
  HANDOVER_CHECKLIST_ITEMS,
  PaymentResultSchema,
  ReservationDraftSchema,
  ReservationHoldSchema,
} from "@metastorage/contracts";
import { remainingDemoCapacity } from "../src/features/demo/demo-policy";
import { createMobileSeed, demoId } from "../src/features/demo/demo-seed";
import { handleMobileRequest, mobileWorkspace } from "../src/features/demo/demo-service";
import { secureStoreChunks } from "../src/features/demo/demo-storage-codec";

const pass = HANDOVER_CHECKLIST_ITEMS.map((item) => ({
  itemCode: item.code,
  resultType: "PASS_FAIL",
  result: "PASS",
  note: null,
  photos: [],
}));
function fixture<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Missing test fixture");
  return value;
}
const call = (
  db: ReturnType<typeof createMobileSeed>,
  path: string,
  body: unknown = {},
  method = "POST",
) => handleMobileRequest(db, method, path, body);
describe("mobile demo policies", () => {
  test("native storage encoding preserves Vietnamese/emoji and respects value byte limits", () => {
    const value = JSON.stringify({ notes: "Kho lưu trữ 🏠 sạch và nguyên vẹn. ".repeat(200) });
    const chunks = secureStoreChunks(value);
    expect(chunks.join("")).toBe(value);
    expect(chunks.every((chunk) => new TextEncoder().encode(chunk).byteLength <= 1500)).toBe(true);
    expect(JSON.parse(chunks.join(""))).toEqual(JSON.parse(value));
  });
  test("guest draft→hold→payment follows shared contracts and creates exactly one paid booking", () => {
    const db = createMobileSeed();
    const d = call(db, "/reservations/drafts", {
      facilityId: demoId(1),
      unitTypeId: demoId(20),
      checkInAt: new Date(Date.now() + 86400000).toISOString(),
      durationMonths: 2,
      contact: { fullName: "Guest Customer", email: "guest@example.test", phone: "+84901234567" },
    }) as (typeof db.drafts)[number];
    expect(ReservationDraftSchema.safeParse(d).success).toBe(true);
    expect(db.bookings.some((b) => b.id === d.id)).toBe(false);
    const h = call(db, `/reservations/drafts/${d.id}/hold`, {
      draftAccessToken: d.draftAccessToken,
    }) as NonNullable<typeof d.hold>;
    expect(ReservationHoldSchema.safeParse(h).success).toBe(true);
    expect(Date.parse(h.expiresAt) - Date.now()).toBeGreaterThan(599000);
    const input = {
      holdToken: h.holdToken,
      idempotencyKey: `demo-${d.id}`,
      paymentMethodToken: "success",
    };
    const paid = call(db, `/reservations/drafts/${d.id}/pay`, input);
    expect(PaymentResultSchema.safeParse(paid).success).toBe(true);
    call(db, `/reservations/drafts/${d.id}/pay`, input);
    expect(db.bookings.filter((b) => b.id === d.id)).toHaveLength(1);
    expect(() =>
      call(db, `/reservations/drafts/${d.id}/hold`, { draftAccessToken: d.draftAccessToken }),
    ).toThrow();
    expect(() => call(db, `/demo/bookings/${d.id}/cancel`)).toThrow();
    expect(db.bookings.find((b) => b.id === d.id)?.assignedStaff).toBeNull();
    db.sessionId = demoId(100);
    expect(mobileWorkspace(db).bookings.some((b) => b.id === d.id)).toBe(false);
  });
  test("rejects more than 30 days, holds over capacity, and payment after expiry", () => {
    const db = createMobileSeed();
    const input = {
      facilityId: demoId(1),
      unitTypeId: demoId(20),
      checkInAt: new Date(Date.now() + 31 * 86400000).toISOString(),
      durationMonths: 1,
      contact: { fullName: "Guest Customer", email: "guest@example.test", phone: "+84901234567" },
    };
    expect(() => call(db, "/reservations/drafts", input)).toThrow();
    const d = call(db, "/reservations/drafts", {
      ...input,
      checkInAt: new Date(Date.now() + 86400000).toISOString(),
    }) as (typeof db.drafts)[number];
    call(db, `/reservations/drafts/${d.id}/hold`, { draftAccessToken: d.draftAccessToken });
    const expiredHold = fixture(d.hold);
    expiredHold.expiresAt = new Date(Date.now() - 1).toISOString();
    expect(() =>
      call(db, `/reservations/drafts/${d.id}/pay`, {
        holdToken: expiredHold.holdToken,
        idempotencyKey: `demo-${d.id}`,
        paymentMethodToken: "success",
      }),
    ).toThrow();
    fixture(db.unitTypes.find((t) => t.unitTypeId === demoId(20))).availableCount = 0;
    expect(() =>
      call(db, `/reservations/drafts/${d.id}/hold`, { draftAccessToken: d.draftAccessToken }),
    ).toThrow();
  });
  test("customer ownership and FS assignment are enforced by the adapter service", () => {
    const db = createMobileSeed();
    db.sessionId = demoId(100);
    expect(mobileWorkspace(db).bookings.some((b) => b.ownerId === demoId(102))).toBe(false);
    expect(() => call(db, `/demo/bookings/${demoId(204)}/cancel`)).toThrow();
    db.sessionId = demoId(101);
    expect(mobileWorkspace(db).bookings.some((b) => b.id === demoId(202))).toBe(false);
    expect(() =>
      call(db, "/bookings/check-in/lookup", { type: "BOOKING_CODE", value: "BK-2026-0002" }),
    ).toThrow();
  });
  test("reschedule preserves paid attributes, checks capacity, and allows no more than two changes", () => {
    const db = createMobileSeed();
    db.sessionId = demoId(100);
    const b = fixture(db.bookings.find((b) => b.id === demoId(202)));
    const original = {
      facilityId: b.facilityId,
      type: b.unitTypeId,
      months: b.requestedMonths,
      total: b.totalAmount,
    };
    for (const days of [4, 5])
      call(db, `/demo/bookings/${b.id}/reschedule`, {
        checkInAt: new Date(Date.now() + days * 86400000).toISOString(),
      });
    expect(b.rescheduleCount).toBe(2);
    expect({
      facilityId: b.facilityId,
      type: b.unitTypeId,
      months: b.requestedMonths,
      total: b.totalAmount,
    }).toEqual(original);
    expect(b.history).toHaveLength(2);
    expect(() =>
      call(db, `/demo/bookings/${b.id}/reschedule`, {
        checkInAt: new Date(Date.now() + 6 * 86400000).toISOString(),
      }),
    ).toThrow();
    expect(() =>
      call(db, `/demo/bookings/${demoId(201)}/reschedule`, {
        checkInAt: new Date(Date.now() + 6 * 86400000).toISOString(),
      }),
    ).toThrow();
  });
  test("cancellation releases period capacity without creating a fake refund", () => {
    const db = createMobileSeed();
    db.sessionId = demoId(100);
    const b = fixture(db.bookings.find((b) => b.id === demoId(202)));
    const before = remainingDemoCapacity(
      db,
      b.facilityId,
      b.unitTypeId,
      b.checkInSlotStart,
      b.rentalEndAt,
    );
    call(db, `/demo/bookings/${b.id}/cancel`);
    expect(b.status).toBe("CANCELLED");
    expect(
      remainingDemoCapacity(db, b.facilityId, b.unitTypeId, b.checkInSlotStart, b.rentalEndAt),
    ).toBe(before + 1);
  });
  test("task arrival and inspection never activate rental; only explicit handover does, once", () => {
    const db = createMobileSeed();
    db.sessionId = demoId(101);
    const b = fixture(db.bookings.find((b) => b.id === demoId(201)));
    expect(
      CheckInLookupResultSchema.safeParse(
        call(db, "/bookings/check-in/lookup", {
          type: "BOOKING_CODE",
          value: b.bookingCode,
        }),
      ).success,
    ).toBe(true);
    expect(b.status).toBe("CONFIRMED");
    const inspection = call(
      db,
      `/demo/bookings/${b.id}/inspection`,
    ) as (typeof db.inspections)[number];
    expect(b.taskStatus).toBe("IN_PROGRESS");
    expect(() => call(db, `/demo/inspections/${inspection.id}/complete`, { version: 0 })).toThrow();
    call(
      db,
      `/demo/inspections/${inspection.id}`,
      { version: 0, notes: "Baseline checked", checklist: pass, photos: [] },
      "PATCH",
    );
    call(db, `/demo/inspections/${inspection.id}/complete`, { version: 1 });
    expect(b.status).toBe("CONFIRMED");
    expect(db.rentals.some((r) => r.bookingId === b.id)).toBe(false);
    expect(() =>
      call(db, `/demo/inspections/${inspection.id}/handover`, { version: 2, confirmed: false }),
    ).toThrow();
    call(db, `/demo/inspections/${inspection.id}/handover`, { version: 2, confirmed: true });
    call(db, `/demo/inspections/${inspection.id}/handover`, { version: 2, confirmed: true });
    expect(db.rentals.filter((r) => r.bookingId === b.id)).toHaveLength(1);
    expect(b.status).toBe("CHECKED_IN");
  });
  test("return reports may record failures but only submit to FM and never close rental", () => {
    const db = createMobileSeed();
    db.sessionId = demoId(101);
    const before = JSON.stringify(db.rentals);
    expect(() =>
      call(db, `/demo/requests/${demoId(600)}/report`, {
        notes: "Observed damage",
        checklist: [],
        photos: [],
      }),
    ).toThrow();
    call(db, `/demo/requests/${demoId(600)}/report`, {
      notes: "Observed damage",
      checklist: pass.map((i) => ({ ...i, result: "FAIL" })),
      photos: [],
    });
    expect(db.requests[0].status).toBe("REPORT_SENT");
    expect(JSON.stringify(db.rentals)).toBe(before);
  });
  test("return/change requests save intent without changing rental and exact retries reuse the record", () => {
    const db = createMobileSeed();
    db.sessionId = demoId(100);
    const before = JSON.stringify(db.rentals);
    const payload = {
      type: "RETURN",
      reason: "Yêu cầu trả kho mới",
      preferredAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const first = call(
      db,
      `/demo/rentals/${demoId(500)}/requests`,
      payload,
    ) as (typeof db.requests)[number];
    const retry = call(
      db,
      `/demo/rentals/${demoId(500)}/requests`,
      payload,
    ) as (typeof db.requests)[number];
    expect(first.id).toBe(retry.id);
    expect(first.status).toBe("AWAITING_FM");
    expect(first.assignedStaffId).toBeNull();
    expect(db.requests).toHaveLength(2);
    expect(JSON.stringify(db.rentals)).toBe(before);
  });
});
