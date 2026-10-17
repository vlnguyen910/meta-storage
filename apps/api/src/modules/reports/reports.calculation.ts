export function parseCents(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const amount = BigInt(whole ?? "0") * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -amount : amount;
}
export function formatCents(value: bigint): string {
  const amount = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
}
export function resolveReportPeriod(query: { from?: string; to?: string }, now: Date) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const from = query.from ?? `${today.slice(0, 7)}-01`;
  const to = query.to ?? today;
  return {
    from,
    to,
    timeZone: "Asia/Ho_Chi_Minh" as const,
    start: new Date(`${from}T00:00:00+07:00`),
    end: new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000),
  };
}
export function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text) && (/^\s*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function csv(headers: readonly string[], rows: (string | number | null)[][]) {
  return `\uFEFF${[headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n")}\r\n`;
}
