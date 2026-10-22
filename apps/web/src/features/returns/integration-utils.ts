import { isAxiosError } from "axios";
import { F3 } from "./integration.messages";

export function integrationError(error: unknown): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 409) return F3.stale;
  if (status === 401) return F3.expired;
  if (status === 403 || status === 404) return F3.forbidden;
  if (status === 400 || status === 422) return F3.invalid;
  return F3.unavailable;
}
export function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result.split(",", 2)[1] ?? "")
        : reject(new Error("file-read"));
    reader.onerror = () => reject(new Error("file-read"));
    reader.readAsDataURL(file);
  });
}
export function facilityDateTime(value: string, timezone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function facilityTimeToIso(value: string, timezone: string) {
  const nominal = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(nominal)) throw new Error("invalid-time");
  let instant = nominal;
  for (let i = 0; i < 3; i++) {
    const displayed = facilityDateTime(new Date(instant).toISOString(), timezone);
    instant += nominal - Date.parse(`${displayed}:00Z`);
  }
  if (facilityDateTime(new Date(instant).toISOString(), timezone) !== value)
    throw new Error("invalid-time");
  return new Date(instant).toISOString();
}
// PostgreSQL numeric values may include an all-zero decimal suffix. Never round money.
export function readWholeVnd(value: string): bigint | null {
  return /^(0|[1-9]\d*)(?:\.0+)?$/.test(value) ? BigInt(value.split(".")[0] ?? "0") : null;
}
export function minuteClock(value: string): string {
  // Strip only zero seconds from PostgreSQL time; never round meaningful seconds.
  return /^\d{2}:\d{2}:00(?:\.0+)?$/.test(value) ? value.slice(0, 5) : value;
}
export const money = (value: string) => {
  const amount = readWholeVnd(value);
  return amount === null ? F3.unavailable : `${amount.toLocaleString("vi-VN")} ₫`;
};
export const f3Panel = "min-w-0 rounded border border-[#BFCAC4] bg-white p-5 shadow-sm space-y-4";
export const f3Input =
  "min-h-11 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-primary";
