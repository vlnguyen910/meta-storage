import { formatCurrency, formatDate } from "@/lib/format";

export function formatBookingDateTime(value: string | null) {
  if (!value) return "—";
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return `${time} ${formatDate(value)}`;
}

export function formatBookingAmount(value: number) {
  return formatCurrency(value).replace("₫", "đ");
}
