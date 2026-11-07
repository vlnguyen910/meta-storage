import type {
  CreateUnitTypeCatalog,
  UnitTypeManagementQuery,
  UpdateUnitTypeCatalog,
} from "@metastorage/contracts";
import { ForbiddenError } from "../../common/errors/app-error";
import { UNIT_TYPE_MESSAGES as M } from "./unit-types.messages";
import type { UnitTypesRepository } from "./unit-types.repository";
import type { UnitTypeActor } from "./unit-types.types";

export class UnitTypesService {
  constructor(private readonly repository: UnitTypesRepository) {}
  async list(query: UnitTypeManagementQuery, actor: UnitTypeActor) {
    const rows = await this.repository.list(
      query.limit,
      query.offset,
      actor.role === "FACILITY_MANAGER" ? true : query.isActive,
    );
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
  async create(input: CreateUnitTypeCatalog, actor: UnitTypeActor) {
    if (actor.role !== "BUSINESS_OPERATION_MANAGER") throw new ForbiddenError(M.forbidden);
    const row = await this.repository.create(input, actor.id);
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  async update(id: string, input: UpdateUnitTypeCatalog, actor: UnitTypeActor) {
    if (actor.role !== "BUSINESS_OPERATION_MANAGER") throw new ForbiddenError(M.forbidden);
    const row = await this.repository.update(id, input, actor.id);
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
