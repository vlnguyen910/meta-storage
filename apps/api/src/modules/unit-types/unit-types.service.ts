import type {
  CreateUnitTypeInput,
  FacilityUnitTypeDto,
  UnitTypeManagementQuery,
  UpdateUnitTypeInput,
} from "@metastorage/contracts";
import type { UnitType } from "@metastorage/database";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { UNIT_TYPE_MESSAGES as M } from "./unit-types.messages";
import type { UnitTypesRepository } from "./unit-types.repository";
import type { UnitTypeActor } from "./unit-types.types";

export class UnitTypesService {
  constructor(private readonly repository: UnitTypesRepository) {}

  async list(query: UnitTypeManagementQuery, actor: UnitTypeActor): Promise<FacilityUnitTypeDto[]> {
    let facilityId = query.facilityId;
    if (actor.role === "FACILITY_MANAGER") {
      facilityId = await this.repository.managerFacility(actor.id, facilityId);
      if (!facilityId) throw new ForbiddenError(M.forbidden);
    } else if (!["SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER"].includes(actor.role ?? ""))
      throw new ForbiddenError(M.forbidden);
    return (await this.repository.list(query.limit, query.offset, query.isActive, facilityId)).map(
      toApiUnitType,
    );
  }

  async create(input: CreateUnitTypeInput, actor: UnitTypeActor): Promise<FacilityUnitTypeDto> {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(M.forbidden);
    return toApiUnitType(await this.repository.create(input, actor.id));
  }

  async update(
    id: string,
    input: UpdateUnitTypeInput,
    actor: UnitTypeActor,
    facilityId?: string,
  ): Promise<FacilityUnitTypeDto> {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(M.forbidden);
    const existing = await this.repository.findById(id);
    if (!existing || (facilityId && existing.facilityId !== facilityId))
      throw new NotFoundError(M.unitTypeNotFound);
    if (!(await this.repository.managerFacility(actor.id, existing.facilityId)))
      throw new ForbiddenError(M.forbidden);
    return toApiUnitType(await this.repository.update(id, input, actor.id));
  }
}

function toApiUnitType(row: UnitType): FacilityUnitTypeDto {
  return {
    id: row.id,
    facilityId: row.facilityId,
    code: row.code,
    name: row.name,
    sizeLabel: row.sizeLabel,
    lengthM: row.lengthM,
    widthM: row.widthM,
    heightM: row.heightM,
    sizeCbm: row.sizeCbm,
    monthlyPrice: row.monthlyPrice,
    isActive: row.isActive,
    version: row.version,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
