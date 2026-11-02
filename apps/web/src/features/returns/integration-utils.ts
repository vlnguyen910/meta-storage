import { F3 } from "./integration.messages";
// PostgreSQL numeric values may include an all-zero decimal suffix. Never round money.
export function readWholeVnd(value: string): bigint | null {
  return /^(0|[1-9]\d*)(?:\.0+)?$/.test(value) ? BigInt(value.split(".")[0] ?? "0") : null;
}
export const money = (value: string) => {
  const amount = readWholeVnd(value);
  return amount === null ? F3.unavailable : `${amount.toLocaleString("vi-VN")} ₫`;
};
