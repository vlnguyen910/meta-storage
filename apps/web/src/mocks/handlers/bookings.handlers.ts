import {
  type AssignBookingStaffInput,
  type AssignPhysicalUnitInput,
  type CheckInLookupInput,
  type PhysicalUnitAssignment,
  type RequestGuestAccessLink,
  StorageUnitStatus,
  UserRole,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import {
  canManageBooking,
  canReadBooking,
  invalidateVerification,
  lookupResult,
} from "../core/flow";
import { currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
export function registerBookingHandlers(mock: MockAdapter): void {
  mock.onPost("/booking/access-link").reply((config) => {
    parseBody<RequestGuestAccessLink>(config.data);
    return [202, envelope({ message: M.guestAccessLinkRequested })];
  });
  mock.onGet(/\/facilities\/[^/]+\/staff$/).reply((config) => {
    const db = getMockDatabase();
    const facilityId = config.url?.split("/")[2];
    return [
      200,
      envelope(
        db.users
          .filter(
            (u) =>
              u.role === UserRole.FACILITY_STAFF &&
              u.assignedFacilityIds.includes(facilityId ?? ""),
          )
          .map(({ password: _password, assignedFacilityIds: _ids, ...u }) => ({
            ...u,
            isActive: true,
          })),
      ),
    ];
  });
  mock.onGet(/\/facilities\/[^/]+\/bookings$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const facilityId = config.url?.split("/")[2];
    if (!user) return [401, errorBody(401, M.forbidden)];
    return [
      200,
      envelope(db.bookings.filter((b) => b.facilityId === facilityId && canReadBooking(user, b))),
    ];
  });
  mock.onGet(/^(\/staff\/tasks|\/bookings\/assigned-to-me)$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    if (user?.role !== UserRole.FACILITY_STAFF) return [403, errorBody(403, M.forbidden)];
    return [
      200,
      envelope(
        db.bookings.filter(
          (b) =>
            canReadBooking(user, b) &&
            (!config.params?.facilityId || b.facilityId === config.params.facilityId),
        ),
      ),
    ];
  });
  mock.onPost("/check-ins/lookup").reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const input = parseBody<CheckInLookupInput>(config.data);
    const value = input.value.trim().toLowerCase();
    const booking = db.bookings.find((b) =>
      input.type === "BOOKING_CODE"
        ? b.bookingCode.toLowerCase() === value
        : value.includes(b.id.toLowerCase()),
    );
    if (!booking) return [404, errorBody(404, M.missing)];
    if (!canReadBooking(user, booking)) return [403, errorBody(403, M.forbidden)];
    return [200, envelope(lookupResult(db, booking))];
  });
  mock.onPost(/\/check-ins\/[^/]+\/confirm$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    if (!booking) return [404, errorBody(404, M.missing)];
    if (user?.role !== UserRole.FACILITY_STAFF || !canReadBooking(user, booking))
      return [403, errorBody(403, M.forbidden)];
    const result = lookupResult(db, booking);
    if (!result.eligibility.canProceed || !booking.assignedUnit)
      return [409, errorBody(409, M.notReady)];
    if (!result.verification)
      db.verifications.push({
        id: crypto.randomUUID(),
        bookingId: booking.id,
        facilityId: booking.facilityId,
        staffId: user.id,
        unitAssignmentId: booking.assignedUnit.id,
        status: "VERIFIED",
        verifiedAt: new Date().toISOString(),
        consumedAt: null,
        invalidatedAt: null,
        invalidatedReason: null,
      });
    saveMockDatabase(db);
    return [200, envelope(lookupResult(db, booking))];
  });
  mock.onGet(/\/bookings\/[^/]+\/eligible-units$/).reply((config) => {
    const db = getMockDatabase();
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    if (!booking) return [404, errorBody(404, M.missing)];
    if (!canManageBooking(currentUser(config, db), booking))
      return [403, errorBody(403, M.forbidden)];
    return [
      200,
      envelope(
        db.units
          .filter((u) => u.facilityId === booking.facilityId && u.unitTypeId === booking.unitTypeId)
          .map((u) => ({ ...u, isAvailableForPeriod: u.status === "AVAILABLE" })),
      ),
    ];
  });
  mock.onPost(/\/bookings\/[^/]+\/assign-unit$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    const body = parseBody<AssignPhysicalUnitInput>(config.data);
    if (!booking) return [404, errorBody(404, M.missing)];
    if (!canManageBooking(user, booking)) return [403, errorBody(403, M.forbidden)];
    const unit = db.units.find(
      (u) =>
        u.id === body.physicalUnitId &&
        u.facilityId === booking.facilityId &&
        u.unitTypeId === booking.unitTypeId,
    );
    if (booking.status !== "CONFIRMED" || !unit || unit.status !== "AVAILABLE")
      return [409, errorBody(409, M.capacity)];
    const old = db.units.find((u) => u.id === booking.assignedUnit?.physicalUnitId);
    if (old) old.status = StorageUnitStatus.AVAILABLE;
    const assignment: PhysicalUnitAssignment = {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      physicalUnitId: unit.id,
      physicalUnitCode: unit.code,
      assignedBy: user?.id ?? "",
      assignerName: user?.name ?? "",
      status: "ACTIVE",
      assignedAt: new Date().toISOString(),
      endedAt: null,
      reason: body.reason ?? null,
    };
    invalidateVerification(db, booking);
    booking.assignedUnit = assignment;
    unit.status = StorageUnitStatus.RESERVED;
    saveMockDatabase(db);
    return [200, envelope(assignment)];
  });
  mock.onPost(/\/bookings\/[^/]+\/assign-staff$/).reply((config) => {
    const db = getMockDatabase();
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    const body = parseBody<AssignBookingStaffInput>(config.data);
    if (!booking) return [404, errorBody(404, M.missing)];
    if (!canManageBooking(currentUser(config, db), booking))
      return [403, errorBody(403, M.forbidden)];
    const staff = db.users.find(
      (u) =>
        u.id === body.staffId &&
        u.role === UserRole.FACILITY_STAFF &&
        u.assignedFacilityIds.includes(booking.facilityId),
    );
    if (!staff || booking.status !== "CONFIRMED") return [409, errorBody(409, M.forbidden)];
    if (booking.assignedStaff?.id !== staff.id) invalidateVerification(db, booking);
    booking.assignedStaff = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone ?? null,
      role: UserRole.FACILITY_STAFF,
      isActive: true,
    };
    saveMockDatabase(db);
    return [200, envelope(booking)];
  });
  mock.onGet(/\/bookings\/[^/]+$/).reply((config) => {
    const db = getMockDatabase();
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    if (!booking) return [404, errorBody(404, M.missing)];
    if (!canReadBooking(currentUser(config, db), booking))
      return [403, errorBody(403, M.forbidden)];
    return [200, envelope(booking)];
  });
}
