import { randomUUID } from "node:crypto";
import { INSPECTION_MESSAGES } from "@metastorage/contracts";
import { AppError } from "../../errors/app-error";
import { CloudinaryAdapter } from "./cloudinary.adapter";
import type { InspectionPhotoStorage } from "./photo-storage.types";

export class CloudinaryPhotoStorage implements InspectionPhotoStorage {
  constructor(private readonly storage = new CloudinaryAdapter()) {}

  async upload(inspectionId: string, mimeType: string, dataBase64: string) {
    try {
      const asset = await this.storage.upload(`data:${mimeType};base64,${dataBase64}`, {
        publicId: `metastorage/inspections/${inspectionId}/${randomUUID()}`,
        resourceType: "image",
      });
      if (!asset.format) throw new Error("Image format missing");
      return { publicId: asset.publicId, format: asset.format };
    } catch {
      throw this.unavailable();
    }
  }

  readUrl(publicId: string, format: string) {
    try {
      return this.storage.readUrl({ publicId, format, resourceType: "image" });
    } catch {
      throw this.unavailable();
    }
  }

  async remove(publicId: string) {
    try {
      await this.storage.remove({ publicId, resourceType: "image" });
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable() {
    return new AppError(INSPECTION_MESSAGES.storageUnavailable, 503, "PHOTO_STORAGE_UNAVAILABLE");
  }
}
