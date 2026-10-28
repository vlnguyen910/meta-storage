import { describe, expect, test } from "bun:test";
import {
  INSPECTION_PHOTO_MAX_BYTES,
  InspectionEvidenceInputSchema,
  SUPPORT_IMAGE_MAX_BYTES,
} from "@metastorage/contracts";
import { PICK_IMAGE as M } from "../src/lib/pick-image.messages";
import { prepareImageUpload } from "../src/lib/prepare-image-upload";

const JPEG =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDlqKKKo+UP/9k=";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQqYgCAAGKAOcEpPhFAAAAAElFTkSuQmCC";
const WEBP = "UklGRjIAAABXRUJQVlA4ICYAAABwAQCdASoBAAEAAUAmJaACdAFAAAD+8MKOt/+fmf/Hv/7P6wAAAA==";

function jpegOfSize(size: number) {
  const bytes = Buffer.alloc(size);
  bytes[0] = 255;
  bytes[1] = 216;
  bytes[size - 2] = 255;
  bytes[size - 1] = 217;
  return bytes.toString("base64");
}
describe("mobile image upload normalization", () => {
  test("fixes Expo's PNG metadata when compressed Base64 is JPEG", () => {
    const image = prepareImageUpload({
      fileName: "minh-chung.png",
      mimeType: "image/png",
      base64: JPEG,
    });
    expect(image).toEqual({ filename: "minh-chung.jpg", mimeType: "image/jpeg", dataBase64: JPEG });
    expect(InspectionEvidenceInputSchema.safeParse(image).success).toBe(true);
  });
  test("preserves actual PNG data from web regardless of the reported MIME", () => {
    const image = prepareImageUpload({
      fileName: "anh.chup.JPEG",
      mimeType: "image/jpeg",
      base64: PNG,
    });
    expect(image.filename).toBe("anh.chup.png");
    expect(image.mimeType).toBe("image/png");
    expect(image.dataBase64).toBe(PNG);
  });
  test("recognizes actual WebP and corrects the filename extension", () => {
    const image = prepareImageUpload({ fileName: "kho.jpg", mimeType: null, base64: WEBP });
    expect(image.filename).toBe("kho.webp");
    expect(image.mimeType).toBe("image/webp");
    expect(image.dataBase64).toBe(WEBP);
  });
  test("uses a safe filename with the correct extension and bounded length", () => {
    const image = prepareImageUpload({
      fileName: `/photos/${"a".repeat(150)}.png`,
      base64: JPEG,
    });
    expect(image.filename.length).toBe(120);
    expect(image.filename.endsWith(".jpg")).toBe(true);
    expect(image.filename.includes("/")).toBe(false);
    expect(prepareImageUpload({ base64: PNG }).filename).toMatch(/^photo-\d+\.png$/);
  });
  test("rejects malformed and noncanonical Base64 before submitting", () => {
    for (const base64 of [
      "",
      "abc",
      "!!!!",
      "AB==",
      "AAB=",
      "AAAA===",
      `data:image/jpeg;base64,${JPEG}`,
    ]) {
      expect(() => prepareImageUpload({ base64 })).toThrow(M.invalidData);
    }
  });
  test("rejects a fake jpg filename, GIF content and a truncated JPEG", () => {
    for (const base64 of [
      Buffer.from("hello").toString("base64"),
      Buffer.from("GIF89a").toString("base64"),
      Buffer.from(JPEG, "base64").subarray(0, -2).toString("base64"),
    ]) {
      expect(() =>
        prepareImageUpload({ fileName: "photo.jpg", mimeType: "image/jpeg", base64 }),
      ).toThrow(M.unsupported);
    }
  });
  test("enforces decoded size at the exact inspection boundary, including Base64 padding", () => {
    const max = INSPECTION_PHOTO_MAX_BYTES;
    expect(prepareImageUpload({ base64: jpegOfSize(max) }).mimeType).toBe("image/jpeg");
    expect(prepareImageUpload({ base64: jpegOfSize(max - 1) }).mimeType).toBe("image/jpeg");
    expect(() => prepareImageUpload({ base64: jpegOfSize(max + 1) })).toThrow(M.tooLarge(max));
  });
  test("applies the support image limit without weakening the inspection limit", () => {
    const base64 = jpegOfSize(4 * 1024 * 1024);
    expect(() => prepareImageUpload({ base64 })).toThrow(M.tooLarge(INSPECTION_PHOTO_MAX_BYTES));
    expect(prepareImageUpload({ base64 }, SUPPORT_IMAGE_MAX_BYTES).mimeType).toBe("image/jpeg");
  });
});
