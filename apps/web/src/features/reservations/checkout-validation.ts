import axios from "axios";
import { z } from "zod";
import { RESERVATION_MESSAGES as m } from "./reservation.messages";

export function normalizePhone(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (compact.startsWith("+84")) return compact;
  return `+84${compact.startsWith("0") ? compact.slice(1) : compact}`;
}

export function phoneError(value: string): string | undefined {
  if (!value.trim()) return m.phoneRequired;
  if (!/^\d[\d\s]*$/.test(value.trim())) return m.phoneCharacters;
  if (!/^0[1-9]\d{8}$/.test(value.replace(/\s/g, ""))) return m.invalidPhone;
  return undefined;
}

export function toLocalDateTimeInput(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function checkInError(value: string, now = new Date()): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return m.checkInRequired;
  const date = new Date(`${value}:00+07:00`);
  if (Number.isNaN(date.getTime()) || toLocalDateTimeInput(date) !== value)
    return m.checkInRequired;
  if (date <= now) return m.pastCheckIn;
  return undefined;
}

export const wizardSchema = z.object({
  facilityId: z.string().min(1, m.facilityRequired),
  unitTypeId: z.string().min(1, m.unitTypeRequired),
  checkInAt: z.string().superRefine((value, ctx) => {
    const message = checkInError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  durationMonths: z
    .number()
    .int(m.invalidDuration)
    .min(1, m.invalidDuration)
    .max(12, m.invalidDuration),
  fullName: z.string().trim().min(2, m.nameRequired),
  email: z.string().trim().email(m.invalidEmail),
  phone: z.string().superRefine((value, ctx) => {
    const message = phoneError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
});

export function checkoutFailure(error: unknown, stage: "draft" | "hold" | "payment") {
  const response = axios.isAxiosError(error) ? error.response : undefined;
  const body = response?.data as
    | {
        error?: { code?: string; message?: string; details?: { field: string; message: string }[] };
        message?: string;
      }
    | undefined;
  const failure = body?.error;
  const message =
    failure?.message ??
    body?.message ??
    (axios.isAxiosError(error) && !response ? m.networkError : m.unexpectedError);
  console.error("[metastorage checkout] Request failed", {
    stage,
    status: response?.status,
    code: failure?.code,
    message,
    details: failure?.details,
    requestId: response?.headers?.["x-request-id"],
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return { message, code: failure?.code, details: failure?.details };
}
