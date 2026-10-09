import {
  ApiErrorCode,
  type Inspection,
  InspectionDraftInputSchema,
  InspectionPhotoInputSchema,
  StorageUnitStatus,
  UserRole,
} from "@metastorage/contracts";
import type { AxiosRequestConfig } from "axios";
import type MockAdapter from "axios-mock-adapter";
import { canReadBooking, lookupResult } from "../core/flow";
import { currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
import type { MockDatabase } from "../types";

function persist(db: MockDatabase, inspection: Inspection): [number, unknown] {
  try {
    saveMockDatabase(db);
    return [200, envelope(inspection)];
  } catch {
    return [507, errorBody(ApiErrorCode.VALIDATION_ERROR, M.storage)];
  }
}
function context(config: AxiosRequestConfig) {
  const db = getMockDatabase();
  const user = currentUser(config, db);
  const inspection = db.inspections.find((i) => i.id === config.url?.split("/")[2]);
  const booking = db.bookings.find((b) => b.id === inspection?.bookingId);
  return { db, user, inspection, booking };
}
export function registerInspectionHandlers(mock: MockAdapter): void {
  mock.onGet(/\/bookings\/[^/]+\/inspections$/).reply((config) => {
    const db = getMockDatabase();
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    if (!booking) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    if (!canReadBooking(currentUser(config, db), booking))
      return [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
    return [200, envelope(db.inspections.filter((i) => i.bookingId === booking.id))];
  });
  mock.onPost(/\/bookings\/[^/]+\/inspections$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const booking = db.bookings.find((b) => b.id === config.url?.split("/")[2]);
    if (!booking) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    if (user?.role !== UserRole.FACILITY_STAFF || !canReadBooking(user, booking))
      return [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
    const lookup = lookupResult(db, booking);
    const verification = lookup.verification;
    if (
      !lookup.eligibility.canProceed ||
      !booking.assignedUnit ||
      verification?.status !== "VERIFIED" ||
      verification.staffId !== user.id
    )
      return [409, errorBody(ApiErrorCode.INVALID_CHECK_IN, M.notReady)];
    const existing = db.inspections.find(
      (i) => i.bookingId === booking.id && i.verificationId === verification.id,
    );
    if (existing) return [200, envelope(existing)];
    const now = new Date().toISOString();
    const inspection: Inspection = {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      facilityId: booking.facilityId,
      physicalUnitId: booking.assignedUnit.physicalUnitId,
      unitCode: booking.assignedUnit.physicalUnitCode,
      unitAssignmentId: booking.assignedUnit.id,
      verificationId: verification.id,
      policyVersion: "H6_V1",
      status: "DRAFT",
      version: 0,
      correctUnit: null,
      conditionNotes: "",
      createdBy: user.id,
      completedBy: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      handedOverAt: null,
      handedOverBy: null,
      photos: [],
    };
    booking.handoverStage = "INSPECTING";
    db.inspections.unshift(inspection);
    return persist(db, inspection);
  });
  mock.onGet(/\/inspections\/[^/]+$/).reply((config) => {
    const { user, inspection, booking } = context(config);
    if (!inspection || !booking) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    return canReadBooking(user, booking)
      ? [200, envelope(inspection)]
      : [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
  });
  mock.onGet(/\/inspections\/[^/]+\/photos\/[^/]+$/).reply((config) => {
    const { db, user, inspection, booking } = context(config);
    const photo = db.photoContents.find(
      (p) => p.id === config.url?.split("/")[4] && p.inspectionId === inspection?.id,
    );
    if (!photo || !booking) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    return canReadBooking(user, booking)
      ? [200, envelope(photo)]
      : [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
  });
  const mutate = (
    config: AxiosRequestConfig,
    action: "save" | "upload" | "remove" | "complete" | "handover",
  ): [number, unknown] => {
    const { db, user, inspection, booking } = context(config);
    if (!inspection || !booking) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    if (user?.role !== UserRole.FACILITY_STAFF || !canReadBooking(user, booking))
      return [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
    if (action === "handover" && inspection.handedOverAt) return [200, envelope(inspection)];
    const body = parseBody<{ version: number }>(config.data);
    if (body.version !== inspection.version)
      return [409, errorBody(ApiErrorCode.RESERVATION_CONFLICT, M.stale)];
    const lookup = lookupResult(db, booking);
    if (
      !lookup.eligibility.canProceed ||
      lookup.verification?.status !== "VERIFIED" ||
      lookup.verification.id !== inspection.verificationId ||
      lookup.verification.staffId !== user.id ||
      booking.assignedUnit?.id !== inspection.unitAssignmentId
    )
      return [409, errorBody(ApiErrorCode.INVALID_CHECK_IN, M.notReady)];
    if (action !== "handover" && inspection.status !== "DRAFT")
      return [409, errorBody(ApiErrorCode.RESERVATION_CONFLICT, M.locked)];
    if (action === "save") {
      const parsed = InspectionDraftInputSchema.safeParse(parseBody(config.data));
      if (!parsed.success) return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, M.invalid)];
      inspection.correctUnit = parsed.data.correctUnit;
      inspection.conditionNotes = parsed.data.conditionNotes;
    }
    if (action === "upload") {
      const parsed = InspectionPhotoInputSchema.safeParse(parseBody(config.data));
      if (!parsed.success || inspection.photos.length >= 8)
        return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, M.invalid)];
      let byteSize: number;
      try {
        byteSize = atob(parsed.data.dataBase64).length;
      } catch {
        return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, M.invalid)];
      }
      const photo = {
        id: crypto.randomUUID(),
        filename: parsed.data.filename,
        mimeType: parsed.data.mimeType,
        byteSize,
        createdAt: new Date().toISOString(),
      };
      inspection.photos.push(photo);
      db.photoContents.push({
        ...photo,
        inspectionId: inspection.id,
        dataBase64: parsed.data.dataBase64,
      });
    }
    if (action === "remove") {
      const photoId = config.url?.split("/")[4];
      inspection.photos = inspection.photos.filter((p) => p.id !== photoId);
      db.photoContents = db.photoContents.filter((p) => p.id !== photoId);
    }
    if (action === "complete") {
      if (!inspection.correctUnit || !inspection.conditionNotes.trim() || !inspection.photos.length)
        return [409, errorBody(ApiErrorCode.RESERVATION_CONFLICT, M.incomplete)];
      booking.handoverStage = "READY_HANDOVER";
      inspection.status = "COMPLETED";
      inspection.completedAt = new Date().toISOString();
      inspection.completedBy = user.id;
      inspection.completedByName = user.name;
    }
    if (action === "handover") {
      const unit = db.units.find((u) => u.id === inspection.physicalUnitId);
      if (inspection.status !== "COMPLETED" || unit?.status !== "RESERVED")
        return [409, errorBody(ApiErrorCode.INVALID_CHECK_IN, M.notReady)];
      inspection.handedOverAt = new Date().toISOString();
      inspection.handedOverBy = user.id;
      inspection.handedOverByName = user.name;
      booking.handoverStage = "HANDED_OVER";
      booking.status = "CHECKED_IN";
      unit.status = StorageUnitStatus.OCCUPIED;
      lookup.verification.status = "CONSUMED";
      lookup.verification.consumedAt = inspection.handedOverAt;
      // lookupResult returns the persisted verification object, so this transition is saved together.
      const facility = db.facilities.find((f) => f.id === booking.facilityId);
      db.rentals.push({
        userId: booking.userId ?? null,
        id: crypto.randomUUID(),
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        facility: {
          id: booking.facilityId,
          name: booking.facilityName,
          address: facility?.address.line1 ?? "",
        },
        unitType: {
          id: booking.unitTypeId,
          name: booking.unitTypeName,
          sizeLabel: booking.unitTypeSizeLabel,
        },
        physicalUnit: { id: unit.id, code: unit.code },
        startAt: inspection.handedOverAt,
        expectedEndAt: booking.rentalEndAt,
        status: "ACTIVE",
        bookingStatus: "CHECKED_IN",
        actions: { canCancel: false, canReschedule: false, note: M.locked },
        actualReturnAt: null,
        closedAt: null,
        depositAmount: String(booking.totalAmount / (booking.requestedMonths + 1)),
        checkInSlotStart: booking.checkInSlotStart,
        checkInSlotEnd: booking.checkInSlotEnd,
        timeline: [
          { label: "Thanh toán mô phỏng", status: "DONE", at: booking.paidAt },
          { label: "Bàn giao kho", status: "DONE", at: inspection.handedOverAt },
          { label: "Trả kho", status: "UPCOMING", at: booking.rentalEndAt },
        ],
      });
    }
    inspection.version++;
    inspection.updatedAt = new Date().toISOString();
    return persist(db, inspection);
  };
  mock.onPatch(/\/inspections\/[^/]+$/).reply((c) => mutate(c, "save"));
  mock.onPost(/\/inspections\/[^/]+\/photos$/).reply((c) => mutate(c, "upload"));
  mock.onDelete(/\/inspections\/[^/]+\/photos\/[^/]+$/).reply((c) => mutate(c, "remove"));
  mock.onPost(/\/inspections\/[^/]+\/complete$/).reply((c) => mutate(c, "complete"));
  mock.onPost(/\/inspections\/[^/]+\/handover$/).reply((c) => mutate(c, "handover"));
}
