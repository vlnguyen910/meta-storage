import type { RentalListItem } from "@metastorage/contracts";
import { MY_STORAGE as M } from "../features/my-storage/my-storage.messages";
import type { StorageTransaction } from "./my-storage.types";
export const storageDate = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
export const rentalPeriod = (rental: RentalListItem) =>
  `${storageDate(rental.startAt)} – ${storageDate(rental.endAt)}`;
export function rentalTiming(rental: RentalListItem, now: number) {
  if (rental.status !== "ACTIVE") return null;
  const delta = Date.parse(rental.endAt) - now;
  return delta >= 0
    ? { label: M.remaining(Math.ceil(delta / 86400000)), overdue: false }
    : { label: M.overdue(Math.ceil(-delta / 86400000)), overdue: true };
}
export function storageRentals(items: RentalListItem[], view: "current" | "history") {
  return [
    ...new Map(
      items
        .filter((r) => r.status === (view === "current" ? "ACTIVE" : "CLOSED"))
        .map((r) => [r.id, r]),
    ).values(),
  ].sort((a, b) =>
    view === "current"
      ? Date.parse(a.endAt) - Date.parse(b.endAt) || a.id.localeCompare(b.id)
      : Date.parse(b.closedAt ?? b.endAt) - Date.parse(a.closedAt ?? a.endAt) ||
        a.id.localeCompare(b.id),
  );
}
const transactionTime = ({ payment }: StorageTransaction) =>
  Date.parse(payment.paidAt ?? payment.createdAt);
export function storageTransactions(items: StorageTransaction[], oldest = false) {
  return [...new Map(items.map((item) => [item.payment.id, item])).values()].sort(
    (a, b) =>
      (oldest ? 1 : -1) * (transactionTime(a) - transactionTime(b)) ||
      a.payment.id.localeCompare(b.payment.id),
  );
}
export function storageMoney(amount: string, currency = "VND") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return M.unknown;
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(value);
  } catch {
    return `${new Intl.NumberFormat("vi-VN").format(value)} ${currency}`;
  }
}
