import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryAdapter } from "../../src/common/adapters/storage/cloudinary.adapter";
import { CloudinaryPhotoStorage } from "../../src/common/adapters/storage/cloudinary-photo.storage";

const credentials = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
};
const adapter = new CloudinaryAdapter(credentials);
afterEach(() => {
  // Restore only spies installed by this suite; never issue real provider calls.
  for (const spy of spies.splice(0)) spy.mockRestore();
});
const spies: Array<{ mockRestore(): void }> = [];

describe("Cloudinary private storage boundary", () => {
  test("photo deletion specifies the image resource type", async () => {
    const remove = spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "not found" });
    spies.push(remove);
    await new CloudinaryPhotoStorage(adapter).remove("photo/id");
    expect(remove.mock.calls[0]?.[1]).toMatchObject({ resource_type: "image" });
  });

  test("keeps authenticated image uploads and five-minute download URLs", async () => {
    const upload = spyOn(cloudinary.uploader, "upload").mockImplementation(
      async (_source, options) => ({ public_id: options?.public_id, format: "png" }) as never,
    );
    spies.push(upload);
    const storage = new CloudinaryPhotoStorage(adapter);
    const result = await storage.upload("inspection", "image/png", "AA==");
    expect(result.publicId).toStartWith("metastorage/inspections/inspection/");
    expect(upload.mock.calls[0]?.[1]).toMatchObject({
      resource_type: "image",
      type: "authenticated",
      overwrite: false,
    });
    const url = new URL(storage.readUrl(result.publicId, result.format));
    expect(Number(url.searchParams.get("expires_at")) - Math.floor(Date.now() / 1000)).toBe(300);
  });

  test("unconfigured storage and provider failures return domain errors", async () => {
    const upload = spyOn(cloudinary.uploader, "upload").mockRejectedValue(new Error("secret=url"));
    spies.push(upload);
    await expect(
      new CloudinaryPhotoStorage(adapter).upload("id", "image/png", "AA=="),
    ).rejects.toMatchObject({ statusCode: 503, code: "PHOTO_STORAGE_UNAVAILABLE" });
  });
});
