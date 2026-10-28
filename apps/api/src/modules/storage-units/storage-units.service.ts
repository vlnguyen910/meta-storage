import {
  type CreateStorageUnitInput,
  STORAGE_UNIT_MESSAGES,
  type StorageUnitDetail,
  type StorageUnitListQuery,
  type StorageUnitListResult,
  type UpdateStorageUnitInput,
} from "@metastorage/contracts";
import type { StorageUnit } from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { mapPageDto } from "../../common/types/page.dto";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import type { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";
import type { StorageUnitsRepository } from "./storage-units.repository";
import type { UnitTransitionUser } from "./storage-units.types";

export class StorageUnitsService {
  constructor(
    private readonly repository: StorageUnitsRepository,
    private readonly assignmentsRepository?: FacilityAssignmentsRepository,
  ) {}

  async listUnits(
    query: StorageUnitListQuery,
    actor: UnitTransitionUser,
  ): Promise<StorageUnitListResult> {
    const scope = getFacilityAccessScope(actor);
    if (!this.assignmentsRepository)
      throw new ForbiddenError(STORAGE_UNIT_MESSAGES.scopeUnavailable);
    await requireAssignedFacility(this.assignmentsRepository, query.facilityId, scope);
    const result = await this.repository.listByFacility(query);
    if (!result) throw new NotFoundError(STORAGE_UNIT_MESSAGES.facilityNotFound);
    return mapPageDto(result, query, (unit) => ({
      ...unitDetail(unit),
      unitTypeName: unit.unitTypeName,
      unitTypeSizeLabel: unit.unitTypeSizeLabel,
    }));
  }

  async getUnitDetails(id: string, actor: UnitTransitionUser): Promise<StorageUnitDetail> {
    const scope = getFacilityAccessScope(actor);
    if (!this.assignmentsRepository)
      throw new ForbiddenError(STORAGE_UNIT_MESSAGES.scopeUnavailable);
    const unit = await this.repository.findById(id);
    if (!unit) throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitNotFound);
    await requireAssignedFacility(this.assignmentsRepository, unit.facilityId, scope);
    return unitDetail(unit);
  }

  async getAvailableCapacity(facilityId: string, unitTypeId: string, startsAt: Date, endsAt: Date) {
    return this.repository.getAvailableCapacity(facilityId, unitTypeId, startsAt, endsAt);
  }

  markOccupied(tx: TaskTransaction, unitId: string, now: Date) {
    return this.repository.markOccupied(tx, unitId, now);
  }

  async getUnitById(id: string): Promise<StorageUnit> {
    const unit = await this.repository.findById(id);
    if (!unit) {
      throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitNotFound);
    }
    return unit;
  }

  async transitionStatus(
    unitId: string,
    targetStatus: "AVAILABLE" | "MAINTENANCE",
    user: UnitTransitionUser,
  ): Promise<StorageUnit> {
    const unit = await this.getUnitById(unitId);

    if (this.assignmentsRepository) {
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(this.assignmentsRepository, unit.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);
    }

    const result = await this.repository.transitionStatus(unitId, targetStatus);

    if ("error" in result) {
      if (result.error === "UNIT_NOT_FOUND") {
        throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitNotFound);
      }
      if (result.error === "TRANSITION_NOT_ALLOWED") throw new ConflictError(result.message);
      if (result.error === "UNIT_TYPE_UNAVAILABLE")
        throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitTypeUnavailable);
      if (result.error === "UNIT_CODE_CONFLICT")
        throw new ConflictError(STORAGE_UNIT_MESSAGES.unitCodeAlreadyExists);
      throw new ConflictError(STORAGE_UNIT_MESSAGES.unitHasOperations);
    }

    return result.unit;
  }

  async createUnit(
    facilityId: string,
    input: CreateStorageUnitInput,
    actor: UnitTransitionUser,
  ): Promise<StorageUnitDetail> {
    await requireAssignedFacility(
      this.requireAssignments(),
      facilityId,
      getFacilityAccessScope(actor),
      ["FACILITY_MANAGER"],
    );
    const result = await this.repository.createUnit(facilityId, input);
    if ("error" in result) {
      if (result.error === "UNIT_TYPE_UNAVAILABLE")
        throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitTypeUnavailable);
      throw new ConflictError(STORAGE_UNIT_MESSAGES.unitCodeAlreadyExists);
    }
    return unitDetail(result);
  }

  async updateUnit(
    id: string,
    input: UpdateStorageUnitInput,
    actor: UnitTransitionUser,
  ): Promise<StorageUnitDetail> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitNotFound);
    await requireAssignedFacility(
      this.requireAssignments(),
      existing.facilityId,
      getFacilityAccessScope(actor),
      ["FACILITY_MANAGER"],
    );
    const result = await this.repository.updateUnit(id, input);
    if ("error" in result) {
      if (result.error === "UNIT_NOT_FOUND")
        throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitNotFound);
      if (result.error === "UNIT_TYPE_UNAVAILABLE")
        throw new NotFoundError(STORAGE_UNIT_MESSAGES.unitTypeUnavailable);
      if (result.error === "UNIT_CODE_CONFLICT")
        throw new ConflictError(STORAGE_UNIT_MESSAGES.unitCodeAlreadyExists);
      throw new ConflictError(STORAGE_UNIT_MESSAGES.unitHasOperations);
    }
    return unitDetail(result);
  }

  private requireAssignments(): FacilityAssignmentsRepository {
    if (!this.assignmentsRepository)
      throw new ForbiddenError(STORAGE_UNIT_MESSAGES.scopeUnavailable);
    return this.assignmentsRepository;
  }
}

function unitDetail(unit: StorageUnit): StorageUnitDetail {
  return {
    id: unit.id,
    facilityId: unit.facilityId,
    unitTypeId: unit.unitTypeId,
    code: unit.code,
    floor: unit.floor,
    locationDescription: unit.locationDescription,
    status: unit.status,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}
