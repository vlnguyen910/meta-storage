import type {
  ApiUnitType,
  CreateUnitTypeInput,
  UnitTypeManagementQuery,
  UpdateUnitTypeInput,
} from "@metastorage/contracts";
import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { UNIT_TYPE_MESSAGES } from "./unit-types.messages";
import type { UnitTypesRepository } from "./unit-types.repository";

export class UnitTypesService {
  constructor(private readonly repository: UnitTypesRepository) {}

  async list(query: UnitTypeManagementQuery): Promise<ApiUnitType[]> {
    const rows = await this.repository.list(query.limit, query.offset, query.isActive);
    return rows.map(toApiUnitType);
  }

  async create(input: CreateUnitTypeInput): Promise<ApiUnitType> {
    if (await this.repository.findByCode(input.code)) {
      throw new ConflictError(UNIT_TYPE_MESSAGES.codeAlreadyExists);
    }
    const created = await this.repository.create(input);
    return toApiUnitType(created);
  }

  async update(id: string, input: UpdateUnitTypeInput): Promise<ApiUnitType> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(UNIT_TYPE_MESSAGES.unitTypeNotFound);
    if (input.code && input.code !== existing.code) {
      const duplicate = await this.repository.findByCode(input.code);
      if (duplicate) throw new ConflictError(UNIT_TYPE_MESSAGES.codeAlreadyExists);
    }
    const updated = await this.repository.update(id, input);
    if (!updated) throw new NotFoundError(UNIT_TYPE_MESSAGES.unitTypeNotFound);
    return toApiUnitType(updated);
  }
}

function toApiUnitType(unitType: {
  id: string;
  code: string;
  name: string;
  sizeLabel: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  sizeCbm: number;
  monthlyPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ApiUnitType {
  return {
    id: unitType.id,
    code: unitType.code,
    name: unitType.name,
    sizeLabel: unitType.sizeLabel,
    lengthM: unitType.lengthM,
    widthM: unitType.widthM,
    heightM: unitType.heightM,
    sizeCbm: unitType.sizeCbm,
    monthlyPrice: unitType.monthlyPrice,
    isActive: unitType.isActive,
    createdAt: unitType.createdAt.toISOString(),
    updatedAt: unitType.updatedAt.toISOString(),
  };
}
