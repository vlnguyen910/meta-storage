import { createHash } from "node:crypto";
import { CONTRACT_PDF_MAX_BYTES, RENTAL_DOCUMENT_MESSAGES as m } from "@metastorage/contracts";
import { PDFDocument } from "pdf-lib";
import { ValidationError } from "../../common/errors/app-error";
export function contractHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function decodeContract(base64: string) {
  // Linear character scan + canonical round trip avoids nested-regex backtracking
  // for the maximum-size PDF while still rejecting malformed padding/base64.
  if (base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64))
    throw new ValidationError(m.invalidPdf);
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > CONTRACT_PDF_MAX_BYTES || bytes.toString("base64") !== base64)
    throw new ValidationError(m.invalidPdf);
  return bytes;
}
export async function validateContractPdf(bytes: Uint8Array) {
  try {
    if (
      !bytes.length ||
      bytes.length > CONTRACT_PDF_MAX_BYTES ||
      Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-" ||
      !Buffer.from(bytes.subarray(-1024)).includes("%%EOF")
    )
      throw new Error("Invalid PDF framing");
    const pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    const pages = pdf.getPages();
    if (
      pdf.isEncrypted ||
      !pages.length ||
      pages.some((page) => {
        const { width, height } = page.getSize();
        return !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0;
      })
    )
      throw new Error("Invalid pages");
    return { sha256: contractHash(bytes), pageCount: pages.length, byteSize: bytes.length };
  } catch {
    throw new ValidationError(m.invalidPdf);
  }
}
