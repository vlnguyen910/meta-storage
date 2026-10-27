import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryAdapter } from "../../src/common/adapters/storage/cloudinary.adapter";
import { CloudinaryPhotoStorage } from "../../src/common/adapters/storage/cloudinary-photo.storage";
import { CloudinaryContractStorage } from "../../src/modules/contracts/cloudinary-contract.storage";

const credentials = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
};
const adapter = new CloudinaryAdapter(credentials);
const key = "contracts/booking/document.pdf";
const bytes = new TextEncoder().encode("%PDF-test-original");
afterEach(() => {
  // Restore only spies installed by this suite; never issue real provider calls.
  for (const spy of spies.splice(0)) spy.mockRestore();
});
const spies: Array<{ mockRestore(): void }> = [];

describe("Cloudinary private storage boundary", () => {
  test("uploads immutable raw PDFs under the exact key and reads original bytes", async () => {
    const upload = spyOn(cloudinary.uploader, "upload").mockResolvedValue({
      public_id: key,
      resource_type: "raw",
      type: "authenticated",
    } as never);
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(bytes));
    spies.push(upload, fetchSpy);
    const storage = new CloudinaryContractStorage(adapter);
    await storage.put(key, bytes);
    expect(upload.mock.calls[0]?.[1]).toMatchObject({
      public_id: key,
      resource_type: "raw",
      type: "authenticated",
      overwrite: false,
    });
    expect(await storage.get(key)).toEqual(bytes);
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.pathname).toContain("/raw/download");
    expect(url.searchParams.get("public_id")).toBe(key);
    expect(url.searchParams.get("type")).toBe("authenticated");
    expect(Number(url.searchParams.get("expires_at"))).toBeGreaterThan(Date.now() / 1000);
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  test("refuses collisions without destroying the existing asset", async () => {
    const upload = spyOn(cloudinary.uploader, "upload").mockResolvedValue({
      public_id: key,
      existing: true,
    } as never);
    const remove = spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" });
    spies.push(upload, remove);
    await expect(new CloudinaryContractStorage(adapter).put(key, bytes)).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTRACT_STORAGE_UNAVAILABLE",
    });
    expect(remove).not.toHaveBeenCalled();
  });

  test("deletion specifies resource type and accepts already missing objects", async () => {
    const remove = spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "not found" });
    spies.push(remove);
    await new CloudinaryContractStorage(adapter).remove(key);
    expect(remove.mock.calls[0]?.[1]).toMatchObject({
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
    await new CloudinaryPhotoStorage(adapter).remove("photo/id");
    expect(remove.mock.calls[1]?.[1]).toMatchObject({ resource_type: "image" });
  });

  test("bounds streamed bytes even without Content-Length", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("12345"));
    spies.push(fetchSpy);
    await expect(adapter.download({ publicId: key, resourceType: "raw" }, 4)).rejects.toThrow();
  });

  test("rejects HTTP failure, invalid size and truncated responses without leaking URLs", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    spies.push(fetchSpy);
    for (const response of [
      new Response("missing", { status: 404 }),
      new Response(bytes, { headers: { "content-length": "99999999" } }),
      new Response(bytes, { headers: { "content-length": "1" } }),
      new Response(null),
    ]) {
      fetchSpy.mockResolvedValueOnce(response);
      await expect(new CloudinaryContractStorage(adapter).get(key)).rejects.toMatchObject({
        statusCode: 503,
        message: expect.not.stringContaining("signature="),
      });
    }
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
    await expect(
      new CloudinaryContractStorage(new CloudinaryAdapter({})).put(key, bytes),
    ).rejects.toMatchObject({ statusCode: 503, code: "CONTRACT_STORAGE_UNAVAILABLE" });
    const upload = spyOn(cloudinary.uploader, "upload").mockRejectedValue(new Error("secret=url"));
    spies.push(upload);
    await expect(
      new CloudinaryPhotoStorage(adapter).upload("id", "image/png", "AA=="),
    ).rejects.toMatchObject({ statusCode: 503, code: "PHOTO_STORAGE_UNAVAILABLE" });
  });
});
