import type { BookingDraftInput, BookingPaymentInput } from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { remainingCapacity } from "../core/availability";
import { addMonths, currentUser, envelope, errorBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
import type { MockCheckout } from "./booking-checkout.types";

const storageKey = "metastorage.flow1.mock-checkouts";
const slots = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Morning",
    startTime: "09:00:00",
    endTime: "11:00:00",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Afternoon",
    startTime: "14:00:00",
    endTime: "16:00:00",
  },
];
const load = (): MockCheckout[] => JSON.parse(localStorage.getItem(storageKey) ?? "[]");
const save = (checkouts: MockCheckout[]) =>
  localStorage.setItem(storageKey, JSON.stringify(checkouts));

export function registerBookingCheckoutHandlers(mock: MockAdapter) {
  mock.onGet("/bookings/check-in-slots").reply(200, envelope(slots));
  mock.onPost("/bookings/drafts").reply((config) => {
    const input = JSON.parse(config.data) as BookingDraftInput;
    const db = getMockDatabase();
    const slot = slots.find((s) => s.id === input.checkInSlotId);
    const unit = db.units.find(
      (u) => u.facilityId === input.facilityId && u.unitTypeId === input.unitTypeId,
    );
    if (!slot || !unit) return [400, errorBody(400, M.missing)];
    const starts = new Date(`${input.checkInDate}T${slot.startTime}+07:00`).toISOString();
    const ends = addMonths(starts, input.durationMonths);
    if (!remainingCapacity(db, input.facilityId, input.unitTypeId, starts, ends))
      return [409, errorBody(409, M.capacity)];
    const entry: MockCheckout = {
      draft: {
        id: crypto.randomUUID(),
        facilityId: input.facilityId,
        unitTypeId: input.unitTypeId,
        checkInAt: starts,
        rentalEndAt: ends,
        durationMonths: input.durationMonths,
        status: "DRAFT",
        pricing: {
          monthlyRateSnapshot: String(unit.monthlyPrice),
          rentalFeeAmount: String(unit.monthlyPrice * input.durationMonths),
          depositAmount: String(unit.monthlyPrice),
          totalAmount: String(unit.monthlyPrice * (input.durationMonths + 1)),
          currency: "VND",
        },
      },
    };
    save([...load(), entry]);
    return [201, envelope(entry.draft)];
  });
  mock.onPost(/\/bookings\/[^/]+\/pay$/).reply((config) => {
    const entries = load();
    const entry = entries.find((e) => e.draft.id === config.url?.split("/")[2]);
    const input = JSON.parse(config.data) as BookingPaymentInput;
    if (!entry) return [404, errorBody(404, M.missing)];
    if (entry.payment)
      return input.idempotencyKey === entry.key
        ? [201, envelope(entry.payment)]
        : [409, errorBody(409, M.hold)];
    const db = getMockDatabase();
    const draft = entry.draft;
    if (
      !remainingCapacity(db, draft.facilityId, draft.unitTypeId, draft.checkInAt, draft.rentalEndAt)
    )
      return [409, errorBody(409, M.capacity)];
    const paymentId = crypto.randomUUID();
    const user = currentUser(config, db);
    entry.contact = {
      fullName: user?.name ?? "Guest",
      email: user?.email ?? "guest@example.com",
      phone: input.contactPhone ?? user?.phone ?? "",
    };
    entry.key = input.idempotencyKey;
    entry.payment = {
      bookingId: draft.id,
      paymentId,
      status: "PENDING",
      provider: "sepay",
      paymentCode: `MOCK${paymentId.slice(0, 8)}`,
      checkoutUrl: `${window.location.origin}/bookings/payment-result?paymentId=${paymentId}&bookingId=${draft.id}`,
      checkoutFormFields: {},
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    };
    // Offline mode simulates a provider callback on the first authorized status read.
    db.holds.push({
      draftId: draft.id,
      holdId: crypto.randomUUID(),
      holdToken: draft.id,
      unitTypeId: draft.unitTypeId,
      startsAt: draft.checkInAt,
      endsAt: draft.rentalEndAt,
      expiresAt: entry.payment.expiresAt,
      status: "ACTIVE",
    });
    saveMockDatabase(db);
    save(entries);
    return [201, envelope(entry.payment)];
  });
  mock.onGet(/\/payments\/[^/]+\/status$/).reply((config) => {
    const entries = load();
    const entry = entries.find((e) => e.payment?.paymentId === config.url?.split("/")[2]);
    if (!entry?.payment) return [404, errorBody(404, M.missing)];
    if (entry.status) return [200, envelope(entry.status)];
    const db = getMockDatabase();
    const d = entry.draft;
    const contact = entry.contact;
    const facility = db.facilities.find((f) => f.id === d.facilityId);
    const unit = db.units.find((u) => u.unitTypeId === d.unitTypeId);
    if (!facility || !unit || !contact) return [404, errorBody(404, M.missing)];
    if (Date.parse(entry.payment.expiresAt) <= Date.now())
      return [
        200,
        envelope({
          paymentId: entry.payment.paymentId,
          status: "FAILED",
          provider: "sepay",
          paymentCode: entry.payment.paymentCode,
        }),
      ];
    const code = `BK-MOCK-${d.id.slice(0, 8).toUpperCase()}`;
    const end = new Date(Date.parse(d.checkInAt) + 7200000).toISOString();
    db.bookings.unshift({
      id: d.id,
      bookingCode: code,
      facilityId: d.facilityId,
      facilityName: facility.name,
      unitTypeId: d.unitTypeId,
      unitTypeName: unit.unitType,
      unitTypeSizeLabel: unit.sizeLabel,
      contactName: contact.fullName,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      checkInSlotStart: d.checkInAt,
      checkInSlotEnd: end,
      rentalEndAt: d.rentalEndAt,
      requestedMonths: d.durationMonths,
      totalAmount: Number(d.pricing.totalAmount),
      status: "CONFIRMED",
      paidAt: new Date().toISOString(),
      assignedUnit: null,
      createdAt: new Date().toISOString(),
      userId: currentUser(config, db)?.id,
    });
    db.holds = db.holds.filter((h) => h.draftId !== d.id);
    saveMockDatabase(db);
    entry.status = {
      paymentId: entry.payment.paymentId,
      status: "SUCCEEDED",
      provider: "sepay",
      paymentCode: entry.payment.paymentCode,
      confirmation: {
        bookingId: d.id,
        bookingCode: code,
        qrToken: `mock-qr-${d.id}`,
        qrUrl: `${window.location.origin}/check-in?token=mock-${d.id}`,
        facility: { name: facility.name, address: facility.address.line1 },
        checkInSlotStart: d.checkInAt,
        checkInSlotEnd: end,
        rentalEndAt: d.rentalEndAt,
        unitTypeName: unit.unitType,
        sizeLabel: unit.sizeLabel,
        durationMonths: d.durationMonths,
        emailStatus: "QUEUED",
      },
    };
    save(entries);
    return [200, envelope(entry.status)];
  });
}
