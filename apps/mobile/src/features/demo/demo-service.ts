import {
  type CheckInLookupResult,
  CustomerSignUpInputSchema,
  MobileInspectionInputSchema,
  type MobilePaidBooking,
  MobileRentalRequestInputSchema,
  MobileRescheduleInputSchema,
  MobileReturnReportInputSchema,
  type MobileWorkspace,
  PaymentCheckoutInputSchema,
  PaymentStatus,
  ReservationDraftInputSchema,
} from "@metastorage/contracts";
import { DEMO_MESSAGES as m } from "./demo.messages";
import type { DemoDatabase } from "./demo.types";
import {
  canVerifyBooking,
  demoCheckInDeadlineAt,
  demoCheckInOpensAt,
  remainingDemoCapacity,
  requireCompleteChecklist,
  requirePeriod,
  requireReturnChecklist,
  validateReschedule,
} from "./demo-policy";
import { addMonths, createMobileSeed, newDemoId } from "./demo-seed";

function account(db: DemoDatabase) {
  return db.accounts.find((a) => a.id === db.sessionId);
}
function owner(db: DemoDatabase) {
  return account(db)?.id ?? db.guestId;
}
function customerBooking(db: DemoDatabase, id: string) {
  const user = account(db);
  const b = db.bookings.find((item) => item.id === id);
  if (!b) throw new Error(m.missing);
  if (user?.role !== "CUSTOMER" || b.ownerId !== owner(db)) throw new Error(m.forbidden);
  return b;
}
function staffBooking(db: DemoDatabase, id: string) {
  const user = account(db);
  const b = db.bookings.find((item) => item.id === id);
  if (!b) throw new Error(m.missing);
  if (
    user?.role !== "FACILITY_STAFF" ||
    !user.facilityIds.includes(b.facilityId) ||
    b.assignedStaff?.id !== user.id
  )
    throw new Error(m.forbidden);
  return b;
}
export function mobileWorkspace(db: DemoDatabase): MobileWorkspace {
  const user = account(db);
  const {
    password: _password,
    verified: _verified,
    ...session
  } = user ?? { password: "", verified: false };
  const bookings =
    user?.role === "FACILITY_STAFF"
      ? db.bookings.filter(
          (b) => user.facilityIds.includes(b.facilityId) && b.assignedStaff?.id === user.id,
        )
      : db.bookings.filter((b) => b.ownerId === owner(db));
  const allowed = new Set(bookings.map((b) => b.id));
  const rentals = db.rentals.filter((r) => allowed.has(r.bookingId));
  const rentalIds = new Set(rentals.map((r) => r.id));
  return {
    session: user ? (session as MobileWorkspace["session"]) : null,
    guestId: db.guestId,
    facilities: db.facilities,
    unitTypes: db.unitTypes,
    bookings,
    drafts: db.drafts.filter((d) => d.ownerId === owner(db)),
    inspections: db.inspections.filter((i) => allowed.has(i.bookingId)),
    rentals,
    requests: db.requests.filter(
      (r) =>
        rentalIds.has(r.rentalId) &&
        (user?.role !== "FACILITY_STAFF" || r.assignedStaffId === user.id),
    ),
  };
}
export function handleMobileRequest(
  db: DemoDatabase,
  method: string,
  url: string,
  body: unknown,
): unknown {
  const parts = url.split("/").filter(Boolean);
  const input = (body ?? {}) as Record<string, unknown>;
  if (method === "GET" && url === "/demo/workspace") return mobileWorkspace(db);
  if (method === "POST" && url === "/demo/reset") {
    if (input.confirmed !== true) throw new Error(m.invalid);
    Object.assign(db, createMobileSeed());
    return mobileWorkspace(db);
  }
  if (
    method === "GET" &&
    parts[0] === "catalog" &&
    parts[1] === "facilities" &&
    parts[3] === "unit-types"
  ) {
    const start = String(input.checkInAt || new Date(Date.now() + 86400000).toISOString());
    const months = Number(input.durationMonths || 1);
    requirePeriod(start, months);
    return db.unitTypes
      .filter((t) => t.facilityId === parts[2])
      .map((t) => ({
        ...t,
        availableCount: remainingDemoCapacity(
          db,
          t.facilityId,
          t.unitTypeId,
          start,
          addMonths(start, months),
          String(input.draftId ?? ""),
        ),
      }));
  }
  if (method === "POST" && url === "/demo/login") {
    const user = db.accounts.find(
      (a) =>
        a.email.toLowerCase() === String(input.email).trim().toLowerCase() &&
        a.password === input.password,
    );
    if (!user) throw new Error(m.credentials);
    if (!user.verified) throw new Error(m.verify);
    db.sessionId = user.id;
    return mobileWorkspace(db).session;
  }
  if (method === "POST" && url === "/demo/logout") {
    db.sessionId = null;
    return null;
  }
  if (method === "POST" && url === "/auth/customer-sign-up") {
    const parsed = CustomerSignUpInputSchema.safeParse(body);
    if (!parsed.success) throw new Error(m.invalid);
    if (db.accounts.some((a) => a.email === parsed.data.email)) throw new Error(m.duplicate);
    db.accounts.push({
      id: newDemoId(),
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
      role: "CUSTOMER",
      facilityIds: [],
      verified: false,
    });
    return { message: m.success };
  }
  if (method === "POST" && url === "/demo/verify-email") {
    const a = db.accounts.find((a) => a.email === input.email);
    if (!a || a.verified) throw new Error(m.invalid);
    a.verified = true;
    return null;
  }
  if (method === "POST" && url === "/auth/forgot-password") {
    const email = String(input.email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@") || email.length > 320) throw new Error(m.invalid);
    db.recoveryRequestedAtByEmail ??= {};
    db.recoveryRequestedAtByEmail[email] = new Date().toISOString();
    return null;
  }
  if (method === "POST" && url === "/reservations/drafts") {
    if (account(db)?.role === "FACILITY_STAFF") throw new Error(m.forbidden);
    const parsed = ReservationDraftInputSchema.safeParse(body);
    if (!parsed.success) throw new Error(m.invalid);
    const d = parsed.data;
    requirePeriod(d.checkInAt, d.durationMonths);
    const type = db.unitTypes.find(
      (t) => t.facilityId === d.facilityId && t.unitTypeId === d.unitTypeId,
    );
    if (!type) throw new Error(m.missing);
    const end = addMonths(d.checkInAt, d.durationMonths);
    if (!remainingDemoCapacity(db, d.facilityId, d.unitTypeId, d.checkInAt, end))
      throw new Error(m.capacity);
    const draft = {
      ...d,
      id: newDemoId(),
      ownerId: owner(db),
      rentalEndAt: end,
      draftAccessToken: `demo-${newDemoId()}`,
      status: "DRAFT" as const,
      pricingStatus: "PRICED" as const,
      pricing: {
        monthlyRateSnapshot: String(type.monthlyPrice),
        rentalFeeAmount: String(type.monthlyPrice * d.durationMonths),
        depositAmount: String(type.monthlyPrice),
        totalAmount: String(type.monthlyPrice * (d.durationMonths + 1)),
        currency: "VND",
      },
      hold: null,
    };
    db.drafts.push(draft);
    return draft;
  }
  if (parts[0] === "reservations" && parts[1] === "drafts" && method === "POST") {
    const draft = db.drafts.find((d) => d.id === parts[2] && d.ownerId === owner(db));
    if (!draft) throw new Error(m.forbidden);
    if (parts[3] === "hold") {
      if (db.bookings.some((booking) => booking.id === draft.id)) throw new Error(m.alreadyPaid);
      if (draft.draftAccessToken !== input.draftAccessToken) throw new Error(m.forbidden);
      if (draft.hold && Date.parse(draft.hold.expiresAt) > Date.now()) return draft.hold;
      requirePeriod(draft.checkInAt, draft.durationMonths);
      if (
        !remainingDemoCapacity(
          db,
          draft.facilityId,
          draft.unitTypeId,
          draft.checkInAt,
          draft.rentalEndAt,
          draft.id,
        )
      )
        throw new Error(m.capacity);
      draft.hold = {
        holdId: newDemoId(),
        holdToken: `demo-${newDemoId()}`,
        unitTypeId: draft.unitTypeId,
        startsAt: draft.checkInAt,
        endsAt: draft.rentalEndAt,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        status: "ACTIVE",
      };
      return draft.hold;
    }
    if (parts[3] === "pay") {
      const parsed = PaymentCheckoutInputSchema.safeParse(body);
      if (!parsed.success) throw new Error(m.invalid);
      const existing = db.bookings.find((b) => b.id === draft.id);
      if (existing) return paidResult(existing, draft);
      if (
        !draft.hold ||
        draft.hold.holdToken !== parsed.data.holdToken ||
        Date.parse(draft.hold.expiresAt) <= Date.now()
      )
        throw new Error(m.expired);
      if (parsed.data.paymentMethodToken === "fail") throw new Error(m.failedPayment);
      if (!draft.pricing) throw new Error(m.invalid);
      const type = db.unitTypes.find((t) => t.unitTypeId === draft.unitTypeId);
      const facility = db.facilities.find((f) => f.id === draft.facilityId);
      if (!type || !facility) throw new Error(m.missing);
      const now = new Date().toISOString();
      const b: MobilePaidBooking = {
        id: draft.id,
        bookingCode: `BK-MOCK-${draft.id.slice(0, 8).toUpperCase()}`,
        ownerId: draft.ownerId,
        facilityId: facility.id,
        facilityName: facility.name,
        unitTypeId: type.unitTypeId,
        unitTypeName: type.unitType,
        unitTypeSizeLabel: type.sizeLabel,
        contactName: draft.contact.fullName,
        contactPhone: draft.contact.phone,
        contactEmail: draft.contact.email,
        checkInSlotStart: draft.checkInAt,
        checkInSlotEnd: new Date(Date.parse(draft.checkInAt) + 7200000).toISOString(),
        rentalEndAt: draft.rentalEndAt,
        requestedMonths: draft.durationMonths,
        rentalAmount: Number(draft.pricing.rentalFeeAmount),
        depositAmount: Number(draft.pricing.depositAmount),
        totalAmount: Number(draft.pricing.totalAmount),
        status: "CONFIRMED",
        paidAt: now,
        createdAt: now,
        rescheduleCount: 0,
        history: [],
        assignedStaff: null,
        assignedUnit: null,
        handoverStage: "WAITING_CUSTOMER",
      };
      db.bookings.unshift(b);
      draft.hold = null;
      return paidResult(b, draft);
    }
  }
  if (parts[0] === "demo" && parts[1] === "bookings" && method === "POST") {
    const id = parts[2];
    if (parts[3] === "inspection") {
      const b = staffBooking(db, id);
      if (!canVerifyBooking(b) || !["ASSIGNED", "IN_PROGRESS"].includes(b.taskStatus ?? "ASSIGNED"))
        throw new Error(m.inspection);
      b.taskStatus = "IN_PROGRESS";
      let inspection = db.inspections.find((i) => i.bookingId === id);
      if (!inspection) {
        inspection = {
          id: newDemoId(),
          bookingId: id,
          staffId: account(db)?.id ?? "",
          version: 0,
          status: "DRAFT",
          checklist: [],
          notes: "",
          photos: [],
        };
        db.inspections.push(inspection);
        b.handoverStage = "INSPECTING";
      }
      return inspection;
    }
    const b = customerBooking(db, id);
    if (parts[3] === "reschedule") {
      const parsed = MobileRescheduleInputSchema.safeParse(body);
      if (!parsed.success) throw new Error(m.invalid);
      validateReschedule(db, b, parsed.data.checkInAt);
      b.history.push({
        action: "RESCHEDULE",
        at: new Date().toISOString(),
        previousSlot: b.checkInSlotStart,
      });
      b.checkInSlotStart = parsed.data.checkInAt;
      b.checkInSlotEnd = new Date(Date.parse(b.checkInSlotStart) + 7200000).toISOString();
      b.rentalEndAt = addMonths(b.checkInSlotStart, b.requestedMonths);
      b.rescheduleCount++;
      return b;
    }
    if (parts[3] === "cancel") {
      if (
        b.status !== "CONFIRMED" ||
        db.inspections.some((inspection) => inspection.bookingId === id) ||
        db.rentals.some((r) => r.bookingId === id)
      )
        throw new Error(m.cancel);
      b.history.push({
        action: "CANCEL",
        at: new Date().toISOString(),
        previousSlot: b.checkInSlotStart,
      });
      b.status = "CANCELLED";
      return b;
    }
  }
  if (
    parts[0] === "bookings" &&
    parts[1] === "check-in" &&
    parts[2] === "lookup" &&
    method === "POST"
  ) {
    const b = db.bookings.find(
      (b) => b.bookingCode === input.value || `demo-qr-${b.id}` === input.value,
    );
    if (!b) throw new Error(m.missing);
    staffBooking(db, b.id);
    return checkInResult(b);
  }
  if (parts[0] === "demo" && parts[1] === "inspections") {
    const i = db.inspections.find((i) => i.id === parts[2]);
    if (!i) throw new Error(m.missing);
    const b = staffBooking(db, i.bookingId);
    if (parts[3] === "handover" && i.status === "HANDED_OVER") return i;
    if (input.version !== i.version) throw new Error(m.stale);
    if (method === "PATCH") {
      if (i.status !== "DRAFT") throw new Error(m.inspection);
      const parsed = MobileInspectionInputSchema.safeParse(body);
      if (!parsed.success) throw new Error(m.invalid);
      Object.assign(i, parsed.data, { version: i.version + 1 });
      return i;
    }
    if (parts[3] === "complete" && method === "POST") {
      if (i.status !== "DRAFT" || !canVerifyBooking(b)) throw new Error(m.inspection);
      requireCompleteChecklist(i.checklist);
      i.status = "COMPLETED";
      i.version++;
      b.handoverStage = "READY_HANDOVER";
      return i;
    }
    if (parts[3] === "handover" && method === "POST") {
      if (i.status !== "COMPLETED" || !canVerifyBooking(b) || input.confirmed !== true)
        throw new Error(m.inspection);
      requireCompleteChecklist(i.checklist);
      i.status = "HANDED_OVER";
      i.version++;
      b.status = "CHECKED_IN";
      b.taskStatus = "COMPLETED";
      b.handoverStage = "HANDED_OVER";
      db.rentals.push({
        id: newDemoId(),
        bookingId: b.id,
        ownerId: b.ownerId,
        status: "ACTIVE",
        startedAt: new Date().toISOString(),
      });
      return i;
    }
  }
  if (
    parts[0] === "demo" &&
    parts[1] === "rentals" &&
    parts[3] === "requests" &&
    method === "POST"
  ) {
    const rental = db.rentals.find((r) => r.id === parts[2] && r.ownerId === owner(db));
    if (!rental || account(db)?.role !== "CUSTOMER") throw new Error(m.forbidden);
    const parsed = MobileRentalRequestInputSchema.safeParse(body);
    if (!parsed.success) throw new Error(m.invalid);
    const d = parsed.data;
    const b = customerBooking(db, rental.bookingId);
    if (Date.parse(d.preferredAt) <= Date.now()) throw new Error(m.period);
    if (
      d.type === "CHANGE" &&
      !db.unitTypes.some(
        (t) => t.unitTypeId === d.targetUnitTypeId && t.facilityId === b.facilityId,
      )
    )
      throw new Error(m.invalid);
    // Retrying an identical local request reuses its record; distinct requests await FM policy.
    const existing = db.requests.find(
      (r) =>
        r.rentalId === rental.id &&
        r.type === d.type &&
        r.reason === d.reason &&
        r.preferredAt === d.preferredAt &&
        r.targetUnitTypeId === d.targetUnitTypeId,
    );
    if (existing) return existing;
    const request = {
      ...d,
      id: newDemoId(),
      rentalId: rental.id,
      ownerId: rental.ownerId,
      status: "AWAITING_FM" as const,
      assignedStaffId: null,
      report: null,
    };
    db.requests.push(request);
    return request;
  }
  if (
    parts[0] === "demo" &&
    parts[1] === "requests" &&
    parts[3] === "report" &&
    method === "POST"
  ) {
    const request = db.requests.find((r) => r.id === parts[2]);
    const user = account(db);
    if (
      request?.type !== "RETURN" ||
      request.status !== "ASSIGNED" ||
      user?.role !== "FACILITY_STAFF" ||
      request.assignedStaffId !== user.id
    )
      throw new Error(m.forbidden);
    const rental = db.rentals.find((r) => r.id === request.rentalId);
    if (!rental) throw new Error(m.missing);
    staffBooking(db, rental.bookingId);
    const parsed = MobileReturnReportInputSchema.safeParse(body);
    if (!parsed.success) throw new Error(m.invalid);
    requireReturnChecklist(parsed.data.checklist);
    request.report = parsed.data;
    request.status = "REPORT_SENT";
    return request;
  }
  throw new Error(m.missing);
}
function checkInResult(b: MobilePaidBooking): CheckInLookupResult {
  const checkInDeadlineAt = demoCheckInDeadlineAt(b.checkInSlotStart).toISOString();
  const canProceed = canVerifyBooking(b);
  return {
    booking: { ...b, checkInDeadlineAt },
    payment: {
      status: b.paidAt ? PaymentStatus.SUCCEEDED : null,
      paidAt: b.paidAt,
      totalAmount: b.totalAmount,
      rentalFeeAmount: b.rentalAmount,
      depositAmount: b.depositAmount,
      currency: "VND",
    },
    assignedUnit: b.assignedUnit ?? null,
    checkInReadiness: {
      canProceed,
      reasons: canProceed
        ? []
        : b.status !== "CONFIRMED"
          ? ["INVALID_BOOKING_STATUS"]
          : !b.assignedUnit
            ? ["UNIT_NOT_ASSIGNED"]
            : Date.now() < demoCheckInOpensAt(b.checkInSlotStart).getTime()
              ? ["TOO_EARLY"]
              : ["DEADLINE_PASSED"],
    },
  };
}
function paidResult(b: MobilePaidBooking, draft: DemoDatabase["drafts"][number]) {
  return {
    id: b.id,
    status: "SUCCEEDED",
    provider: "mock",
    providerPaymentId: b.id,
    paidAt: b.paidAt,
    pricing: draft.pricing,
    booking: {
      id: b.id,
      bookingCode: b.bookingCode,
      facilityId: b.facilityId,
      unitTypeId: b.unitTypeId,
      checkInAt: b.checkInSlotStart,
      rentalEndAt: b.rentalEndAt,
      durationMonths: b.requestedMonths,
      status: b.status,
      paidAt: b.paidAt,
      contact: draft.contact,
      pricing: draft.pricing,
    },
    confirmation: {
      bookingId: b.id,
      bookingCode: b.bookingCode,
      qrToken: `demo-qr-${b.id}`,
      qrUrl: `metastorage://booking/${b.id}`,
      facility: { name: b.facilityName, address: "" },
      checkInSlotStart: b.checkInSlotStart,
      checkInSlotEnd: b.checkInSlotEnd,
      rentalEndAt: b.rentalEndAt,
      unitTypeName: b.unitTypeName,
      sizeLabel: b.unitTypeSizeLabel,
      durationMonths: b.requestedMonths,
      emailStatus: "PENDING",
    },
  };
}
