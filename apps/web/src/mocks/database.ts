import type { Facility } from "@metastorage/contracts";
import { StorageUnitStatus } from "@metastorage/contracts";
import { createSeedDatabase } from "./seeds";
import type { MockDatabase } from "./types";

const DATABASE_KEY = "metastorage.mock-db.v4";

export function getMockDatabase(): MockDatabase {
  if (typeof window === "undefined") {
    return createSeedDatabase();
  }

  const persisted = window.localStorage.getItem(DATABASE_KEY);
  if (!persisted) {
    const database = createSeedDatabase();
    saveMockDatabase(database);
    return database;
  }

  try {
    const parsed = JSON.parse(persisted) as MockDatabase;
    if (parsed.version === 4 && Array.isArray(parsed.bookings)) {
      return parsed;
    }
    const fresh = createSeedDatabase();
    saveMockDatabase(fresh);
    return fresh;
  } catch {
    const fresh = createSeedDatabase();
    saveMockDatabase(fresh);
    return fresh;
  }
}

export function saveMockDatabase(database: MockDatabase): void {
  window.localStorage.setItem(DATABASE_KEY, JSON.stringify(database));
}

export function resetMockDatabase(): void {
  window.localStorage.setItem(DATABASE_KEY, JSON.stringify(createSeedDatabase()));
}

export function hydrateFacility(database: MockDatabase, facility: Facility): Facility {
  const facilityUnits = database.units.filter((unit) => unit.facilityId === facility.id);
  const availableUnits = facilityUnits.filter(
    (unit) => unit.status === StorageUnitStatus.AVAILABLE,
  );
  return {
    ...facility,
    totalUnits: facilityUnits.length,
    availableUnits: availableUnits.length,
    startingMonthlyPrice:
      availableUnits.length > 0
        ? Math.min(...availableUnits.map((unit) => unit.monthlyPrice))
        : facility.startingMonthlyPrice,
  };
}
