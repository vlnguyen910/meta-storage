import {
  type FacilityWorkspaceQuery,
  type FacilityWorkspaceRentalItem,
  FACILITY_WORKSPACE_MESSAGES as M,
} from "@metastorage/contracts";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { FacilityRentalsRepository } from "./facility-rentals.repository";

type Row = NonNullable<Awaited<ReturnType<FacilityRentalsRepository["get"]>>>["item"];
const dto = (row: Row): FacilityWorkspaceRentalItem => ({
  id: row.id,
  bookingId: row.bookingId,
  bookingCode: row.bookingCode,
  customerId: row.customerId,
  customerName: row.customerName,
  customerEmail: row.customerEmail,
  customerPhone: row.customerPhone,
  facilityId: row.facilityId,
  unitCode: row.unitCode,
  unitTypeName: row.unitTypeName,
  status: row.status,
  startAt: row.startAt.toISOString(),
  expectedEndAt: row.expectedEndAt.toISOString(),
  closedAt: row.closedAt?.toISOString() ?? null,
  depositAmount: row.depositAmount,
});
export class FacilityRentalsService {
  constructor(private readonly repository: FacilityRentalsRepository) {}
  async list(actorId: string, query: FacilityWorkspaceQuery) {
    if (!(await this.repository.allowed(actorId, query.facilityId)))
      throw new ForbiddenError(M.denied);
    const page = await this.repository.list(actorId, query);
    return {
      items: page.items.map(dto),
      total: page.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async get(actorId: string, id: string) {
    const result = await this.repository.get(actorId, id);
    if (!result) throw new NotFoundError(M.missing);
    return {
      rental: dto(result.item),
      payments: result.history.map((p) => ({
        ...p,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }
}
