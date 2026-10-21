import { v2 as cloudinary } from "cloudinary";
import { env } from "../../../config/env";
import { AppError } from "../../errors/app-error";
import type { CloudinaryCredentials, CloudinaryResource } from "./cloudinary.types";
import { STORAGE_MESSAGES } from "./storage.messages";

export class CloudinaryAdapter {
  constructor(private readonly credentials: CloudinaryCredentials = env) {}

  private options() {
    const {
      CLOUDINARY_CLOUD_NAME: cloud_name,
      CLOUDINARY_API_KEY: api_key,
      CLOUDINARY_API_SECRET: api_secret,
    } = this.credentials;
    if (!cloud_name || !api_key || !api_secret) throw this.unavailable();
    return { cloud_name, api_key, api_secret, secure: true, type: "authenticated" as const };
  }

  private unavailable() {
    return new AppError(STORAGE_MESSAGES.unavailable, 503, "FILE_STORAGE_UNAVAILABLE");
  }

  async upload(source: string, resource: CloudinaryResource) {
    try {
      const result = await cloudinary.uploader.upload(source, {
        ...this.options(),
        resource_type: resource.resourceType,
        public_id: resource.publicId,
        overwrite: false,
        timeout: 30000,
      });
      // overwrite:false can return an existing asset instead of rejecting a collision.
      if (result.existing || result.public_id !== resource.publicId) throw this.unavailable();
      return { publicId: result.public_id, format: result.format };
    } catch {
      throw this.unavailable();
    }
  }

  readUrl(resource: CloudinaryResource) {
    try {
      return cloudinary.utils.private_download_url(resource.publicId, resource.format ?? "", {
        ...this.options(),
        resource_type: resource.resourceType,
        attachment: false,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      });
    } catch {
      throw this.unavailable();
    }
  }

  async download(resource: CloudinaryResource, maxBytes: number): Promise<Uint8Array> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(this.readUrl(resource), {
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
      reader = response.body?.getReader();
      if (!response.ok || !reader) throw this.unavailable();
      const header = response.headers.get("content-length");
      const expected = header === null ? undefined : Number(header);
      if (
        expected !== undefined &&
        (!Number.isSafeInteger(expected) || expected < 1 || expected > maxBytes)
      )
        throw this.unavailable();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) throw this.unavailable();
        chunks.push(value);
      }
      if (!size || (expected !== undefined && expected !== size)) throw this.unavailable();
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return bytes;
    } catch {
      throw this.unavailable();
    } finally {
      await reader?.cancel().catch(() => undefined);
    }
  }

  async remove(resource: CloudinaryResource) {
    try {
      const options = {
        ...this.options(),
        resource_type: resource.resourceType,
        invalidate: true,
        timeout: 30000,
      };
      const result = await cloudinary.uploader.destroy(resource.publicId, options);
      if (!["ok", "not found"].includes(result.result)) throw this.unavailable();
    } catch {
      throw this.unavailable();
    }
  }
}
