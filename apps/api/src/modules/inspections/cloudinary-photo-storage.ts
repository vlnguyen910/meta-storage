import { randomUUID } from "node:crypto";
import { INSPECTION_MESSAGES } from "@metastorage/contracts";
import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../../common/errors/app-error";
import type { InspectionPhotoStorage } from "./photo-storage.types";

export class CloudinaryPhotoStorage implements InspectionPhotoStorage {
  private options() {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret)
      throw new AppError(INSPECTION_MESSAGES.storageUnavailable, 503, "PHOTO_STORAGE_UNAVAILABLE");
    return { cloud_name, api_key, api_secret, secure: true };
  }

  async upload(inspectionId: string, mimeType: string, dataBase64: string) {
    try {
      const result = await cloudinary.uploader.upload(`data:${mimeType};base64,${dataBase64}`, {
        ...this.options(),
        type: "authenticated",
        resource_type: "image",
        public_id: `storex/inspections/${inspectionId}/${randomUUID()}`,
        overwrite: false,
        timeout: 30000,
      });
      return { publicId: result.public_id, format: result.format };
    } catch {
      // Provider errors may contain credentials or signed URLs; do not expose them.
      throw new AppError(INSPECTION_MESSAGES.storageUnavailable, 503, "PHOTO_STORAGE_UNAVAILABLE");
    }
  }

  readUrl(publicId: string, format: string) {
    return cloudinary.utils.private_download_url(publicId, format, {
      ...this.options(),
      type: "authenticated",
      resource_type: "image",
      attachment: false,
      expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
    });
  }

  async remove(publicId: string) {
    const result = await cloudinary.uploader.destroy(publicId, {
      ...this.options(),
      type: "authenticated",
      resource_type: "image",
      invalidate: true,
    });
    if (!["ok", "not found"].includes(result.result)) throw new Error("Cloudinary cleanup failed");
  }
}
