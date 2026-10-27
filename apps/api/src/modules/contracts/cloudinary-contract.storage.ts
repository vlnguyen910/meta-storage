import { CONTRACT_PDF_MAX_BYTES, RENTAL_DOCUMENT_MESSAGES as m } from "@metastorage/contracts";
import { CloudinaryAdapter } from "../../common/adapters/storage/cloudinary.adapter";
import { AppError } from "../../common/errors/app-error";
import type { ContractStorage } from "./contracts.types";

export class CloudinaryContractStorage implements ContractStorage {
  constructor(private readonly storage = new CloudinaryAdapter()) {}

  async put(key: string, bytes: Uint8Array) {
    try {
      await this.storage.upload(
        `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`,
        {
          publicId: key,
          resourceType: "raw",
        },
      );
    } catch {
      throw this.unavailable();
    }
  }

  async get(key: string) {
    try {
      return await this.storage.download(
        { publicId: key, resourceType: "raw" },
        CONTRACT_PDF_MAX_BYTES,
      );
    } catch {
      throw this.unavailable();
    }
  }

  async remove(key: string) {
    try {
      await this.storage.remove({ publicId: key, resourceType: "raw" });
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable() {
    return new AppError(m.unavailable, 503, "CONTRACT_STORAGE_UNAVAILABLE");
  }
}
