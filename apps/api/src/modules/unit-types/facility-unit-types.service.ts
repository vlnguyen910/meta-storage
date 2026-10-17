import type { UnitTypeListQuery } from "@metastorage/contracts";
import type { UnitType } from "@metastorage/database";
import { NotFoundError } from "../../common/errors/app-error";
import type { FacilitiesRepository } from "../facilities/facilities.repository";
import type { FacilityUnitTypesRepository } from "./facility-unit-types.repository";
import { UNIT_TYPE_MESSAGES } from "./unit-types.messages";

export class FacilityUnitTypesService {
  constructor(
    private readonly repository: FacilityUnitTypesRepository,
    private readonly facilitiesRepository: FacilitiesRepository,
  ) {}

  async requireActiveUnitType(facilityId: string, unitTypeId: string): Promise<UnitType> {
    const unitType = await this.repository.findActiveUnitType(facilityId, unitTypeId);
    if (!unitType) throw new NotFoundError(UNIT_TYPE_MESSAGES.unitTypeUnavailable);
    return unitType;
  }

  async listByFacility(facilityId: string, query: UnitTypeListQuery): Promise<UnitType[]> {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility?.isActive) {
      throw new NotFoundError(UNIT_TYPE_MESSAGES.facilityUnavailable);
    }

    return this.repository.listByFacility(facilityId, query.limit, query.offset);
  }
}
