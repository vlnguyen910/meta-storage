import type { StorageUnitsRepository } from "./storage-units.repository";

export class StorageUnitsService {
  constructor(private readonly repository: StorageUnitsRepository) {}

  async getAvailableCapacity(facilityId: string, unitTypeId: string, startsAt: Date, endsAt: Date) {
    return this.repository.getAvailableCapacity(facilityId, unitTypeId, startsAt, endsAt);
  }
}
