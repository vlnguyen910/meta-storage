import {
  and,
  asc,
  capacityAllocations,
  type Database,
  desc,
  eq,
  type Facility,
  facilities,
  gt,
  inArray,
  type NewFacility,
  or,
  ReservationStatus,
  reservations,
  systemSettingInteger,
  systemSettings,
} from "@metastorage/database";
import type { FacilityListScope, FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";
import { FacilityAssignmentsRepository } from "./facility-assignments.repository";

export class FacilitiesRepository {
  private readonly assignmentsRepository: FacilityAssignmentsRepository;

  constructor(private readonly db: Database) {
    this.assignmentsRepository = new FacilityAssignmentsRepository(db);
  }

  async globalOperatingHours() {
    const rows = await this.db
      .select({ key: systemSettings.key, value: systemSettingInteger })
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["OPENING_HOUR", "CLOSING_HOUR"]));
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return values.OPENING_HOUR === undefined || values.CLOSING_HOUR === undefined
      ? undefined
      : {
          openingHour: values.OPENING_HOUR,
          closingHour: values.CLOSING_HOUR,
        };
  }

  async createFacility(data: NewFacility): Promise<Facility> {
    const [created] = await this.db.insert(facilities).values(data).returning();
    if (!created) {
      throw new Error(FACILITY_MESSAGES.failedToCreateFacility);
    }
    return created;
  }

  async findById(id: string): Promise<Facility | undefined> {
    const [facility] = await this.db.select().from(facilities).where(eq(facilities.id, id));
    return facility;
  }

  async findAccessibleById(id: string, scope: FacilityScope): Promise<Facility | undefined> {
    const [facility] = await this.db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.id, id),
          scope.kind === "assigned"
            ? this.assignmentsRepository.activeAssignmentExists(facilities.id, scope)
            : undefined,
        ),
      );
    return facility;
  }

  async findByCode(code: string): Promise<Facility | undefined> {
    const [facility] = await this.db.select().from(facilities).where(eq(facilities.code, code));
    return facility;
  }

  async getAllFacilities(limit: number, offset: number, isActive: boolean) {
    return this.db
      .select()
      .from(facilities)
      .where(eq(facilities.isActive, isActive))
      .limit(limit)
      .offset(offset)
      .orderBy(asc(facilities.createdAt));
  }

  async listAccessible(
    limit: number,
    offset: number,
    isActive: boolean | undefined,
    scope: FacilityListScope,
  ): Promise<Facility[]> {
    return this.db
      .select()
      .from(facilities)
      .where(
        and(
          isActive === undefined ? undefined : eq(facilities.isActive, isActive),
          scope.kind === "assigned"
            ? this.assignmentsRepository.activeAssignmentExists(facilities.id, scope)
            : undefined,
        ),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(facilities.createdAt));
  }

  async updateAccessible(
    id: string,
    data: Partial<NewFacility>,
    scope: FacilityScope,
  ): Promise<Facility | undefined> {
    const [updated] = await this.db
      .update(facilities)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(facilities.id, id),
          scope.kind === "assigned"
            ? this.assignmentsRepository.activeAssignmentExists(id, scope)
            : undefined,
        ),
      )
      .returning();
    return updated;
  }

  async hasOpenOperations(id: string): Promise<boolean> {
    const now = new Date();
    const [booking] = await this.db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.facilityId, id),
          inArray(reservations.status, [
            ReservationStatus.DRAFT,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
          ]),
        ),
      )
      .limit(1);
    if (booking) return true;

    const [allocation] = await this.db
      .select({ id: capacityAllocations.id })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.facilityId, id),
          eq(capacityAllocations.status, "ACTIVE"),
          or(
            inArray(capacityAllocations.kind, ["BOOKING", "RESERVATION"]),
            and(eq(capacityAllocations.kind, "HOLD"), gt(capacityAllocations.expiresAt, now)),
          ),
        ),
      )
      .limit(1);
    return Boolean(allocation);
  }
}
