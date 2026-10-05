import { INSPECTION_MESSAGES as M } from "@metastorage/contracts";
import type { CheckInVerification, UnitAssignment } from "@metastorage/database";
import { ConflictError } from "../../common/errors/app-error";
import type { BookingReadRecord } from "../bookings/bookings.types";
import type { InspectionRow } from "./inspections.types";

export function assertHandoverReady(input: {
  record: InspectionRow;
  booking: BookingReadRecord;
  assignment?: UnitAssignment;
  verification?: CheckInVerification;
  paymentStatus?: string;
  userId: string;
}) {
  const { record: r, booking: b, assignment: a, verification: v } = input;
  if (r.status !== "COMPLETED" || !r.completedAt || r.correctUnit !== true)
    throw new ConflictError(M.handoverIncomplete);
  if (
    b.status !== "CONFIRMED" ||
    !b.paidAt ||
    input.paymentStatus !== "SUCCEEDED" ||
    !a ||
    a.status !== "ACTIVE" ||
    a.id !== r.unitAssignmentId ||
    a.physicalUnitId !== r.physicalUnitId ||
    !v ||
    v.status !== "VERIFIED" ||
    v.id !== r.verificationId ||
    v.unitAssignmentId !== a.id ||
    v.staffId !== input.userId ||
    b.rentalEndAt <= b.checkInSlotStart ||
    b.rentalEndAt <= new Date()
  )
    throw new ConflictError(M.handoverInvalid);
}
