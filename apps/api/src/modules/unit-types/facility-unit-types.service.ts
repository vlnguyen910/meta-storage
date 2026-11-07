import type {
  CreateFacilityUnitType,
  UnitTypeListQuery,
  UpdateFacilityUnitType,
} from "@metastorage/contracts";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import type { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type { FacilityUnitTypesRepository } from "./facility-unit-types.repository";
import { UNIT_TYPE_MESSAGES as M } from "./unit-types.messages";
import type { UnitTypeActor } from "./unit-types.types";

export class FacilityUnitTypesService {
  constructor(
    private readonly repository: FacilityUnitTypesRepository,
    private readonly facilitiesRepository: FacilitiesRepository,
  ) {}
  async requireActiveUnitType(facilityId: string, id: string) {
    const row = await this.repository.findActiveUnitType(facilityId, id);
    if (!row) throw new NotFoundError(M.unitTypeUnavailable);
    return row;
  }
  async listByFacility(facilityId: string, query: UnitTypeListQuery) {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility?.isActive) throw new NotFoundError(M.facilityUnavailable);
    return (await this.repository.listByFacility(facilityId, query.limit, query.offset, true)).map(
      (row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    );
  }
  async listManagement(
    facilityId: string,
    query: UnitTypeListQuery & { isActive?: boolean },
    actor: UnitTypeActor,
  ) {
    await requireAssignedFacility(
      new FacilityAssignmentsRepository(this.repository.db),
      facilityId,
      getFacilityAccessScope({ id: actor.id, role: actor.role }),
    );
    return (
      await this.repository.listByFacility(facilityId, query.limit, query.offset, query.isActive)
    ).map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
  async create(facilityId: string, input: CreateFacilityUnitType, actor: UnitTypeActor) {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(M.forbidden);
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility?.isActive) throw new NotFoundError(M.facilityUnavailable);
    const row = await this.repository.save(facilityId, input, actor.id);
    const result = await this.repository.findById(row.id);
    if (!result) throw new NotFoundError(M.facilityUnitTypeUnavailable);
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
  async update(
    id: string,
    input: UpdateFacilityUnitType,
    actor: UnitTypeActor,
    facilityId?: string,
  ) {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(M.forbidden);
    const before = await this.repository.findById(id);
    if (!before || (facilityId && before.facilityId !== facilityId))
      throw new NotFoundError(M.facilityUnitTypeUnavailable);
    await this.repository.save(before.facilityId, input, actor.id, id);
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundError(M.facilityUnitTypeUnavailable);
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
