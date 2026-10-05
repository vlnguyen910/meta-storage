import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InspectionsRepository } from "../../src/modules/inspections/inspections.repository";
import { InspectionsService } from "../../src/modules/inspections/inspections.service";
import type { InspectionPhotoStorage } from "../../src/modules/inspections/photo-storage.types";

const image =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
function fixture({
  locked = false,
  stale = false,
  insertFails = false,
  responseFails = false,
  uploadFails = false,
} = {}) {
  let photo: Record<string, unknown> | undefined;
  let uploads = 0,
    removals = 0,
    committed = false;
  const record = {
    id: "inspection",
    bookingId: "booking",
    verificationId: "verification",
    unitAssignmentId: "assignment",
    physicalUnitId: "unit",
    status: locked ? "COMPLETED" : "DRAFT",
    version: stale ? 2 : 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };
  const repo = {
    find: async () => {
      if (responseFails && committed) throw new Error("Response failed");
      return record;
    },
    locked: async (_id: string, work: (tx: never, c: unknown) => Promise<unknown>) => {
      const result = await work(undefined as never, {
        booking: { status: "CONFIRMED", assignedStaffId: "staff" },
        verification: {
          id: "verification",
          staffId: "staff",
          status: "VERIFIED",
          unitAssignmentId: "assignment",
        },
        assignment: { id: "assignment", status: "ACTIVE", physicalUnitId: "unit" },
      });
      committed = true;
      return result;
    },
    lockInspection: async () => record,
    updateInspection: async (_tx: unknown, _id: string, fields: object) =>
      Object.assign(record, fields),
    photoIds: async () => (photo ? [{ id: "photo" }] : []),
    insertPhoto: async (_tx: unknown, input: Record<string, unknown>) => {
      if (insertFails) throw new Error("Insert failed");
      photo = { id: "photo", ...input, createdAt: new Date() };
    },
    actorNames: async () => [],
    photos: async () => [],
    photo: async () => photo,
    photoByPublicId: async () => (committed ? photo : undefined),
    deletePhoto: async () => {
      photo = undefined;
      return [{ id: "photo" }];
    },
  } as unknown as InspectionsRepository;
  const storage: InspectionPhotoStorage = {
    upload: async () => {
      uploads++;
      if (uploadFails) throw new Error("Provider unavailable");
      return { publicId: "private/evidence", format: "png" };
    },
    remove: async () => {
      removals++;
    },
    readUrl: () => "https://example.test/private-evidence?expires=123",
  };
  const service = new InspectionsService(repo, storage);
  const input = {
    version: 0,
    filename: "evidence.png",
    mimeType: "image/png" as const,
    dataBase64: image,
  };
  return { service, input, record, getPhoto: () => photo, counts: () => ({ uploads, removals }) };
}

describe("Cloudinary inspection evidence", () => {
  it("stores asset metadata instead of photo bytes", async () => {
    const f = fixture();
    await f.service.upload("inspection", f.input, "staff");
    assert.equal(f.getPhoto()?.cloudinaryPublicId, "private/evidence");
    assert.equal(f.getPhoto()?.dataBase64, undefined);
    const content = await f.service.photo("inspection", "photo");
    assert.match(content.url ?? "", /^https:/);
    assert.equal(content.dataBase64, undefined);
  });
  it("does not upload when a record is locked or stale", async () => {
    for (const options of [{ locked: true }, { stale: true }]) {
      const f = fixture(options);
      await assert.rejects(() => f.service.upload("inspection", f.input, "staff"));
      assert.equal(f.counts().uploads, 0);
    }
  });
  it("does not save metadata or change the version when upload fails", async () => {
    const f = fixture({ uploadFails: true });
    await assert.rejects(() => f.service.upload("inspection", f.input, "staff"));
    assert.equal(f.getPhoto(), undefined);
    assert.equal(f.record.version, 0);
  });
  it("cleans an orphaned upload when the DB insertion fails", async () => {
    const f = fixture({ insertFails: true });
    await assert.rejects(() => f.service.upload("inspection", f.input, "staff"));
    assert.equal(f.counts().removals, 1);
  });
  it("retains committed evidence if response loading fails", async () => {
    const f = fixture({ responseFails: true });
    await assert.rejects(() => f.service.upload("inspection", f.input, "staff"));
    assert.equal(f.counts().removals, 0);
    assert.ok(f.getPhoto());
  });
  it("removes the Cloudinary asset after removing draft evidence", async () => {
    const f = fixture();
    await f.service.upload("inspection", f.input, "staff");
    await f.service.removePhoto("inspection", "photo", 1, "staff");
    assert.equal(f.getPhoto(), undefined);
    assert.equal(f.counts().removals, 1);
  });
});
