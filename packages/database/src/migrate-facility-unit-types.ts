import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { boolean, pgTable, uuid } from "drizzle-orm/pg-core";
import type { Database } from "./client";
import { bookings } from "./schema/bookings";
import { capacityAllocations } from "./schema/capacity-allocations";
import { rentalPriceRanges } from "./schema/rental-price-ranges";
import { reservationDrafts } from "./schema/reservation-drafts";
import { storageUnits } from "./schema/storage-units";
import { unitTypes } from "./schema/unit-types";

// Definitions exist only while generated expansion/contraction DDL is being applied.
const legacyOfferings = pgTable("facility_unit_types", {
  facilityId: uuid("facility_id").notNull(),
  unitTypeId: uuid("unit_type_id").notNull(),
  isActive: boolean("is_active").notNull(),
});
export async function migrateFacilityUnitTypes(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
) {
  const originals = await tx
    .select()
    .from(unitTypes)
    .where(isNull(unitTypes.facilityId))
    .orderBy(unitTypes.id)
    .for("update");
  const offerings = await tx
    .select()
    .from(legacyOfferings)
    .orderBy(asc(legacyOfferings.facilityId))
    .for("update");
  for (const original of originals) {
    const links = offerings.filter((link) => link.unitTypeId === original.id);
    if (!links.length || original.monthlyPrice <= 0)
      throw new Error(
        `Resolve unassigned or nonpositive-priced legacy unit type ${original.code} before migrating`,
      );
    await tx.insert(rentalPriceRanges).values({
      id: original.id,
      code: original.code,
      name: original.name,
      isActive: original.isActive,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    });
    for (const [index, link] of links.entries()) {
      const id = index === 0 ? original.id : randomUUID();
      const values = {
        facilityId: link.facilityId,
        priceRangeId: original.id,
        code: original.code,
        name: original.name,
        sizeLabel: original.sizeLabel,
        lengthM: original.lengthM,
        widthM: original.widthM,
        heightM: original.heightM,
        monthlyPrice: original.monthlyPrice,
        isActive: link.isActive,
        createdAt: original.createdAt,
        updatedAt: original.updatedAt,
      };
      if (index === 0) await tx.update(unitTypes).set(values).where(eq(unitTypes.id, original.id));
      else {
        await tx.insert(unitTypes).values({ id, ...values });
        await tx
          .insert(legacyOfferings)
          .values({ facilityId: link.facilityId, unitTypeId: id, isActive: link.isActive });
        for (const table of [storageUnits, bookings, reservationDrafts, capacityAllocations])
          await tx
            .update(table)
            .set({ unitTypeId: id })
            .where(and(eq(table.facilityId, link.facilityId), eq(table.unitTypeId, original.id)));
      }
    }
  }
}
