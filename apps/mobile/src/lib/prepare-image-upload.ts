import { INSPECTION_PHOTO_MAX_BYTES, type InspectionEvidenceInput } from "@metastorage/contracts";
import { PICK_IMAGE as M } from "./pick-image.messages";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function prepareImageUpload(
  asset: { base64?: string | null; fileName?: string | null; mimeType?: string | null },
  maxBytes = INSPECTION_PHOTO_MAX_BYTES,
): InspectionEvidenceInput {
  const value = asset.base64;
  if (!value) throw new Error(M.invalidData);
  if (value.length > Math.ceil(maxBytes / 3) * 4) throw new Error(M.tooLarge(maxBytes));
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new Error(M.invalidData);

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  if (
    (padding === 2 && (BASE64.indexOf(value.charAt(value.length - 3)) & 15) !== 0) ||
    (padding === 1 && (BASE64.indexOf(value.charAt(value.length - 2)) & 3) !== 0)
  )
    throw new Error(M.invalidData);
  const byteSize = (value.length / 4) * 3 - padding;
  if (byteSize > maxBytes) throw new Error(M.tooLarge(maxBytes));

  // Read only signature bytes, without allocating the whole decoded image on the phone.
  const byteAt = (index: number) => {
    const bit = index * 8;
    const offset = Math.floor(bit / 6);
    const pair =
      (BASE64.indexOf(value.charAt(offset)) << 6) | BASE64.indexOf(value.charAt(offset + 1));
    return (pair >> (4 - (bit % 6))) & 255;
  };
  const header = String.fromCharCode(
    ...Array.from({ length: Math.min(12, byteSize) }, (_, index) => byteAt(index)),
  );
  const mimeType =
    byteSize >= 4 &&
    byteAt(0) === 255 &&
    byteAt(1) === 216 &&
    byteAt(byteSize - 2) === 255 &&
    byteAt(byteSize - 1) === 217
      ? "image/jpeg"
      : header.startsWith("\x89PNG\r\n\x1a\n")
        ? "image/png"
        : header.startsWith("RIFF") && header.slice(8, 12) === "WEBP"
          ? "image/webp"
          : null;
  if (!mimeType) throw new Error(M.unsupported);

  const extension =
    mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/png" ? ".png" : ".webp";
  const originalName = asset.fileName?.split(/[\\/]/).pop()?.trim();
  const stem = originalName?.replace(/\.[^.]*$/, "").trim() || `photo-${Date.now()}`;
  return {
    filename: `${stem.slice(0, 120 - extension.length)}${extension}`,
    mimeType,
    dataBase64: value,
  };
}
