import type {
  FacilityUnitTypeManagementItem,
  SetFacilityUnitTypeInput,
  UnitTypeListQuery,
} from "@metastorage/contracts";
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

  async listManagement(
    facilityId: string,
    query: UnitTypeListQuery & { isActive?: boolean },
  ): Promise<FacilityUnitTypeManagementItem[]> {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility) throw new NotFoundError(UNIT_TYPE_MESSAGES.facilityUnavailable);
    const rows = await this.repository.list(facilityId, query.limit, query.offset, query.isActive);
    return rows.map(({ offering, unitType }) => ({
      facilityId: offering.facilityId,
      unitTypeId: unitType.id,
      isActive: offering.isActive,
      code: unitType.code,
      name: unitType.name,
      sizeLabel: unitType.sizeLabel,
      monthlyPrice: unitType.monthlyPrice,
    }));
  }

  async setManagementAvailability(
    facilityId: string,
    unitTypeId: string,
    input: SetFacilityUnitTypeInput,
  ): Promise<FacilityUnitTypeManagementItem> {
    const [facility, link] = await Promise.all([
      this.facilitiesRepository.findById(facilityId),
      this.repository.find(facilityId, unitTypeId),
    ]);
    if (!facility) throw new NotFoundError(UNIT_TYPE_MESSAGES.facilityUnavailable);
    const sharedType = await this.repository.findSharedUnitType(unitTypeId);
    if (!sharedType || (input.isActive && !sharedType.isActive))
      throw new NotFoundError(UNIT_TYPE_MESSAGES.unitTypeUnavailable);
    if (!link && !input.isActive)
      throw new NotFoundError(UNIT_TYPE_MESSAGES.facilityUnitTypeUnavailable);
    const updated = await this.repository.setActiveOrLink(facilityId, unitTypeId, input.isActive);
    if (!updated) throw new NotFoundError(UNIT_TYPE_MESSAGES.facilityUnitTypeUnavailable);
    return {
      facilityId: updated.facilityId,
      unitTypeId: sharedType.id,
      isActive: updated.isActive,
      code: sharedType.code,
      name: sharedType.name,
      sizeLabel: sharedType.sizeLabel,
      monthlyPrice: sharedType.monthlyPrice,
    };
  }
}
