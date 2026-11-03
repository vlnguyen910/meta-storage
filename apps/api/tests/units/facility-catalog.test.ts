import { expect, test } from "bun:test";
import { FacilityCatalogQuerySchema } from "@metastorage/contracts";
import type { FacilitiesRepository } from "../../src/modules/facilities/facilities.repository";
import { FacilitiesService } from "../../src/modules/facilities/facilities.service";

test("catalog filters and globally sorts before slicing a page; missing prices sort last", async () => {
  const repository = {
    catalog: async () => [
      { facility: { name: "B", address: "HCM" }, startingMonthlyPrice: null },
      { facility: { name: "A", address: "HCM" }, startingMonthlyPrice: 200 },
      { facility: { name: "C", address: "HCM" }, startingMonthlyPrice: 100 },
      { facility: { name: "D", address: "Hanoi" }, startingMonthlyPrice: 1 },
    ],
  } as unknown as FacilitiesRepository;
  const page = await new FacilitiesService(repository).catalog({
    city: "hcm",
    sort: "price",
    page: 2,
    pageSize: 1,
  });
  expect(page.items.map((row) => row.facility.name)).toEqual(["A"]);
  expect(page.total).toBe(3);
  expect(page.totalPages).toBe(3);
  expect(FacilityCatalogQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  expect(FacilityCatalogQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
});
