import {
  ApiErrorCode,
  type PaymentCheckoutInput,
  type PaymentResult,
  type ReservationDraftInput,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { addMonths, currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
import type { MockBooking } from "../types";

export function registerGuestCheckoutHandlers(mock: MockAdapter): void {
  mock.onPost("/reservations/drafts").reply((config) => {
    const db = getMockDatabase();
    const input = parseBody<ReservationDraftInput>(config.data);
    const unit = db.units.find(
      (u) =>
        u.facilityId === input.facilityId &&
        u.unitTypeId === input.unitTypeId &&
        u.status === "AVAILABLE",
    );
    if (!unit) return [409, errorBody(ApiErrorCode.CAPACITY_UNAVAILABLE, M.capacity)];
    if (
      !Number.isInteger(input.durationMonths) ||
      input.durationMonths < 1 ||
      input.durationMonths > 12 ||
      !Number.isFinite(Date.parse(input.checkInAt)) ||
      Date.parse(input.checkInAt) < Date.now()
    )
      return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, M.invalid)];
    const draft = {
      ...input,
      id: crypto.randomUUID(),
      rentalEndAt: addMonths(input.checkInAt, input.durationMonths),
      draftAccessToken: `mock-draft-${crypto.randomUUID()}`,
      status: "DRAFT" as const,
      pricingStatus: "PRICED" as const,
      pricing: {
        monthlyRateSnapshot: String(unit.monthlyPrice),
        rentalFeeAmount: String(unit.monthlyPrice * input.durationMonths),
        depositAmount: String(unit.monthlyPrice),
        totalAmount: String(unit.monthlyPrice * (input.durationMonths + 1)),
        currency: "VND",
      },
    };
    db.drafts.push(draft);
    saveMockDatabase(db);
    return [201, envelope(draft)];
  });
  mock.onPost(/\/reservations\/drafts\/[^/]+\/hold$/).reply((config) => {
    const db = getMockDatabase();
    const id = config.url?.split("/")[3];
    const body = parseBody<{ draftAccessToken: string }>(config.data);
    const draft = db.drafts.find(
      (d) => d.id === id && d.draftAccessToken === body.draftAccessToken,
    );
    if (!draft) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    const existing = db.holds.find((h) => h.draftId === id && Date.parse(h.expiresAt) > Date.now());
    if (existing) return [200, envelope(existing)];
    const capacity = db.units.filter(
      (u) =>
        u.facilityId === draft.facilityId &&
        u.unitTypeId === draft.unitTypeId &&
        u.status === "AVAILABLE",
    ).length;
    const overlaps = (start: string, end: string) =>
      Date.parse(start) < Date.parse(draft.rentalEndAt) &&
      Date.parse(end) > Date.parse(draft.checkInAt);
    const held = db.holds.filter(
      (h) =>
        h.unitTypeId === draft.unitTypeId &&
        Date.parse(h.expiresAt) > Date.now() &&
        overlaps(h.startsAt, h.endsAt),
    ).length;
    const booked = db.bookings.filter(
      (b) =>
        b.unitTypeId === draft.unitTypeId &&
        b.status === "CONFIRMED" &&
        !b.assignedUnit &&
        overlaps(b.checkInSlotStart, b.rentalEndAt),
    ).length;
    if (capacity <= held + booked)
      return [409, errorBody(ApiErrorCode.CAPACITY_UNAVAILABLE, M.capacity)];
    const hold = {
      draftId: draft.id,
      holdId: crypto.randomUUID(),
      holdToken: `mock-hold-${crypto.randomUUID()}`,
      unitTypeId: draft.unitTypeId,
      startsAt: draft.checkInAt,
      endsAt: draft.rentalEndAt,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      status: "ACTIVE" as const,
    };
    db.holds.push(hold);
    saveMockDatabase(db);
    return [201, envelope(hold)];
  });
  mock.onPost(/\/reservations\/drafts\/[^/]+\/pay$/).reply((config) => {
    const db = getMockDatabase();
    const id = config.url?.split("/")[3];
    const input = parseBody<PaymentCheckoutInput>(config.data);
    const draft = db.drafts.find((d) => d.id === id);
    const existing = db.checkoutResults.find((p) => p.draftId === id);
    if (existing) return [200, envelope(existing)];
    const hold = db.holds.find(
      (h) =>
        h.draftId === id && h.holdToken === input.holdToken && Date.parse(h.expiresAt) > Date.now(),
    );
    if (!draft?.pricing || !hold)
      return [409, errorBody(ApiErrorCode.RESERVATION_CONFLICT, M.hold)];
    if (input.paymentMethodToken === "fail")
      return [402, errorBody(ApiErrorCode.PAYMENT_FAILED, M.paymentFailed)];
    const facility = db.facilities.find((f) => f.id === draft.facilityId);
    const unit = db.units.find((u) => u.unitTypeId === draft.unitTypeId);
    if (!facility || !unit) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    const now = new Date().toISOString();
    const bookingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const code = `BK-MOCK-${bookingId.slice(0, 8).toUpperCase()}`;
    const userId = currentUser(config, db)?.id ?? null;
    const slotEnd = new Date(Date.parse(draft.checkInAt) + 7200000).toISOString();
    const booking: MockBooking = {
      id: bookingId,
      bookingCode: code,
      facilityId: facility.id,
      facilityName: facility.name,
      unitTypeId: unit.unitTypeId,
      unitTypeName: unit.unitType,
      unitTypeSizeLabel: unit.sizeLabel,
      userId,
      contactName: draft.contact.fullName,
      contactEmail: draft.contact.email,
      contactPhone: draft.contact.phone,
      checkInSlotStart: draft.checkInAt,
      checkInSlotEnd: slotEnd,
      rentalEndAt: draft.rentalEndAt,
      requestedMonths: draft.durationMonths,
      totalAmount: Number(draft.pricing.totalAmount),
      status: "CONFIRMED",
      paidAt: now,
      assignedUnit: null,
      assignedStaff: null,
      createdAt: now,
    };
    const result: PaymentResult & { draftId: string } = {
      draftId: draft.id,
      id: paymentId,
      status: "SUCCEEDED",
      provider: "mock",
      providerPaymentId: paymentId,
      paidAt: now,
      pricing: draft.pricing,
      booking: {
        id: bookingId,
        bookingCode: code,
        facilityId: facility.id,
        unitTypeId: unit.unitTypeId,
        checkInAt: draft.checkInAt,
        rentalEndAt: draft.rentalEndAt,
        durationMonths: draft.durationMonths,
        status: "CONFIRMED",
        paidAt: now,
        contact: draft.contact,
        pricing: draft.pricing,
      },
      confirmation: {
        bookingId,
        bookingCode: code,
        qrToken: `mock-qr-${bookingId}`,
        qrUrl: `${window.location.origin}/check-in/${bookingId}`,
        facility: {
          name: facility.name,
          address: `${facility.address.line1}, ${facility.address.city}`,
        },
        checkInSlotStart: draft.checkInAt,
        checkInSlotEnd: slotEnd,
        rentalEndAt: draft.rentalEndAt,
        unitTypeName: unit.unitType,
        sizeLabel: unit.sizeLabel,
        durationMonths: draft.durationMonths,
        emailStatus: "PENDING",
      },
    };
    db.bookings.unshift(booking);
    db.checkoutResults.push(result);
    db.holds = db.holds.filter((h) => h.draftId !== id);
    saveMockDatabase(db);
    return [201, envelope(result)];
  });
  mock.onGet(/\/payments\/[^/]+\/status$/).reply((config) => {
    const result = getMockDatabase().checkoutResults.find(
      (p) => p.id === config.url?.split("/")[2],
    );
    return result
      ? [
          200,
          envelope({
            paymentId: result.id,
            status: result.status,
            provider: "mock",
            paymentCode: result.booking.bookingCode,
            confirmation: result.confirmation,
          }),
        ]
      : [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
  });
}
