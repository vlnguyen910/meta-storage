import {
  INSPECTION_MESSAGES,
  INSPECTION_PHOTO_MAX_COUNT,
  type Inspection,
  type InspectionDraftInput,
  type InspectionPhotoInput,
} from "@metastorage/contracts";
import { ConflictError, NotFoundError, ValidationError } from "../../common/errors/app-error";
import { assertAssignedStaff } from "../check-ins/check-in-access";
import { CloudinaryPhotoStorage } from "./cloudinary-photo-storage";
import { assertHandoverReady } from "./handover.policy";
import { assertCompletable, assertCurrentInspection, decodePhoto } from "./inspections.policy";
import type { InspectionsRepository } from "./inspections.repository";
import type { InspectionRow, InspectionTransaction } from "./inspections.types";
import type { InspectionPhotoStorage, StoredPhoto } from "./photo-storage.types";

export class InspectionsService {
  constructor(
    private readonly repository: InspectionsRepository,
    private readonly storage: InspectionPhotoStorage = new CloudinaryPhotoStorage(),
  ) {}

  async booking(bookingId: string) {
    const booking = await this.repository.booking(bookingId);
    if (!booking) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
    return booking;
  }

  async facilityForBooking(bookingId: string) {
    const booking = await this.repository.booking(bookingId);
    if (!booking) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
    return booking.facilityId;
  }

  async record(id: string) {
    const record = await this.repository.find(id);
    if (!record) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
    return record;
  }

  async get(id: string): Promise<Inspection> {
    const r = await this.record(id);
    const actors = await this.repository.actorNames(
      [r.createdBy, r.completedBy, r.handedOverBy].filter((id): id is string => !!id),
    );
    const actorName = (id: string | null) => actors.find((a) => a.id === id)?.name ?? null;
    return {
      id: r.id,
      bookingId: r.bookingId,
      facilityId: r.facilityId,
      physicalUnitId: r.physicalUnitId,
      unitCode: r.unitCode,
      unitAssignmentId: r.unitAssignmentId,
      verificationId: r.verificationId,
      policyVersion: "H6_V1",
      status: r.status,
      version: r.version,
      correctUnit: r.correctUnit,
      conditionNotes: r.conditionNotes,
      createdBy: r.createdBy,
      completedBy: r.completedBy,
      completedByName: actorName(r.completedBy),
      handedOverByName: actorName(r.handedOverBy),
      completedAt: r.completedAt?.toISOString() ?? null,
      handedOverAt: r.handedOverAt?.toISOString() ?? null,
      handedOverBy: r.handedOverBy ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      photos: (await this.repository.photos(id)).map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async history(bookingId: string) {
    return Promise.all((await this.repository.history(bookingId)).map((r) => this.get(r.id)));
  }

  async start(bookingId: string, userId: string) {
    const id = await this.repository.locked(bookingId, async (tx, c) => {
      assertAssignedStaff({ id: userId, role: "FACILITY_STAFF" }, c.booking?.assignedStaffId);
      assertCurrentInspection({
        bookingStatus: c.booking?.status ?? "",
        verificationStatus: c.verification?.status,
        assignmentStatus: c.assignment?.status,
        assignmentId: c.assignment?.id,
        verifiedAssignmentId: c.verification?.unitAssignmentId,
      });
      if (!c.booking || !c.assignment || !c.verification || !c.unit)
        throw new ConflictError(INSPECTION_MESSAGES.invalidContext);
      if (c.verification.staffId !== userId)
        throw new ConflictError(INSPECTION_MESSAGES.invalidContext);
      const existing = await this.repository.byVerification(tx, c.verification.id);
      if (existing) return existing.id;
      const created = await this.repository.create(tx, {
        bookingId,
        facilityId: c.booking.facilityId,
        physicalUnitId: c.unit.id,
        unitCode: c.unit.code,
        unitAssignmentId: c.assignment.id,
        verificationId: c.verification.id,
        createdBy: userId,
      });
      if (!created) throw new ConflictError(INSPECTION_MESSAGES.invalidContext);
      return created.id;
    });
    return this.get(id);
  }

  private async mutate(
    id: string,
    version: number,
    action: (tx: InspectionTransaction, r: InspectionRow) => Promise<void>,
    userId: string,
    completedRetry = false,
  ) {
    const record = await this.record(id);
    await this.repository.locked(record.bookingId, async (tx, c) => {
      assertAssignedStaff({ id: userId, role: "FACILITY_STAFF" }, c.booking?.assignedStaffId);
      const r = await this.repository.lockInspection(tx, id);
      if (!r) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
      assertCurrentInspection({
        bookingStatus: c.booking?.status ?? "",
        verificationStatus: c.verification?.status,
        assignmentStatus: c.assignment?.status,
        assignmentId: c.assignment?.id,
        verifiedAssignmentId: c.verification?.unitAssignmentId,
      });
      if (
        c.verification?.staffId !== userId ||
        c.verification?.id !== r.verificationId ||
        c.assignment?.id !== r.unitAssignmentId ||
        c.assignment?.physicalUnitId !== r.physicalUnitId
      )
        throw new ConflictError(INSPECTION_MESSAGES.invalidContext);
      if (r.status === "COMPLETED") {
        if (completedRetry) return;
        throw new ConflictError(INSPECTION_MESSAGES.immutable);
      }
      if (r.version !== version) throw new ConflictError(INSPECTION_MESSAGES.stale);
      await action(tx, r);
      await this.repository.updateInspection(tx, id, {
        version: r.version + 1,
        updatedAt: new Date(),
      });
    });
    return this.get(id);
  }

  save(id: string, input: InspectionDraftInput, userId: string) {
    return this.mutate(
      id,
      input.version,
      async (tx) => {
        await this.repository.updateInspection(tx, id, {
          correctUnit: input.correctUnit,
          conditionNotes: input.conditionNotes.trim(),
        });
      },
      userId,
    );
  }

  async upload(id: string, input: InspectionPhotoInput, userId: string) {
    const bytes = decodePhoto(input.mimeType, input.dataBase64);
    let asset: StoredPhoto | undefined;
    try {
      return await this.mutate(
        id,
        input.version,
        async (tx) => {
          const photos = await this.repository.photoIds(tx, id);
          if (photos.length >= INSPECTION_PHOTO_MAX_COUNT)
            throw new ValidationError(INSPECTION_MESSAGES.photoLimit);
          asset = await this.storage.upload(id, input.mimeType, input.dataBase64);
          await this.repository.insertPhoto(tx, {
            inspectionId: id,
            uploadedBy: userId,
            filename: input.filename,
            mimeType: input.mimeType,
            byteSize: bytes.length,
            cloudinaryPublicId: asset.publicId,
            cloudinaryFormat: asset.format,
          });
        },
        userId,
      );
    } catch (error) {
      if (asset) {
        // mutate may commit successfully and then fail while loading the response.
        // Never delete evidence that has already been persisted.
        try {
          const persisted = await this.repository.photoByPublicId(asset.publicId);
          if (!persisted) await this.storage.remove(asset.publicId);
        } catch {
          console.error(
            "Inspection photo cleanup could not be completed; reconciliation required.",
          );
        }
      }
      throw error;
    }
  }

  async removePhoto(id: string, photoId: string, version: number, userId: string) {
    const photo = await this.repository.photo(id, photoId);
    const result = await this.mutate(
      id,
      version,
      async (tx) => {
        const deleted = await this.repository.deletePhoto(tx, id, photoId);
        if (!deleted.length) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
      },
      userId,
    );
    if (photo?.cloudinaryPublicId) {
      try {
        await this.storage.remove(photo.cloudinaryPublicId);
      } catch {
        console.error("Removed inspection photo requires Cloudinary cleanup.");
      }
    }
    return result;
  }

  complete(id: string, version: number, userId: string) {
    return this.mutate(
      id,
      version,
      async (tx, r) => {
        const photos = await this.repository.photoIds(tx, id);
        assertCompletable(r.correctUnit, r.conditionNotes, photos.length);
        await this.repository.updateInspection(tx, id, {
          status: "COMPLETED",
          completedAt: new Date(),
          completedBy: userId,
        });
      },
      userId,
      true,
    );
  }

  async handover(id: string, version: number, userId: string) {
    const initial = await this.record(id);
    await this.repository.locked(initial.bookingId, async (tx, c) => {
      assertAssignedStaff({ id: userId, role: "FACILITY_STAFF" }, c.booking?.assignedStaffId);
      const r = await this.repository.lockInspection(tx, id);
      if (!r || !c.booking) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
      const existing = await this.repository.rental(tx, c.booking.id);
      if (r.handedOverAt && c.booking.status === "CHECKED_IN" && existing) return;
      if (r.version !== version) throw new ConflictError(INSPECTION_MESSAGES.stale);
      const payment = await this.repository.payment(tx, c.booking.id);
      assertHandoverReady({
        record: r,
        booking: c.booking,
        assignment: c.assignment,
        verification: c.verification,
        paymentStatus: payment?.status,
        userId,
      });
      const unit = await this.repository.lockUnit(tx, r.physicalUnitId);
      if (
        !unit ||
        ["MAINTENANCE", "INACTIVE", "LOCKED", "OCCUPIED", "RETURN_PENDING", "INSPECTION"].includes(
          unit.status,
        )
      )
        throw new ConflictError(INSPECTION_MESSAGES.handoverInvalid);
      if (await this.repository.activeRental(tx, r.physicalUnitId))
        throw new ConflictError(INSPECTION_MESSAGES.rentalConflict);
      await this.repository.activateRental(tx, c.booking, r, userId, new Date());
    });
    return this.get(id);
  }

  async photo(id: string, photoId: string) {
    const p = await this.repository.photo(id, photoId);
    if (!p) throw new NotFoundError(INSPECTION_MESSAGES.notFound);
    return {
      id: p.id,
      filename: p.filename,
      mimeType: p.mimeType,
      byteSize: p.byteSize,
      createdAt: p.createdAt.toISOString(),
      ...(p.cloudinaryPublicId && p.cloudinaryFormat
        ? { url: this.storage.readUrl(p.cloudinaryPublicId, p.cloudinaryFormat) }
        : { dataBase64: p.dataBase64 ?? "" }),
    };
  }
}
