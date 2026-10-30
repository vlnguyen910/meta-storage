import { expect, test } from "bun:test";
import {
  capacityAllocations,
  type Database,
  facilities,
  payments,
  policyViolationFees,
  reservations,
  storageUnits,
} from "@metastorage/database";
import { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { ReportsService } from "../../src/modules/reports/reports.service";

function fixture() {
  const tables: unknown[] = [];
  const query = Object.assign(Promise.resolve([]), {
    from(table: unknown) {
      tables.push(table);
      return query;
    },
    leftJoin() {
      return query;
    },
    innerJoin() {
      return query;
    },
    where() {
      return query;
    },
    groupBy() {
      return query;
    },
    orderBy() {
      return query;
    },
  });
  const database = {
    transaction: async (run: (tx: unknown) => unknown, options: unknown) => {
      expect(options).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
      return run({ select: () => query });
    },
  } as unknown as Database;
  return { tables, service: new ReportsService(new ReportsRepository(database)) };
}
const actor = { id: "operator", role: "BUSINESS_OPERATION_MANAGER" };
const period = { from: "2026-10-01", to: "2026-10-31", limit: 20, offset: 0 };

test("revenue keeps its financial results without querying inventory, holds or reservations", async () => {
  const { tables, service } = fixture();
  const result = await service.revenue(period, actor);
  expect(tables).toEqual([facilities, payments, policyViolationFees]);
  expect(result.summary.cashReceived).toBe("0.00");
  expect(result.summary.netCash).toBe("0.00");
  expect(result.items).toEqual([]);
});

test("utilization retains inventory aggregates and skips financial queries", async () => {
  const { tables, service } = fixture();
  const result = await service.utilization({ limit: 20, offset: 0 }, actor);
  expect(tables).toEqual([facilities, storageUnits, capacityAllocations, reservations]);
  expect(result.summary.totalUnits).toBe(0);
});

test("overview still queries both financial and inventory data in one snapshot", async () => {
  const { tables, service } = fixture();
  await service.overview(period, actor);
  expect(tables).toEqual([
    facilities,
    payments,
    policyViolationFees,
    storageUnits,
    capacityAllocations,
    reservations,
  ]);
});
