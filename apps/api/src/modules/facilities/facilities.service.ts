import type {
  CreateFacilityBody,
  FacilityOperatingHours,
  UpdateFacilityBody,
} from "@metastorage/contracts";
import type { Facility } from "@metastorage/database";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import type { FacilityListScope, FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";
import type { FacilitiesRepository } from "./facilities.repository";

export class FacilitiesService {
  constructor(private readonly facilitiesRepository: FacilitiesRepository) {}

  async requireActiveFacility(facilityId: string): Promise<Facility> {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility?.isActive) throw new NotFoundError(FACILITY_MESSAGES.facilityUnavailable);
    return facility;
  }

  async assertCheckInWithinOperatingHours(_facilityId: string, checkInAt: Date): Promise<void> {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(checkInAt);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const time = `${get("hour")}:${get("minute")}:00`;
    const hours = await this.getOperatingHours();
    const openTime = `${String(hours.openingHour).padStart(2, "0")}:00:00`;
    const closeTime = `${String(hours.closingHour).padStart(2, "0")}:00:00`;
    if (time < openTime || time > closeTime) {
      throw new AppError(
        FACILITY_MESSAGES.checkInOutsideOperatingHours(openTime, closeTime),
        400,
        "CHECK_IN_OUTSIDE_HOURS",
        [
          {
            field: "checkInSlotId",
            message: FACILITY_MESSAGES.checkInOutsideOperatingHours(openTime, closeTime),
          },
        ],
      );
    }
  }

  async getOperatingHours(): Promise<FacilityOperatingHours> {
    const hours = await this.facilitiesRepository.globalOperatingHours();
    return {
      openingHour: hours?.openingHour ?? 6,
      closingHour: hours?.closingHour ?? 22,
    };
  }

  async createFacility(input: CreateFacilityBody): Promise<Facility> {
    const existing = await this.facilitiesRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictError(FACILITY_MESSAGES.facilityCodeAlreadyExists(input.code));
    }

    const facility = await this.facilitiesRepository.createFacility({
      code: input.code,
      name: input.name,
      address: input.address,
      description: input.description,
      isActive: input.isActive ?? true,
    });

    return facility;
  }

  async getFacilityById(id: string, scope: FacilityScope): Promise<Facility> {
    const facility = await this.facilitiesRepository.findAccessibleById(id, scope);
    if (!facility) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }
    return facility;
  }

  async listFacilities(
    limit: number,
    offset: number,
    isActive: boolean | undefined,
    scope: FacilityListScope,
  ): Promise<Facility[]> {
    const list = await this.facilitiesRepository.listAccessible(limit, offset, isActive, scope);
    return list;
  }

  async getAllActiveFacilities(limit: number, offset: number): Promise<Facility[]> {
    const isActive: boolean = true;
    const list = await this.facilitiesRepository.getAllFacilities(limit, offset, isActive);
    return list;
  }

  async updateFacility(
    id: string,
    input: UpdateFacilityBody,
    scope: FacilityScope,
  ): Promise<Facility> {
    this.assertManagerScope(scope);
    const existing = await this.facilitiesRepository.findAccessibleById(id, scope);
    if (!existing) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }

    if (input.code && input.code !== existing.code) {
      const codeDuplicate = await this.facilitiesRepository.findByCode(input.code);
      if (codeDuplicate) {
        throw new ConflictError(FACILITY_MESSAGES.facilityCodeAlreadyExists(input.code));
      }
    }

    if (
      existing.isActive &&
      input.isActive === false &&
      (await this.facilitiesRepository.hasOpenOperations(id))
    ) {
      throw new ConflictError(FACILITY_MESSAGES.facilityHasOpenBookings);
    }

    const updated = await this.facilitiesRepository.updateAccessible(id, input, scope);
    if (!updated) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }
    return updated;
  }

  private assertManagerScope(scope: FacilityScope): void {
    if (scope.kind === "assigned" && scope.role !== "FACILITY_MANAGER") {
      throw new ForbiddenError(FACILITY_MESSAGES.facilityOperationDenied);
    }
  }
}
