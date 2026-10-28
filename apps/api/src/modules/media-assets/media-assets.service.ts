import { randomUUID } from "node:crypto";
import { CloudinaryResourceType, type MediaAsset } from "@metastorage/database";
import { CloudinaryAdapter } from "../../common/adapters/storage/cloudinary.adapter";
import type { CloudinaryResource } from "../../common/adapters/storage/cloudinary.types";
import { BadRequestError, NotFoundError } from "../../common/errors/app-error";
import { MEDIA_ASSET_MESSAGES as m } from "./media-assets.messages";
import type { MediaAssetsRepository } from "./media-assets.repository";
import type { MediaAssetImageInput } from "./media-assets.types";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export class MediaAssetsService {
  constructor(
    private readonly repository: MediaAssetsRepository,
    private readonly cloudinary = new CloudinaryAdapter(),
  ) {}

  async uploadImage(
    ownerType: string,
    ownerId: string,
    purpose: string,
    userId: string,
    input: MediaAssetImageInput,
  ) {
    const bytes = this.decodeImage(input.mimeType, input.dataBase64);
    const publicId = `metastorage/media-assets/${randomUUID()}`;
    const stored = await this.cloudinary.upload(
      `data:${input.mimeType};base64,${input.dataBase64}`,
      {
        publicId,
        resourceType: "image",
      },
    );
    try {
      return await this.repository.create({
        ownerType,
        ownerId,
        purpose,
        uploadedBy: userId,
        filename: input.filename,
        mimeType: input.mimeType,
        byteSize: bytes.byteLength,
        cloudinaryResourceType: CloudinaryResourceType.IMAGE,
        cloudinaryPublicId: stored.publicId,
        cloudinaryFormat: stored.format,
      });
    } catch (error) {
      try {
        await this.cloudinary.remove({ publicId: stored.publicId, resourceType: "image" });
      } catch {
        console.error("Unpersisted Cloudinary upload requires cleanup.");
      }
      throw error;
    }
  }

  async listImages(ownerType: string, ownerId: string, purpose: string) {
    const assets = await this.repository.list(ownerType, ownerId, purpose);
    return assets.map((asset) => ({ ...asset, url: this.url(asset) }));
  }

  async removeImage(ownerType: string, ownerId: string, assetId: string) {
    const asset = await this.repository.delete(ownerType, ownerId, assetId);
    if (!asset) throw new NotFoundError(m.notFound);
    try {
      await this.cloudinary.remove(this.resource(asset));
    } catch {
      // shortcut: failed deletion can orphan a Cloudinary object; add retries if cleanup volume requires it.
      console.error("Deleted media asset requires Cloudinary cleanup.");
    }
  }

  private url(asset: MediaAsset) {
    return this.cloudinary.readUrl(this.resource(asset));
  }

  private resource(asset: MediaAsset): CloudinaryResource {
    return {
      publicId: asset.cloudinaryPublicId,
      format: asset.cloudinaryFormat,
      resourceType: asset.cloudinaryResourceType === CloudinaryResourceType.IMAGE ? "image" : "raw",
    };
  }

  private decodeImage(mimeType: string, value: string) {
    if (!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
      throw new BadRequestError(m.invalidImage);
    const bytes = Buffer.from(value, "base64");
    const canonical = bytes.toString("base64");
    const matches =
      canonical === value &&
      bytes.byteLength > 0 &&
      bytes.byteLength <= MAX_IMAGE_BYTES &&
      ((mimeType === "image/jpeg" &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes.at(-2) === 0xff &&
        bytes.at(-1) === 0xd9) ||
        (mimeType === "image/png" &&
          bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (mimeType === "image/webp" &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"));
    if (!matches) throw new BadRequestError(m.invalidImage);
    return bytes;
  }
}
