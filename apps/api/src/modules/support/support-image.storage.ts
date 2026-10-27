import { SUPPORT_IMAGE_MAX_BYTES } from "@metastorage/contracts";
import { CloudinaryAdapter } from "../../common/adapters/storage/cloudinary.adapter";
import { AppError } from "../../common/errors/app-error";
import { SUPPORT_MESSAGES as m } from "./support.messages";
import type { SupportImageStorage } from "./support.types";

export class SupportCloudinaryImageStorage implements SupportImageStorage {
  constructor(private readonly adapter = new CloudinaryAdapter()) {}
  async put(key: string, bytes: Uint8Array) {
    try {
      // Authenticated raw assets preserve the exact bytes/checksum; no public URL is returned.
      await this.adapter.upload(
        `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}`,
        { publicId: key, resourceType: "raw" },
      );
    } catch {
      throw new AppError(m.storageUnavailable, 503, "SUPPORT_STORAGE_UNAVAILABLE");
    }
  }
  async get(key: string) {
    try {
      return await this.adapter.download(
        { publicId: key, resourceType: "raw" },
        SUPPORT_IMAGE_MAX_BYTES,
      );
    } catch {
      throw new AppError(m.storageUnavailable, 503, "SUPPORT_STORAGE_UNAVAILABLE");
    }
  }
  async remove(key: string) {
    await this.adapter.remove({ publicId: key, resourceType: "raw" });
  }
}
