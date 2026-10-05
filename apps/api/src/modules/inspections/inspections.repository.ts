import {
  and,
  bookings,
  checkInVerifications,
  type Database,
  desc,
  eq,
  handoverInspections,
  inArray,
  inspectionPhotos,
  payments,
  rentals,
  storageUnits,
  unitAssignments,
  users,
} from "@metastorage/database";
import { bookingReadFields } from "../bookings/bookings.projection";
import type { BookingReadRecord } from "../bookings/bookings.types";
import type { InspectionRow, InspectionTransaction, NewInspectionRow } from "./inspections.types";

export class InspectionsRepository {
  constructor(readonly db: Database) {}

  async booking(bookingId: string) {
    const [booking] = await this.db
      .select(bookingReadFields)
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    return booking;
  }

  async find(id: string) {
    const [record] = await this.db
      .select()
      .from(handoverInspections)
      .where(eq(handoverInspections.id, id));
    return record;
  }

  async history(bookingId: string) {
    return this.db
      .select()
      .from(handoverInspections)
      .where(eq(handoverInspections.bookingId, bookingId))
      .orderBy(desc(handoverInspections.createdAt));
  }

  async actorNames(ids: string[]) {
    return this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, ids));
  }

  async photos(id: string) {
    // Never load photo bytes into list/detail responses.
    return this.db
      .select({
        id: inspectionPhotos.id,
        filename: inspectionPhotos.filename,
        mimeType: inspectionPhotos.mimeType,
        byteSize: inspectionPhotos.byteSize,
        createdAt: inspectionPhotos.createdAt,
      })
      .from(inspectionPhotos)
      .where(eq(inspectionPhotos.inspectionId, id));
  }

  async photo(inspectionId: string, photoId: string) {
    const [record] = await this.db
      .select()
      .from(inspectionPhotos)
      .where(
        and(eq(inspectionPhotos.inspectionId, inspectionId), eq(inspectionPhotos.id, photoId)),
      );
    return record;
  }

  async photoByPublicId(publicId: string) {
    const [photo] = await this.db
      .select({ id: inspectionPhotos.id })
      .from(inspectionPhotos)
      .where(eq(inspectionPhotos.cloudinaryPublicId, publicId));
    return photo;
  }

  async locked<T>(
    bookingId: string,
    action: (
      tx: InspectionTransaction,
      context: Awaited<ReturnType<InspectionsRepository["context"]>>,
    ) => Promise<T>,
  ) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");
      return action(tx, await this.context(tx, bookingId));
    });
  }

  private async context(tx: InspectionTransaction, bookingId: string) {
    const [booking] = await tx
      .select(bookingReadFields)
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    const [verification] = await tx
      .select()
      .from(checkInVerifications)
      .where(
        and(
          eq(checkInVerifications.bookingId, bookingId),
          eq(checkInVerifications.status, "VERIFIED"),
        ),
      )
      .orderBy(desc(checkInVerifications.verifiedAt))
      .limit(1);
    const [assignment] = await tx
      .select()
      .from(unitAssignments)
      .where(and(eq(unitAssignments.bookingId, bookingId), eq(unitAssignments.status, "ACTIVE")))
      .limit(1);
    const [unit] = assignment
      ? await tx.select().from(storageUnits).where(eq(storageUnits.id, assignment.physicalUnitId))
      : [];
    return { booking, verification, assignment, unit };
  }

  async rental(tx: InspectionTransaction, bookingId: string) {
    const [rental] = await tx.select().from(rentals).where(eq(rentals.bookingId, bookingId));
    return rental;
  }

  async activeRental(tx: InspectionTransaction, unitId: string) {
    const [rental] = await tx
      .select()
      .from(rentals)
      .where(and(eq(rentals.physicalUnitId, unitId), eq(rentals.status, "ACTIVE")));
    return rental;
  }

  async payment(tx: InspectionTransaction, bookingId: string) {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return payment;
  }

  async lockUnit(tx: InspectionTransaction, unitId: string) {
    const [unit] = await tx
      .select()
      .from(storageUnits)
      .where(eq(storageUnits.id, unitId))
      .for("update");
    return unit;
  }

  async activateRental(
    tx: InspectionTransaction,
    booking: BookingReadRecord,
    record: InspectionRow,
    userId: string,
    now: Date,
  ) {
    await tx.insert(rentals).values({
      bookingId: booking.id,
      facilityId: booking.facilityId,
      physicalUnitId: record.physicalUnitId,
      status: "ACTIVE",
      startAt: booking.checkInSlotStart,
      expectedEndAt: booking.rentalEndAt,
      depositAmount: booking.depositAmount,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(bookings)
      .set({ status: "CHECKED_IN", updatedAt: now })
      .where(eq(bookings.id, booking.id));
    await tx
      .update(storageUnits)
      .set({ status: "OCCUPIED", updatedAt: now })
      .where(eq(storageUnits.id, record.physicalUnitId));
    await tx
      .update(checkInVerifications)
      .set({ status: "CONSUMED", consumedAt: now, updatedAt: now })
      .where(eq(checkInVerifications.id, record.verificationId));
    await tx
      .update(handoverInspections)
      .set({
        handedOverBy: userId,
        handedOverAt: now,
        version: (record.version ?? 0) + 1,
        updatedAt: now,
      })
      .where(eq(handoverInspections.id, record.id));
  }

  async byVerification(tx: InspectionTransaction, verificationId: string) {
    const [record] = await tx
      .select()
      .from(handoverInspections)
      .where(eq(handoverInspections.verificationId, verificationId));
    return record;
  }

  async create(tx: InspectionTransaction, input: NewInspectionRow) {
    const [record] = await tx.insert(handoverInspections).values(input).returning();
    return record;
  }

  async lockInspection(tx: InspectionTransaction, id: string) {
    const [record] = await tx
      .select()
      .from(handoverInspections)
      .where(eq(handoverInspections.id, id))
      .for("update");
    return record;
  }

  async updateInspection(tx: InspectionTransaction, id: string, fields: Partial<NewInspectionRow>) {
    await tx.update(handoverInspections).set(fields).where(eq(handoverInspections.id, id));
  }

  photoIds(tx: InspectionTransaction, inspectionId: string) {
    return tx
      .select({ id: inspectionPhotos.id })
      .from(inspectionPhotos)
      .where(eq(inspectionPhotos.inspectionId, inspectionId));
  }

  async insertPhoto(tx: InspectionTransaction, input: typeof inspectionPhotos.$inferInsert) {
    await tx.insert(inspectionPhotos).values(input);
  }

  async deletePhoto(tx: InspectionTransaction, inspectionId: string, photoId: string) {
    return tx
      .delete(inspectionPhotos)
      .where(and(eq(inspectionPhotos.inspectionId, inspectionId), eq(inspectionPhotos.id, photoId)))
      .returning({ id: inspectionPhotos.id });
  }
}
