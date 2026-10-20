import type { ReturnChecklistItem, ReturnChecklistResult } from "@metastorage/contracts";
import { RETURN_MESSAGES as m } from "@metastorage/contracts";
import { ValidationError } from "../../common/errors/app-error";

export function wholeVnd(value: string): bigint {
  if (!/^\d+(?:\.0+)?$/.test(value)) throw new ValidationError(m.invalidMoney);
  return BigInt(value.replace(/\.0+$/, ""));
}

export function localDate(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function overdueAmount(
  deposit: string,
  rate: number,
  expiry: Date,
  actualReturn: Date,
  timezone: string,
): string {
  const amount = wholeVnd(deposit);
  if (!Number.isInteger(rate) || rate < 0 || rate > 100) throw new ValidationError(m.invalidMoney);
  if (localDate(actualReturn, timezone) <= localDate(expiry, timezone)) return "0";
  return ((amount * BigInt(rate) + 50n) / 100n).toString();
}

export function refundDueDate(approvedAt: Date, timezone: string, holidays: string[]): string {
  const day = new Date(`${localDate(approvedAt, timezone)}T12:00:00Z`);
  const excluded = new Set(holidays);
  let remaining = 3;
  while (remaining > 0) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (
      day.getUTCDay() !== 0 &&
      day.getUTCDay() !== 6 &&
      !excluded.has(day.toISOString().slice(0, 10))
    )
      remaining--;
  }
  return day.toISOString().slice(0, 10);
}

export function reviewInspection(
  definition: ReturnChecklistItem[],
  results: ReturnChecklistResult[],
  photos: string[],
): "PASS" | "FAIL" {
  const known = new Map(definition.map((item) => [item.code, item]));
  if (
    results.length !== definition.length ||
    new Set(results.map((r) => r.code)).size !== results.length
  )
    throw new ValidationError(m.incomplete);
  let failed = false;
  for (const result of results) {
    const item = known.get(result.code);
    if (!item || result.photoIds.some((id) => !photos.includes(id)))
      throw new ValidationError(m.evidence);
    if (result.issue && (!result.note || result.photoIds.length === 0))
      throw new ValidationError(m.incomplete);
    if (result.issue && item.serious && item.group !== "REMAINING_PROPERTY") failed = true;
  }
  return failed ? "FAIL" : "PASS";
}

// Legacy full transfers can be decomposed from their immutable originating settlement.
// A new mixed transfer requires explicit components even when its total is unambiguous.
export function refundAllocation(
  amount: bigint,
  depositAvailable: bigint,
  rentAvailable: bigint,
  depositPart?: string | null,
  rentPart?: string | null,
  legacy = false,
) {
  if (depositPart != null && rentPart != null) {
    const deposit = wholeVnd(depositPart),
      rent = wholeVnd(rentPart);
    if (deposit + rent !== amount) return undefined;
    return { deposit, rent };
  }
  if (depositPart != null || rentPart != null) return undefined;
  if (rentAvailable === 0n) return { deposit: amount, rent: 0n };
  if (depositAvailable === 0n) return { deposit: 0n, rent: amount };
  if (legacy && amount === depositAvailable + rentAvailable)
    return { deposit: depositAvailable, rent: rentAvailable };
  return undefined;
}
