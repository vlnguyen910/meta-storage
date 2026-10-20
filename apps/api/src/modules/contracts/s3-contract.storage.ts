import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { CONTRACT_PDF_MAX_BYTES, RENTAL_DOCUMENT_MESSAGES as m } from "@metastorage/contracts";
import { AppError } from "../../common/errors/app-error";
import type { ContractStorage } from "./contracts.types";
export class S3ContractStorage implements ContractStorage {
  private options() {
    const endpoint = process.env.CONTRACT_S3_ENDPOINT;
    const region = process.env.CONTRACT_S3_REGION;
    const bucket = process.env.CONTRACT_S3_BUCKET;
    const accessKeyId = process.env.CONTRACT_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CONTRACT_S3_SECRET_ACCESS_KEY;
    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey)
      throw new AppError(m.unavailable, 503, "CONTRACT_STORAGE_UNAVAILABLE");
    return {
      bucket,
      client: new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        maxAttempts: 2,
      }),
    };
  }
  async put(key: string, bytes: Uint8Array) {
    const { bucket, client } = this.options();
    try {
      // Bucket must be private. Never request a public ACL or expose object keys/URLs.
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: "application/pdf",
          ContentLength: bytes.length,
          CacheControl: "private, no-store",
          IfNoneMatch: "*",
        }),
        { abortSignal: AbortSignal.timeout(30000) },
      );
    } catch {
      throw new AppError(m.unavailable, 503, "CONTRACT_STORAGE_UNAVAILABLE");
    } finally {
      client.destroy();
    }
  }
  async get(key: string) {
    const { bucket, client } = this.options();
    try {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(30000),
      });
      if (
        !response.Body ||
        !response.ContentLength ||
        response.ContentLength > CONTRACT_PDF_MAX_BYTES
      )
        throw new Error("Invalid object size");
      const bytes = await response.Body.transformToByteArray();
      if (bytes.length !== response.ContentLength || bytes.length > CONTRACT_PDF_MAX_BYTES)
        throw new Error("Invalid object body");
      return bytes;
    } catch {
      throw new AppError(m.unavailable, 503, "CONTRACT_STORAGE_UNAVAILABLE");
    } finally {
      client.destroy();
    }
  }
  async remove(key: string) {
    const { bucket, client } = this.options();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new AppError(m.unavailable, 503, "CONTRACT_STORAGE_UNAVAILABLE");
    } finally {
      client.destroy();
    }
  }
}
