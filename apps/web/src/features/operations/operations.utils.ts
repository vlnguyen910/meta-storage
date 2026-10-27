import type { OperationsFacility, OperationsTotals } from "./operations.types";

export function filterFacilities(
  facilities: readonly OperationsFacility[],
  facilityId: string,
  search: string,
): OperationsFacility[] {
  const term = search.trim().toLocaleLowerCase("vi-VN");
  return facilities.filter(
    (item) =>
      (facilityId === "all" || item.id === facilityId) &&
      `${item.name} ${item.address}`.toLocaleLowerCase("vi-VN").includes(term),
  );
}

export function summarizeFacilities(facilities: readonly OperationsFacility[]): OperationsTotals {
  const totals: OperationsTotals = {
    total: 0,
    occupied: 0,
    available: 0,
    reserved: 0,
    maintenance: 0,
    rentalCollected: 0,
    depositHeld: 0,
    occupancy: 0,
  };
  for (const facility of facilities) {
    totals.total += facility.total;
    totals.occupied += facility.occupied;
    totals.available += facility.available;
    totals.reserved += facility.reserved;
    totals.maintenance += facility.maintenance;
    totals.rentalCollected += facility.rentalCollected;
    totals.depositHeld += facility.depositHeld;
  }
  totals.occupancy = totals.total ? (totals.occupied / totals.total) * 100 : 0;
  return totals;
}

export function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatMoney(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "number" ? val : Number.parseFloat(val);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatMoneyWithCurrency(
  val: string | number | null | undefined,
  currency?: string | null,
): string {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "number" ? val : Number.parseFloat(val);
  if (Number.isNaN(num)) return "—";

  const curr = (currency ?? "VND").trim().toUpperCase();
  if (curr === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (curr === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(num);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
    }).format(num);
  } catch {
    return `${num.toLocaleString("en-US")} ${curr}`;
  }
}

export function formatDateVn(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatDateTimeVn(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function getDefaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "10";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${day}`,
  };
}

export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return `\uFEFF${rows
    .map((row) =>
      row
        .map((value) => {
          let cell = String(value);
          if (typeof value === "string" && /^[=+\-@]/.test(cell)) cell = `'${cell}`;
          return `"${cell.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n")}`;
}

export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
