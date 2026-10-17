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
