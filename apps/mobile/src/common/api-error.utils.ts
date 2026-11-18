import type { ApiErrorDetail } from "@metastorage/shared";
import { isAxiosError } from "axios";

/** Joins the per-field messages the API returns for validation errors (400/422). */
export function apiErrorDetailMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const details = (error.response?.data as { error?: { details?: ApiErrorDetail[] } } | undefined)
    ?.error?.details;
  if (!Array.isArray(details)) return undefined;
  const messages = details
    .map((detail) => detail.message)
    .filter((message): message is string => typeof message === "string" && message.length > 0);
  return messages.length > 0 ? [...new Set(messages)].join(" ") : undefined;
}

/** The API's own explanation (field details, else its message), or `fallback` when none was sent. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = apiErrorDetailMessage(error);
  if (detail) return detail;
  const message = isAxiosError(error)
    ? (error.response?.data as { error?: { message?: unknown } } | undefined)?.error?.message
    : undefined;
  return typeof message === "string" && message ? message : fallback;
}
