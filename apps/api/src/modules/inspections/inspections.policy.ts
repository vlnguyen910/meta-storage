import { INSPECTION_MESSAGES, INSPECTION_PHOTO_MAX_BYTES } from "@metastorage/contracts";
import { ConflictError, ValidationError } from "../../common/errors/app-error";

export function assertCompletable(correctUnit: boolean | null, notes: string, photoCount: number) {
  if (correctUnit !== true || !notes.trim() || photoCount < 1)
    throw new ValidationError(INSPECTION_MESSAGES.incomplete);
}

export function assertCurrentInspection(context: {
  bookingStatus: string;
  verificationStatus: string | undefined;
  assignmentStatus: string | undefined;
  verifiedAssignmentId: string | undefined;
  assignmentId: string | undefined;
}) {
  if (
    context.bookingStatus !== "CONFIRMED" ||
    context.verificationStatus !== "VERIFIED" ||
    context.assignmentStatus !== "ACTIVE" ||
    !context.assignmentId ||
    context.assignmentId !== context.verifiedAssignmentId
  ) {
    throw new ConflictError(INSPECTION_MESSAGES.invalidContext);
  }
}

export function decodePhoto(mimeType: string, data: string): Buffer {
  const bytes = Buffer.from(data, "base64");
  const validMagic =
    mimeType === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mimeType === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mimeType === "image/webp" &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!validMagic || bytes.length > INSPECTION_PHOTO_MAX_BYTES || bytes.toString("base64") !== data)
    throw new ValidationError(INSPECTION_MESSAGES.invalidPhoto);
  return bytes;
}
