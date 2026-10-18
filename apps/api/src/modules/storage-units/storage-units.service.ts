import type { Role, StorageUnit } from "@metastorage/database";
import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import type { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type { StorageUnitsRepository } from "./storage-units.repository";

export interface UnitTransitionUser {
  id: string;
  role: Role | null | undefined;
}

export class StorageUnitsService {
  constructor(
    private readonly repository: StorageUnitsRepository,
    private readonly assignmentsRepository?: FacilityAssignmentsRepository,
  ) {}

  async getAvailableCapacity(facilityId: string, unitTypeId: string, startsAt: Date, endsAt: Date) {
    return this.repository.getAvailableCapacity(facilityId, unitTypeId, startsAt, endsAt);
  }

  async getUnitById(id: string): Promise<StorageUnit> {
    const unit = await this.repository.findById(id);
    if (!unit) {
      throw new NotFoundError("Không tìm thấy ô kho vật lý.");
    }
    return unit;
  }

  async transitionStatus(
    unitId: string,
    targetStatus: "AVAILABLE" | "MAINTENANCE",
    reason: string | undefined,
    user: UnitTransitionUser,
  ): Promise<StorageUnit> {
    const unit = await this.getUnitById(unitId);

    if (this.assignmentsRepository) {
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(this.assignmentsRepository, unit.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);
    }

    const result = await this.repository.transitionStatus(unitId, targetStatus, reason);

    if ("error" in result) {
      if (result.error === "UNIT_NOT_FOUND") {
        throw new NotFoundError("Không tìm thấy ô kho vật lý.");
      }
      throw new ConflictError(result.message);
    }

    return result.unit;
  }
}
