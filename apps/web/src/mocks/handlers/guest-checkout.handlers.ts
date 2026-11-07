import type {
  PaymentCheckoutInput,
  PaymentResult,
  ReservationDraftInput,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { remainingCapacity } from "../core/availability";
import { addMonths, currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
import type { MockBooking } from "../types";
import { registerBookingCheckoutHandlers } from "./booking-checkout.handlers";

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
    if (!unit) return [409, errorBody(409, M.capacity)];
    if (
      !Number.isInteger(input.durationMonths) ||
      input.durationMonths < 1 ||
      input.durationMonths > 12 ||
      !Number.isFinite(Date.parse(input.checkInAt)) ||
      Date.parse(input.checkInAt) < Date.now()
    )
      return [400, errorBody(400, M.invalid)];
    const user = currentUser(config, db);
    const draft = {
      ...input,
      contact: input.contact ?? {
        fullName: user?.name ?? "Guest",
        email: user?.email ?? "guest@example.com",
        phone: user?.phone ?? "",
      },
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
    if (!draft) return [404, errorBody(404, M.missing)];
    const existing = db.holds.find((h) => h.draftId === id && Date.parse(h.expiresAt) > Date.now());
    if (existing) return [200, envelope(existing)];
    if (
      remainingCapacity(
        db,
        draft.facilityId,
        draft.unitTypeId,
        draft.checkInAt,
        draft.rentalEndAt,
      ) === 0
    )
      return [409, errorBody(409, M.capacity)];
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
    if (!draft?.pricing || !hold) return [409, errorBody(409, M.hold)];
    if (input.paymentMethodToken === "fail") return [402, errorBody(402, M.paymentFailed)];
    const facility = db.facilities.find((f) => f.id === draft.facilityId);
    const unit = db.units.find((u) => u.unitTypeId === draft.unitTypeId);
    if (!facility || !unit) return [404, errorBody(404, M.missing)];
    const now = new Date().toISOString();
    const bookingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const code = `BK-MOCK-${bookingId.slice(0, 8).toUpperCase()}`;
    const user = currentUser(config, db);
    const userId = user?.id ?? null;
    const contact = draft.contact ?? {
      fullName: user?.name ?? "Guest",
      email: user?.email ?? "guest@example.com",
      phone: user?.phone ?? "",
    };
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
      contactName: contact.fullName,
      contactEmail: contact.email,
      contactPhone: contact.phone,
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
        contact,
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
      : [404, errorBody(404, M.missing)];
  });
  registerBookingCheckoutHandlers(mock);
}
