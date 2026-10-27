import type {
  ConfigureOverdueRate,
  ConfigureReturnChecklist,
  ConfirmReturnRefund,
  ConfirmReturnRefundDto,
  CreateReturnRequest,
  ProposeReturnTime,
  ReturnActor,
  ReturnChecklistVersionDto,
  ReturnEvidenceInput,
  ReturnInspectionDto,
  ReturnOperationalContextDto,
  ReturnQueueQuery,
  ReturnRequestDetailDto,
  ReturnRequestDto,
  ReturnSettlementDto,
  ReturnSettlementPreviewDto,
  SaveReturnInspection,
  SettleReturn,
} from "@metastorage/contracts";
import {
  ReturnSettlementBlockerCode as blockerCode,
  RETURN_MESSAGES as m,
} from "@metastorage/contracts";
import type { returnInspections, returnSettlements } from "@metastorage/database";
import { CloudinaryPhotoStorage } from "../../common/adapters/storage/cloudinary-photo.storage";
import type { InspectionPhotoStorage } from "../../common/adapters/storage/photo-storage.types";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import { decodePhoto } from "../inspections/inspections.policy";
import { recordOverdueEvent } from "../rentals/rental-lifecycle.events";
import {
  calculateSettlement,
  depositEntitlement,
  refundAllocation,
  refundDueDate,
  refundSummary,
  reviewInspection,
  wholeVnd,
} from "./returns.policy";
import type { ReturnsRepository } from "./returns.repository";
import type {
  ReturnContext,
  ReturnCustomerActor,
  ReturnOperationalRow,
  ReturnRequestRow,
  ReturnTransaction,
} from "./returns.types";

const requestDto = (row: ReturnRequestRow): ReturnRequestDto => ({
  id: row.id,
  rentalId: row.rentalId,
  facilityId: row.facilityId,
  status: row.status,
  version: row.version,
  assignedStaffId: row.assignedStaffId,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  timezone: row.timezone,
  reason: row.reason,
  manualReviewRequired: row.manualReviewRequired,
  createdAt: row.createdAt.toISOString(),
});
const operationalDto = (row: ReturnOperationalRow): ReturnOperationalContextDto => ({
  booking: { id: row.bookingId, bookingCode: row.bookingCode },
  customer: { id: row.customerId, name: row.customerName, phone: row.customerPhone },
  rental: {
    id: row.rentalId,
    status: row.rentalStatus,
    expectedEndAt: row.expectedEndAt.toISOString(),
    depositSnapshot: wholeVnd(row.depositAmount).toString(),
  },
  unit: {
    id: row.unitId,
    code: row.unitCode,
    unitTypeName: row.unitTypeName,
    sizeLabel: row.sizeLabel,
  },
  facility: { id: row.facilityId, name: row.facilityName },
  assignedStaff:
    row.staffId && row.staffName !== null ? { id: row.staffId, name: row.staffName } : null,
});
const inspectionDto = (row: typeof returnInspections.$inferSelect): ReturnInspectionDto => ({
  id: row.id,
  requestId: row.requestId,
  attempt: row.attempt,
  status: row.status,
  version: row.version,
  checklistVersionId: row.checklistVersionId,
  definition: row.definition,
  results: row.results,
  propertyDisposition: row.propertyDisposition,
  propertyReceiver: row.propertyReceiver,
  propertyHandledAt: row.propertyHandledAt?.toISOString() ?? null,
  propertyEvidencePhotoIds: row.propertyEvidencePhotoIds,
  createdBy: row.createdBy,
  completedBy: row.completedBy,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
const settlementDto = (
  row: typeof returnSettlements.$inferSelect,
  paid: bigint,
): ReturnSettlementDto => ({
  id: row.id,
  requestId: row.requestId,
  revision: row.revision,
  depositSnapshot: row.depositSnapshot,
  rateSnapshot: row.rateSnapshot,
  overdueFeeAmount: row.overdueFeeAmount,
  damageAmount: row.damageAmount,
  unusedRentRefundAmount: row.unusedRentRefundAmount,
  refundEntitlement: row.refundEntitlement,
  debtAmount: row.debtAmount,
  remainingRefund: (wholeVnd(row.refundEntitlement) > paid
    ? wholeVnd(row.refundEntitlement) - paid
    : 0n
  ).toString(),
  actualReturnAt: row.actualReturnAt.toISOString(),
  refundDueDate: row.refundDueDate,
  approvedBy: row.approvedBy,
  approvedAt: row.approvedAt.toISOString(),
});

export class ReturnsService {
  constructor(
    readonly repository: ReturnsRepository,
    private readonly storage: InspectionPhotoStorage = new CloudinaryPhotoStorage(),
  ) {}

  private role(actor: ReturnActor, role: string) {
    if (actor.role !== role) throw new ForbiddenError(m.forbidden);
  }
  private version(actual: number, expected: number) {
    if (actual !== expected) throw new ConflictError(m.conflict);
  }
  private async manager(tx: ReturnTransaction, actor: ReturnActor, facilityId: string) {
    this.role(actor, "FACILITY_MANAGER");
    if (!(await this.repository.member(tx, facilityId, actor.id, "FACILITY_MANAGER")))
      throw new ForbiddenError(m.forbidden);
  }
  private async staff(tx: ReturnTransaction, actor: ReturnActor, request: ReturnRequestRow) {
    this.role(actor, "FACILITY_STAFF");
    if (
      request.assignedStaffId !== actor.id ||
      !(await this.repository.member(tx, request.facilityId, actor.id, "FACILITY_STAFF"))
    )
      throw new ForbiddenError(m.forbidden);
  }
  private async reader(
    tx: ReturnTransaction,
    actor: ReturnActor,
    context: ReturnContext,
    request: ReturnRequestRow,
  ) {
    if (actor.role === "CUSTOMER") {
      if (context.booking.userId !== actor.id) throw new NotFoundError(m.notFound);
    } else if (actor.role === "FACILITY_MANAGER") await this.manager(tx, actor, request.facilityId);
    else await this.staff(tx, actor, request);
  }

  private customer(actor: ReturnCustomerActor, context: ReturnContext) {
    this.role(actor, "CUSTOMER");
    if (context.booking.userId !== actor.id) throw new NotFoundError(m.notFound);
  }

  private async availableSlots(
    tx: ReturnTransaction,
    facilityId: string,
    date: string,
    excludeId?: string,
  ) {
    const schedule = await this.repository.schedule(tx, facilityId, date);
    const hours = schedule.hours[0];
    if (!hours) throw new ConflictError(m.configurationMissing);
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const result = [];
    for (const slot of schedule.slots) {
      if (
        minutes(slot.endTime) - minutes(slot.startTime) !== 90 ||
        slot.startTime < hours.openTime ||
        slot.endTime > hours.closeTime
      )
        continue;
      const times = await this.repository.slotTimes(
        tx,
        date,
        slot.startTime,
        slot.endTime,
        hours.timezone,
      );
      if (
        schedule.appointments.some(
          (other) =>
            other.id !== excludeId &&
            times.startsAt.getTime() < other.endsAt.getTime() + 15 * 60000 &&
            times.endsAt.getTime() + 15 * 60000 > other.startsAt.getTime(),
        )
      )
        continue;
      result.push({ slotId: slot.id, date, ...times, timezone: hours.timezone });
    }
    return result;
  }

  async queue(actor: ReturnActor, facilityId: string, query: ReturnQueueQuery) {
    return this.repository.db.transaction(async (tx) => {
      if (actor.role === "FACILITY_MANAGER") await this.manager(tx, actor, facilityId);
      else {
        this.role(actor, "FACILITY_STAFF");
        if (!(await this.repository.member(tx, facilityId, actor.id, "FACILITY_STAFF")))
          throw new ForbiddenError(m.forbidden);
      }
      const requests = await this.repository.queue(
        tx,
        facilityId,
        query,
        actor.role === "FACILITY_STAFF" ? actor.id : undefined,
      );
      const contexts = new Map(
        (
          await this.repository.operationalContexts(
            tx,
            requests.map((r) => r.id),
          )
        ).map((row) => [row.requestId, operationalDto(row)]),
      );
      return requests.map((row) => {
        const context = contexts.get(row.id);
        if (!context) throw new NotFoundError(m.notFound);
        return { ...requestDto(row), context };
      });
    });
  }
  async list(actor: ReturnCustomerActor, rentalId: string) {
    return this.repository.locked(rentalId, async (tx, context) => {
      this.customer(actor, context);
      return (await this.repository.requestsForRental(tx, rentalId)).map(requestDto);
    });
  }
  async slots(actor: ReturnCustomerActor, rentalId: string, date: string) {
    return this.repository.locked(rentalId, async (tx, context) => {
      this.customer(actor, context);
      if (context.rental.closedAt || context.rental.status === "CLOSED")
        throw new ConflictError(m.conflict);
      const slots = await this.availableSlots(tx, context.rental.facilityId, date);
      return slots
        .filter((slot) => slot.startsAt.getTime() >= Date.now() + 24 * 3600000)
        .map((slot) => ({
          ...slot,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
        }));
    });
  }

  private async validateSlot(
    tx: ReturnTransaction,
    facilityId: string,
    input: CreateReturnRequest,
    notice: boolean,
    excludeId?: string,
  ) {
    const slots = await this.availableSlots(tx, facilityId, input.date, excludeId);
    const slot = slots.find((candidate) => candidate.slotId === input.slotId);
    if (!slot) throw new ConflictError(m.invalidSlot);
    if (notice && slot.startsAt.getTime() < Date.now() + 24 * 3600000)
      throw new ValidationError(m.notice);
    if (slot.startsAt.getTime() <= Date.now()) throw new ConflictError(m.invalidSlot);
    return slot;
  }

  async create(actor: ReturnCustomerActor, rentalId: string, input: CreateReturnRequest) {
    return this.repository.locked(rentalId, async (tx, context) => {
      this.customer(actor, context);
      if (
        context.rental.closedAt ||
        !["ACTIVE", "RETURN_PENDING", "OVERDUE"].includes(context.rental.status)
      )
        throw new ConflictError(m.conflict);
      if (await this.repository.openRequest(tx, rentalId)) throw new ConflictError(m.conflict);
      const slot = await this.validateSlot(tx, context.rental.facilityId, input, true);
      const row = await this.repository.insertRequest(tx, {
        rentalId,
        facilityId: context.rental.facilityId,
        slotId: slot.slotId,
        date: input.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        reason: input.reason,
        status: "PENDING",
        createdBy: actor.id,
      });
      if (context.rental.status === "ACTIVE")
        await this.repository.updateRental(tx, rentalId, { status: "RETURN_PENDING" });
      await this.repository.audit(
        tx,
        actor.id,
        "RETURN_REQUEST_CREATED",
        {
          slotId: slot.slotId,
          date: input.date,
        },
        row.id,
        row.facilityId,
      );
      return requestDto(row);
    });
  }

  async edit(
    actor: ReturnActor,
    id: string,
    input: CreateReturnRequest & { expectedVersion: number },
  ) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      this.customer(actor, context);
      this.version(request.version, input.expectedVersion);
      if (request.status !== "PENDING") throw new ConflictError(m.conflict);
      const slot = await this.validateSlot(tx, request.facilityId, input, true, id);
      const row = await this.repository.updateRequest(tx, id, {
        slotId: slot.slotId,
        date: input.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        reason: input.reason,
      });
      await this.repository.audit(
        tx,
        actor.id,
        "RETURN_REQUEST_EDITED",
        {
          before: request.startsAt.toISOString(),
          after: row.startsAt.toISOString(),
          reason: input.reason,
        },
        id,
        request.facilityId,
      );
      return requestDto(row);
    });
  }

  async cancel(actor: ReturnActor, id: string, expectedVersion: number) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      this.customer(actor, context);
      this.version(request.version, expectedVersion);
      if (request.status !== "PENDING") throw new ConflictError(m.conflict);
      const row = await this.repository.updateRequest(tx, id, { status: "CANCELLED" });
      if (context.rental.status === "RETURN_PENDING") {
        const now = new Date();
        const status = now >= context.rental.expectedEndAt ? "OVERDUE" : "ACTIVE";
        await this.repository.updateRental(tx, context.rental.id, { status });
        if (status === "OVERDUE")
          await recordOverdueEvent(tx, context.rental, request.timezone, now);
      }
      await this.repository.audit(
        tx,
        actor.id,
        "RETURN_REQUEST_CANCELLED",
        {},
        id,
        request.facilityId,
      );
      return requestDto(row);
    });
  }

  async confirm(actor: ReturnActor, id: string, expectedVersion: number) {
    return this.repository.lockedRequest(id, async (tx, _context, request) => {
      if (actor.role === "FACILITY_MANAGER") await this.manager(tx, actor, request.facilityId);
      else await this.staff(tx, actor, request);
      if (request.status === "CONFIRMED") return requestDto(request);
      this.version(request.version, expectedVersion);
      if (request.status !== "PENDING") throw new ConflictError(m.conflict);
      // Serialize all facility reservations, including different slots whose buffers overlap.
      await this.repository.lockFacility(tx, request.facilityId);
      const slot = await this.validateSlot(
        tx,
        request.facilityId,
        { date: request.date, slotId: request.slotId, reason: request.reason },
        false,
        id,
      );
      if (
        slot.startsAt.getTime() !== request.startsAt.getTime() ||
        slot.endsAt.getTime() !== request.endsAt.getTime() ||
        slot.timezone !== request.timezone
      )
        throw new ConflictError(m.invalidSlot);
      const row = await this.repository.updateRequest(tx, id, { status: "CONFIRMED" });
      await this.repository.audit(
        tx,
        actor.id,
        "RETURN_REQUEST_CONFIRMED",
        { startsAt: row.startsAt.toISOString() },
        id,
        request.facilityId,
      );
      return requestDto(row);
    });
  }

  async configureChecklist(
    actor: ReturnActor,
    input: ConfigureReturnChecklist,
  ): Promise<ReturnChecklistVersionDto> {
    this.role(actor, "SYSTEM_ADMIN");
    return this.repository.db.transaction(async (tx) => {
      await this.repository.lockChecklist(tx);
      const before = await this.repository.checklist(tx);
      this.version(before?.version ?? 0, input.expectedVersion);
      const row = await this.repository.saveChecklist(tx, {
        version: input.expectedVersion + 1,
        items: input.items,
        createdBy: actor.id,
      });
      if (!row) throw new ConflictError(m.conflict);
      await this.repository.audit(tx, actor.id, "CHECKLIST_CONFIGURED", {
        before: before?.items ?? null,
        after: input.items,
        version: row.version,
      });
      return {
        id: row.id,
        version: row.version,
        items: row.items,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
  async checklist(actor: ReturnActor) {
    this.role(actor, "SYSTEM_ADMIN");
    const row = await this.repository.checklist();
    return row
      ? {
          id: row.id,
          version: row.version,
          items: row.items,
          createdAt: row.createdAt.toISOString(),
        }
      : null;
  }
  async rate(actor: ReturnActor) {
    this.role(actor, "BUSINESS_OPERATION_MANAGER");
    const row = await this.repository.rate();
    if (!row) throw new ConflictError(m.configurationMissing);
    return { rate: row.rate, version: row.version };
  }
  async configureRate(actor: ReturnActor, input: ConfigureOverdueRate) {
    this.role(actor, "BUSINESS_OPERATION_MANAGER");
    return this.repository.db.transaction(async (tx) => {
      const before = await this.repository.lockRate(tx);
      if (!before) throw new ConflictError(m.configurationMissing);
      this.version(before.version, input.expectedVersion);
      await this.repository.saveRate(tx, input.rate, before.version + 1, actor.id, before.rate);
      await this.repository.audit(tx, actor.id, "OVERDUE_RATE_CONFIGURED", {
        before: before.rate,
        after: input.rate,
        version: before.version + 1,
      });
      return { rate: input.rate, version: before.version + 1 };
    });
  }

  private async operationalContext(tx: ReturnTransaction, id: string) {
    const [row] = await this.repository.operationalContexts(tx, [id]);
    if (!row) throw new NotFoundError(m.notFound);
    return operationalDto(row);
  }

  async get(actor: ReturnActor, id: string): Promise<ReturnRequestDetailDto> {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.reader(tx, actor, context, request);
      const [inspections, settlements, refunds, changes, audit] = await Promise.all([
        this.repository.inspections(tx, id),
        this.repository.settlements(tx, id),
        this.repository.refunds(tx, id),
        this.repository.timeChanges(tx, id),
        this.repository.auditHistory(tx, id),
      ]);
      const paid = refunds.reduce((sum, r) => sum + wholeVnd(r.amount), 0n);
      return {
        request: requestDto(request),
        context: actor.role === "CUSTOMER" ? null : await this.operationalContext(tx, id),
        refundSummary: settlements[0] ? refundSummary(settlements[0], settlements, refunds) : null,
        actualReturnAt: context.rental.actualReturnAt?.toISOString() ?? null,
        inspections: await Promise.all(
          inspections.map(async (inspection) => ({
            ...inspectionDto(inspection),
            photos: (await this.repository.photos(tx, inspection.id)).map((photo) => ({
              id: photo.id,
              filename: photo.filename,
              mimeType: photo.mimeType,
              byteSize: photo.byteSize,
            })),
          })),
        ),
        evidence: (await this.repository.evidence(tx, id)).map((photo) => ({
          id: photo.id,
          filename: photo.filename,
          mimeType: photo.mimeType,
          byteSize: photo.byteSize,
          purpose: photo.purpose,
        })),
        settlements: settlements.map((row) => settlementDto(row, paid)),
        timeChanges: changes.map((c) => ({
          id: c.id,
          previousAt: c.previousAt?.toISOString() ?? null,
          proposedAt: c.proposedAt.toISOString(),
          status: c.status,
          reason: c.reason,
          proposedBy: c.proposedBy,
          decidedBy: c.decidedBy,
          decidedAt: c.decidedAt?.toISOString() ?? null,
          decisionReason: c.decisionReason,
          evidencePhotoIds: c.evidencePhotoIds,
          createdAt: c.createdAt.toISOString(),
        })),
        refunds: refunds.map((r) => ({
          id: r.id,
          amount: r.amount,
          depositRefundAmount: r.depositRefundAmount,
          rentRefundAmount: r.rentRefundAmount,
          reference: r.reference,
          confirmedBy: r.confirmedBy,
          confirmedAt: r.confirmedAt.toISOString(),
          settlementId: r.settlementId,
        })),
        audit: audit.map((a) => ({
          id: a.id,
          action: a.action,
          actorId: a.actorId,
          details: a.details,
          createdAt: a.createdAt.toISOString(),
        })),
      };
    });
  }

  async assign(
    actor: ReturnActor,
    id: string,
    expectedVersion: number,
    staffId: string,
    reason: string,
  ) {
    return this.repository.lockedRequest(id, async (tx, _context, request) => {
      await this.manager(tx, actor, request.facilityId);
      this.version(request.version, expectedVersion);
      if (request.status === "CANCELLED") throw new ConflictError(m.conflict);
      if (!(await this.repository.member(tx, request.facilityId, staffId, "FACILITY_STAFF")))
        throw new ForbiddenError(m.forbidden);
      const row = await this.repository.updateRequest(tx, id, { assignedStaffId: staffId });
      await this.repository.audit(
        tx,
        actor.id,
        "STAFF_ASSIGNED",
        { previousStaffId: request.assignedStaffId, staffId, reason },
        id,
        request.facilityId,
      );
      return requestDto(row);
    });
  }

  async startInspection(actor: ReturnActor, id: string, expectedVersion: number) {
    return this.repository.lockedRequest(id, async (tx, _context, request) => {
      await this.staff(tx, actor, request);
      const [previous] = await this.repository.inspections(tx, id);
      if (request.status === "INSPECTING" && previous?.status === "DRAFT")
        return inspectionDto(previous);
      this.version(request.version, expectedVersion);
      if (!["CONFIRMED", "FAILED"].includes(request.status)) throw new ConflictError(m.conflict);
      const checklist = await this.repository.checklist(tx);
      if (!checklist) throw new ConflictError(m.configurationMissing);
      const row = await this.repository.insertInspection(tx, {
        requestId: id,
        attempt: (previous?.attempt ?? 0) + 1,
        checklistVersionId: checklist.id,
        definition: checklist.items,
        createdBy: actor.id,
      });
      await this.repository.updateRequest(tx, id, { status: "INSPECTING" });
      await this.repository.audit(
        tx,
        actor.id,
        "INSPECTION_STARTED",
        { previousStatus: request.status, inspectionId: row.id, attempt: row.attempt },
        id,
        request.facilityId,
      );
      return inspectionDto(row);
    });
  }

  private async currentInspection(
    tx: ReturnTransaction,
    request: ReturnRequestRow,
    inspectionId: string,
  ) {
    const [row] = await this.repository.inspections(tx, request.id);
    if (!row || row.id !== inspectionId) throw new NotFoundError(m.notFound);
    return row;
  }
  private validateTime(context: ReturnContext, value: Date) {
    if (value < context.rental.startAt || value.getTime() > Date.now())
      throw new ValidationError(m.invalidTime);
  }
  async recordReceipt(
    actor: ReturnActor,
    id: string,
    expectedVersion: number,
    value: string,
    reason: string,
  ) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.staff(tx, actor, request);
      const at = new Date(value);
      this.validateTime(context, at);
      if (context.rental.actualReturnAt?.getTime() === at.getTime()) return requestDto(request);
      this.version(request.version, expectedVersion);
      if (
        context.rental.actualReturnAt ||
        !["CONFIRMED", "INSPECTING", "FAILED"].includes(request.status)
      )
        throw new ConflictError(m.conflict);
      await this.repository.updateRental(tx, context.rental.id, { actualReturnAt: at });
      const row = await this.repository.updateRequest(tx, id, {});
      await this.repository.audit(
        tx,
        actor.id,
        "PHYSICAL_RETURN_CONFIRMED",
        { actualReturnAt: at.toISOString(), recordedAt: new Date().toISOString(), reason },
        id,
        request.facilityId,
      );
      return requestDto(row);
    });
  }
  async saveInspection(
    actor: ReturnActor,
    id: string,
    inspectionId: string,
    input: SaveReturnInspection,
  ) {
    return this.repository.lockedRequest(id, async (tx, _context, request) => {
      await this.staff(tx, actor, request);
      const inspection = await this.currentInspection(tx, request, inspectionId);
      this.version(inspection.version, input.expectedVersion);
      if (request.status !== "INSPECTING" || inspection.status !== "DRAFT")
        throw new ConflictError(m.conflict);
      const photos = await this.repository.photos(tx, inspectionId);
      const allowed = new Set(photos.map((p) => p.id));
      if (
        [...input.results.flatMap((r) => r.photoIds), ...input.propertyEvidencePhotoIds].some(
          (photoId) => !allowed.has(photoId),
        )
      )
        throw new ValidationError(m.evidence);
      if (
        input.propertyDisposition !== "NONE" &&
        (!input.propertyHandledAt ||
          new Date(input.propertyHandledAt).getTime() > Date.now() ||
          !input.propertyEvidencePhotoIds.length ||
          (input.propertyDisposition === "STORED" && !input.propertyReceiver))
      )
        throw new ValidationError(m.propertyUnresolved);
      const row = await this.repository.updateInspection(tx, inspectionId, {
        results: input.results,
        propertyDisposition: input.propertyDisposition,
        propertyReceiver: input.propertyReceiver,
        propertyHandledAt: input.propertyHandledAt ? new Date(input.propertyHandledAt) : null,
        propertyEvidencePhotoIds: input.propertyEvidencePhotoIds,
      });
      await this.repository.audit(
        tx,
        actor.id,
        "INSPECTION_SAVED",
        {
          inspectionId,
          version: row.version,
          before: {
            results: inspection.results,
            propertyDisposition: inspection.propertyDisposition,
            propertyReceiver: inspection.propertyReceiver,
            propertyHandledAt: inspection.propertyHandledAt?.toISOString() ?? null,
            propertyEvidencePhotoIds: inspection.propertyEvidencePhotoIds,
          },
          after: {
            results: row.results,
            propertyDisposition: row.propertyDisposition,
            propertyReceiver: row.propertyReceiver,
            propertyHandledAt: row.propertyHandledAt?.toISOString() ?? null,
            propertyEvidencePhotoIds: row.propertyEvidencePhotoIds,
          },
        },
        id,
        request.facilityId,
      );
      return inspectionDto(row);
    });
  }
  async completeInspection(
    actor: ReturnActor,
    id: string,
    inspectionId: string,
    expectedVersion: number,
  ) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.staff(tx, actor, request);
      const inspection = await this.currentInspection(tx, request, inspectionId);
      if (inspection.status !== "DRAFT") return inspectionDto(inspection);
      this.version(inspection.version, expectedVersion);
      if (request.status !== "INSPECTING") throw new ConflictError(m.conflict);
      const photos = await this.repository.photos(tx, inspectionId);
      const status = reviewInspection(
        inspection.definition,
        inspection.results,
        photos.map((p) => p.id),
      );
      const row = await this.repository.updateInspection(tx, inspectionId, {
        status,
        completedBy: actor.id,
        completedAt: new Date(),
      });
      if (status === "FAIL") {
        await this.repository.updateRequest(tx, id, { status: "FAILED" });
        await this.repository.updateUnit(tx, context.rental.physicalUnitId, "MAINTENANCE");
      }
      await this.repository.audit(
        tx,
        actor.id,
        "INSPECTION_COMPLETED",
        { inspectionId, status },
        id,
        request.facilityId,
      );
      return inspectionDto(row);
    });
  }

  async uploadPhoto(
    actor: ReturnActor,
    id: string,
    inspectionId: string,
    input: { expectedVersion: number; filename: string; mimeType: string; dataBase64: string },
  ) {
    const bytes = decodePhoto(input.mimeType, input.dataBase64);
    await this.repository.lockedRequest(id, async (tx, _context, request) => {
      await this.staff(tx, actor, request);
      const inspection = await this.currentInspection(tx, request, inspectionId);
      this.version(inspection.version, input.expectedVersion);
      if (
        request.status !== "INSPECTING" ||
        !["DRAFT", "PASS"].includes(inspection.status) ||
        (await this.repository.photos(tx, inspectionId)).length >= 5
      )
        throw new ConflictError(m.incomplete);
    });
    const stored = await this.storage.upload(
      `return-${inspectionId}`,
      input.mimeType,
      input.dataBase64,
    );
    try {
      return await this.repository.lockedRequest(id, async (tx, _context, request) => {
        await this.staff(tx, actor, request);
        const inspection = await this.currentInspection(tx, request, inspectionId);
        this.version(inspection.version, input.expectedVersion);
        if (
          request.status !== "INSPECTING" ||
          !["DRAFT", "PASS"].includes(inspection.status) ||
          (await this.repository.photos(tx, inspectionId)).length >= 5
        )
          throw new ConflictError(m.incomplete);
        const photo = await this.repository.insertPhoto(tx, {
          inspectionId,
          uploadedBy: actor.id,
          filename: input.filename,
          mimeType: input.mimeType,
          byteSize: bytes.length,
          publicId: stored.publicId,
          format: stored.format,
        });
        await this.repository.updateInspection(tx, inspectionId, {});
        return {
          id: photo.id,
          inspectionId,
          filename: photo.filename,
          mimeType: photo.mimeType,
          byteSize: photo.byteSize,
        };
      });
    } catch (error) {
      // Unexpected errors can mean COMMIT succeeded but its acknowledgement was lost.
      // Keep the object for reconciliation rather than deleting committed evidence.
      if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500)
        await this.storage
          .remove(stored.publicId)
          .catch(() => console.error("Return photo cleanup failed"));
      throw error;
    }
  }
  async photo(actor: ReturnActor, id: string, inspectionId: string, photoId: string) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.reader(tx, actor, context, request);
      const inspections = await this.repository.inspections(tx, id);
      if (!inspections.some((i) => i.id === inspectionId)) throw new NotFoundError(m.notFound);
      const row = (await this.repository.photos(tx, inspectionId)).find((p) => p.id === photoId);
      if (!row) throw new NotFoundError(m.notFound);
      return {
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        url: this.storage.readUrl(row.publicId, row.format),
      };
    });
  }
  private async verifyEvidence(
    tx: ReturnTransaction,
    id: string,
    photoIds: string[],
    purpose: "TIME_CORRECTION" | "REFUND" = "TIME_CORRECTION",
  ) {
    const inspections = await this.repository.inspections(tx, id);
    const groups = await Promise.all(inspections.map((i) => this.repository.photos(tx, i.id)));
    const extra = (await this.repository.evidence(tx, id)).filter((p) => p.purpose === purpose);
    const known = new Set([
      ...(purpose === "TIME_CORRECTION" ? groups.flatMap((group) => group.map((p) => p.id)) : []),
      ...extra.map((p) => p.id),
    ]);
    if (!photoIds.length || photoIds.some((photoId) => !known.has(photoId)))
      throw new ValidationError(m.evidence);
  }

  async uploadEvidence(actor: ReturnActor, id: string, input: ReturnEvidenceInput) {
    const bytes = decodePhoto(input.mimeType, input.dataBase64);
    const authorize = async (tx: ReturnTransaction, request: ReturnRequestRow) => {
      if (input.purpose === "REFUND") await this.manager(tx, actor, request.facilityId);
      else await this.staff(tx, actor, request);
      this.version(request.version, input.expectedVersion);
      if (request.status === "CANCELLED") throw new ConflictError(m.conflict);
    };
    await this.repository.lockedRequest(id, async (tx, _context, request) =>
      authorize(tx, request),
    );
    const stored = await this.storage.upload(
      `return-evidence-${id}`,
      input.mimeType,
      input.dataBase64,
    );
    try {
      return await this.repository.lockedRequest(id, async (tx, _context, request) => {
        await authorize(tx, request);
        const row = await this.repository.insertEvidence(tx, {
          requestId: id,
          purpose: input.purpose,
          uploadedBy: actor.id,
          filename: input.filename,
          mimeType: input.mimeType,
          byteSize: bytes.length,
          publicId: stored.publicId,
          format: stored.format,
        });
        await this.repository.updateRequest(tx, id, {});
        await this.repository.audit(
          tx,
          actor.id,
          "EVIDENCE_UPLOADED",
          { photoId: row.id, purpose: row.purpose },
          id,
          request.facilityId,
        );
        return { id: row.id, filename: row.filename, mimeType: row.mimeType, purpose: row.purpose };
      });
    } catch (error) {
      if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500)
        await this.storage
          .remove(stored.publicId)
          .catch(() => console.error("Return evidence cleanup failed"));
      throw error;
    }
  }
  async evidencePhoto(actor: ReturnActor, id: string, photoId: string) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.reader(tx, actor, context, request);
      const row = (await this.repository.evidence(tx, id)).find((p) => p.id === photoId);
      if (!row) throw new NotFoundError(m.notFound);
      return {
        id: row.id,
        filename: row.filename,
        purpose: row.purpose,
        url: this.storage.readUrl(row.publicId, row.format),
      };
    });
  }
  async property(
    actor: ReturnActor,
    id: string,
    inspectionId: string,
    input: Omit<SaveReturnInspection, "results">,
  ) {
    return this.repository.lockedRequest(id, async (tx, _context, request) => {
      await this.staff(tx, actor, request);
      // Property obligations belong to the attempt that recorded them, including FAILED attempts.
      // Only disposition metadata changes; preserve the completed checklist and PASS/FAIL result.
      const inspection = (await this.repository.inspections(tx, id)).find(
        (row) => row.id === inspectionId,
      );
      if (!inspection) throw new NotFoundError(m.notFound);
      this.version(inspection.version, input.expectedVersion);
      if (!["INSPECTING", "FAILED"].includes(request.status)) throw new ConflictError(m.conflict);
      const attempts = await this.repository.inspections(tx, id);
      const photos = (
        await Promise.all(attempts.map((attempt) => this.repository.photos(tx, attempt.id)))
      ).flat();
      const allowed = new Set(photos.map((photo) => photo.id));
      if (input.propertyEvidencePhotoIds.some((photoId) => !allowed.has(photoId)))
        throw new ValidationError(m.evidence);
      if (
        input.propertyDisposition !== "NONE" &&
        (!input.propertyHandledAt ||
          new Date(input.propertyHandledAt).getTime() > Date.now() ||
          !input.propertyEvidencePhotoIds.length ||
          (input.propertyDisposition === "STORED" && !input.propertyReceiver))
      )
        throw new ValidationError(m.propertyUnresolved);
      const row = await this.repository.updateInspection(tx, inspectionId, {
        propertyDisposition: input.propertyDisposition,
        propertyReceiver: input.propertyReceiver,
        propertyHandledAt: input.propertyHandledAt ? new Date(input.propertyHandledAt) : null,
        propertyEvidencePhotoIds: input.propertyEvidencePhotoIds,
      });
      await this.repository.audit(
        tx,
        actor.id,
        "PROPERTY_DISPOSITION_RECORDED",
        {
          inspectionId,
          previousDisposition: inspection.propertyDisposition,
          evidenceSources: photos
            .filter((photo) => row.propertyEvidencePhotoIds.includes(photo.id))
            .map((photo) => ({ photoId: photo.id, inspectionId: photo.inspectionId })),
          disposition: row.propertyDisposition,
          receiver: row.propertyReceiver,
          handledAt: row.propertyHandledAt?.toISOString(),
          evidencePhotoIds: row.propertyEvidencePhotoIds,
        },
        id,
        request.facilityId,
      );
      return inspectionDto(row);
    });
  }

  async confirmRefund(
    actor: ReturnActor,
    id: string,
    input: ConfirmReturnRefund,
  ): Promise<ConfirmReturnRefundDto> {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.manager(tx, actor, request.facilityId);
      const refunds = await this.repository.refunds(tx, id);
      const settlements = await this.repository.settlements(tx, id);
      const [settlement] = settlements;
      if (!settlement) throw new ConflictError(m.refund);
      const summary = refundSummary(settlement, settlements, refunds);
      const existing = refunds.find((r) => r.idempotencyKey === input.idempotencyKey);
      if (existing) {
        const legacyReplay =
          existing.depositRefundAmount === null &&
          existing.rentRefundAmount === null &&
          input.depositRefundAmount === undefined &&
          input.rentRefundAmount === undefined;
        const origin = settlements.find((row) => row.id === existing.settlementId);
        const saved = origin
          ? refundAllocation(
              wholeVnd(existing.amount),
              depositEntitlement(origin),
              wholeVnd(origin.unusedRentRefundAmount),
              existing.depositRefundAmount,
              existing.rentRefundAmount,
              true,
            )
          : undefined;
        // A single-source retry uses its stored allocation, even after later refunds/corrections.
        const allocation =
          input.depositRefundAmount === undefined &&
          input.rentRefundAmount === undefined &&
          saved &&
          (saved.deposit === 0n || saved.rent === 0n)
            ? saved
            : origin
              ? refundAllocation(
                  wholeVnd(input.amount),
                  depositEntitlement(origin),
                  wholeVnd(origin.unusedRentRefundAmount),
                  input.depositRefundAmount,
                  input.rentRefundAmount,
                )
              : undefined;
        if (
          (!legacyReplay &&
            (!allocation ||
              !saved ||
              allocation.deposit !== saved.deposit ||
              allocation.rent !== saved.rent)) ||
          wholeVnd(existing.amount) !== wholeVnd(input.amount) ||
          existing.reference !== input.reference ||
          existing.confirmedBy !== actor.id ||
          JSON.stringify(existing.evidencePhotoIds) !== JSON.stringify(input.evidencePhotoIds)
        )
          throw new ConflictError(m.refund);
        return {
          id: existing.id,
          amount: existing.amount,
          confirmedAt: existing.confirmedAt.toISOString(),
          version: request.version,
          refundSummary: summary,
        };
      }
      this.version(request.version, input.expectedVersion);
      const payment = await this.repository.payment(tx, context.booking.id);
      if (request.status !== "COMPLETED" || !payment?.paidAt || payment.status !== "SUCCEEDED")
        throw new ConflictError(m.refund);
      await this.verifyEvidence(tx, id, input.evidencePhotoIds, "REFUND");
      const already = refunds.reduce((sum, r) => sum + wholeVnd(r.amount), 0n);
      const amount = wholeVnd(input.amount);
      if (
        !summary.allocationKnown ||
        summary.remainingDepositRefund === null ||
        summary.remainingRentRefund === null ||
        amount <= 0n ||
        amount > wholeVnd(summary.remainingRefund) ||
        already + amount > wholeVnd(payment.totalAmount)
      )
        throw new ConflictError(m.refund);
      const depositAvailable = wholeVnd(summary.remainingDepositRefund),
        rentAvailable = wholeVnd(summary.remainingRentRefund);
      const allocation = refundAllocation(
        amount,
        depositAvailable,
        rentAvailable,
        input.depositRefundAmount,
        input.rentRefundAmount,
      );
      if (!allocation || allocation.deposit > depositAvailable || allocation.rent > rentAvailable)
        throw new ConflictError(m.refund);
      const row = await this.repository.insertRefund(tx, {
        requestId: id,
        paymentId: payment.id,
        settlementId: settlement.id,
        amount: amount.toString(),
        depositRefundAmount: allocation.deposit.toString(),
        rentRefundAmount: allocation.rent.toString(),
        reference: input.reference,
        evidencePhotoIds: input.evidencePhotoIds,
        idempotencyKey: input.idempotencyKey,
        confirmedBy: actor.id,
      });
      if (!row) throw new ConflictError(m.refund);
      const updated = await this.repository.updateRequest(tx, id, {});
      await this.repository.audit(
        tx,
        actor.id,
        "MANUAL_REFUND_CONFIRMED",
        {
          refundId: row.id,
          amount: row.amount,
          depositRefundAmount: row.depositRefundAmount,
          rentRefundAmount: row.rentRefundAmount,
          reference: row.reference,
          evidencePhotoIds: row.evidencePhotoIds,
        },
        id,
        request.facilityId,
      );
      return {
        id: row.id,
        amount: row.amount,
        confirmedAt: row.confirmedAt.toISOString(),
        version: updated.version,
        refundSummary: refundSummary(settlement, settlements, [...refunds, row]),
      };
    });
  }
  async proposeTime(actor: ReturnActor, id: string, input: ProposeReturnTime) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.staff(tx, actor, request);
      const previous = (await this.repository.timeChanges(tx, id)).find(
        (c) => c.idempotencyKey === input.idempotencyKey,
      );
      if (previous) {
        if (
          previous.proposedBy !== actor.id ||
          previous.proposedAt.getTime() !== new Date(input.actualReturnAt).getTime() ||
          previous.reason !== input.reason ||
          JSON.stringify(previous.evidencePhotoIds) !== JSON.stringify(input.evidencePhotoIds)
        )
          throw new ConflictError(m.conflict);
        return { id: previous.id, status: previous.status };
      }
      this.version(request.version, input.expectedVersion);
      const at = new Date(input.actualReturnAt);
      this.validateTime(context, at);
      if (!context.rental.actualReturnAt || request.status === "CANCELLED")
        throw new ConflictError(m.conflict);
      await this.verifyEvidence(tx, id, input.evidencePhotoIds);
      const row = await this.repository.insertTimeChange(tx, {
        requestId: id,
        previousAt: context.rental.actualReturnAt,
        proposedAt: at,
        reason: input.reason,
        evidencePhotoIds: input.evidencePhotoIds,
        idempotencyKey: input.idempotencyKey,
        proposedBy: actor.id,
      });
      await this.repository.updateRequest(tx, id, {});
      await this.repository.audit(
        tx,
        actor.id,
        "RETURN_TIME_PROPOSED",
        { changeId: row.id, actualReturnAt: at.toISOString(), reason: input.reason },
        id,
        request.facilityId,
      );
      return { id: row.id, status: row.status };
    });
  }
  async decideTime(
    actor: ReturnActor,
    id: string,
    changeId: string,
    expectedVersion: number,
    approve: boolean,
    reason: string,
  ) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.manager(tx, actor, request.facilityId);
      const change = (await this.repository.timeChanges(tx, id)).find((c) => c.id === changeId);
      if (!change) throw new NotFoundError(m.notFound);
      const status = approve ? "APPROVED" : "REJECTED";
      if (change.status !== "PENDING") {
        if (change.status !== status) throw new ConflictError(m.conflict);
        return { id: change.id, status: change.status };
      }
      this.version(request.version, expectedVersion);
      if (approve && change.previousAt?.getTime() !== context.rental.actualReturnAt?.getTime())
        throw new ConflictError(m.conflict);
      await this.repository.decideTime(tx, change.id, {
        status,
        decidedBy: actor.id,
        decidedAt: new Date(),
        decisionReason: reason,
      });
      if (approve) {
        await this.repository.updateRental(tx, context.rental.id, {
          actualReturnAt: change.proposedAt,
        });
        const [settlement] = await this.repository.settlements(tx, id);
        if (settlement)
          await this.assess(
            tx,
            actor,
            {
              rental: { ...context.rental, actualReturnAt: change.proposedAt },
              booking: context.booking,
            },
            request,
            {
              damageAmount: settlement.damageAmount,
              unusedRentRefundAmount: settlement.unusedRentRefundAmount,
              reason,
              expectedVersion,
            },
            settlement,
          );
      }
      await this.repository.updateRequest(tx, id, {});
      await this.repository.audit(
        tx,
        actor.id,
        "RETURN_TIME_DECIDED",
        {
          changeId,
          status,
          reason,
          previousAt: change.previousAt?.toISOString(),
          proposedAt: change.proposedAt.toISOString(),
        },
        id,
        request.facilityId,
      );
      return { id: change.id, status };
    });
  }
  private async settlementEligibility(
    tx: ReturnTransaction,
    context: ReturnContext,
    request: ReturnRequestRow,
    input: SettleReturn,
  ) {
    const blockingReasons: ReturnSettlementPreviewDto["blockingReasons"] = [];
    const add = (
      code: ReturnSettlementPreviewDto["blockingReasons"][number]["code"],
      message: string,
    ) => blockingReasons.push({ code, message });
    const attempts = await this.repository.inspections(tx, request.id);
    if (request.status !== "INSPECTING")
      add(blockerCode.REQUEST_NOT_INSPECTING, m.requestNotInspecting);
    if (attempts[0]?.status !== "PASS")
      add(blockerCode.INSPECTION_NOT_PASSED, m.inspectionNotPassed);
    if (!context.rental.actualReturnAt)
      add(blockerCode.ACTUAL_RETURN_MISSING, m.actualReturnMissing);
    if (context.rental.status === "CLOSED") add(blockerCode.RENTAL_CLOSED, m.rentalClosed);
    for (const attempt of attempts) {
      const property = attempt.definition
        .filter((i) => i.group === "REMAINING_PROPERTY")
        .some((i) => attempt.results.find((r) => r.code === i.code)?.issue);
      if (!property) continue;
      if (
        attempt.propertyDisposition === "NONE" ||
        !attempt.propertyHandledAt ||
        !attempt.propertyEvidencePhotoIds.length ||
        (attempt.propertyDisposition === "STORED" && !attempt.propertyReceiver)
      ) {
        add(blockerCode.PROPERTY_UNRESOLVED, m.propertyUnresolved);
        continue;
      }
      try {
        await this.verifyEvidence(tx, request.id, attempt.propertyEvidencePhotoIds);
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        add(blockerCode.EVIDENCE_INVALID, m.evidence);
      }
    }
    const damageEvidence = attempts
      .filter((a) => a.status !== "DRAFT")
      .flatMap((attempt) =>
        attempt.results
          .filter(
            (result) =>
              result.issue &&
              result.note &&
              result.photoIds.length &&
              attempt.definition.some(
                (item) =>
                  item.code === result.code &&
                  ["UNIT_CONDITION", "HYGIENE_SAFETY"].includes(item.group),
              ),
          )
          .flatMap((result) => result.photoIds),
      );
    if (wholeVnd(input.damageAmount) > 0n && !damageEvidence.length)
      add(blockerCode.DAMAGE_EVIDENCE_MISSING, m.incomplete);
    return { blockingReasons, damageEvidence: [...new Set(damageEvidence)] };
  }

  async preview(
    actor: ReturnActor,
    id: string,
    input: SettleReturn,
  ): Promise<ReturnSettlementPreviewDto> {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.manager(tx, actor, request.facilityId);
      this.version(request.version, input.expectedVersion);
      if (wholeVnd(input.unusedRentRefundAmount) > 0n)
        throw new ValidationError(m.noEarlyRentRefund);
      const { blockingReasons } = await this.settlementEligibility(tx, context, request, input);
      const settlements = await this.repository.settlements(tx, id);
      const previous = settlements[0];
      const policy = previous ? { rate: previous.rateSnapshot } : await this.repository.rate(tx);
      if (!policy)
        blockingReasons.push({
          code: blockerCode.CONFIGURATION_MISSING,
          message: m.configurationMissing,
        });
      let calculation: ReturnSettlementPreviewDto["calculation"] = null;
      if (context.rental.actualReturnAt && policy) {
        const refunds = await this.repository.refunds(tx, id);
        const result = calculateSettlement({
          depositSnapshot: previous?.depositSnapshot ?? context.rental.depositAmount,
          rateSnapshot: policy.rate,
          expectedEndAt: context.rental.expectedEndAt,
          actualReturnAt: context.rental.actualReturnAt,
          timezone: request.timezone,
          damageAmount: input.damageAmount,
          unusedRentRefundAmount: input.unusedRentRefundAmount,
          paid: refunds.reduce((sum, row) => sum + wholeVnd(row.amount), 0n),
        });
        calculation = { ...result, ...refundSummary(result, settlements, refunds) };
      }
      return {
        requestId: id,
        version: request.version,
        canClose: blockingReasons.length === 0,
        blockingReasons,
        calculation,
      };
    });
  }

  private async assess(
    tx: ReturnTransaction,
    actor: ReturnActor,
    context: ReturnContext,
    request: ReturnRequestRow,
    input: SettleReturn,
    previous?: typeof returnSettlements.$inferSelect,
  ) {
    const at = context.rental.actualReturnAt;
    if (!at) throw new ConflictError(m.settlement);
    const policy = previous ? { rate: previous.rateSnapshot } : await this.repository.lockRate(tx);
    if (!policy) throw new ConflictError(m.configurationMissing);
    if (
      wholeVnd(input.unusedRentRefundAmount) > 0n &&
      (!previous ||
        wholeVnd(input.unusedRentRefundAmount) > wholeVnd(previous.unusedRentRefundAmount))
    )
      throw new ValidationError(m.noEarlyRentRefund);
    const paid = (await this.repository.refunds(tx, request.id)).reduce(
      (sum, r) => sum + wholeVnd(r.amount),
      0n,
    );
    const calculation = calculateSettlement({
      depositSnapshot: previous?.depositSnapshot ?? context.rental.depositAmount,
      rateSnapshot: policy.rate,
      expectedEndAt: context.rental.expectedEndAt,
      actualReturnAt: at,
      timezone: request.timezone,
      damageAmount: input.damageAmount,
      unusedRentRefundAmount: input.unusedRentRefundAmount,
      paid,
    });
    const now = new Date();
    const row = await this.repository.insertSettlement(tx, {
      requestId: request.id,
      revision: (previous?.revision ?? 0) + 1,
      ...calculation,
      actualReturnAt: at,
      refundDueDate:
        previous && wholeVnd(calculation.refundEntitlement) <= wholeVnd(previous.refundEntitlement)
          ? previous.refundDueDate
          : refundDueDate(now, request.timezone),
      calendarSnapshot: { timezone: request.timezone },
      approvedBy: actor.id,
      approvedAt: now,
      reason: input.reason,
    });
    await this.repository.syncReturnDebtCharge(tx, row, previous, context.rental.id, actor.id);
    await this.repository.audit(
      tx,
      actor.id,
      previous ? "SETTLEMENT_ADJUSTED" : "SETTLEMENT_APPROVED",
      {
        settlementId: row.id,
        previousSettlementId: previous?.id ?? null,
        revision: row.revision,
        overdueFeeAmount: row.overdueFeeAmount,
        refundEntitlement: row.refundEntitlement,
        debtAmount: row.debtAmount,
        reason: input.reason,
      },
      request.id,
      request.facilityId,
    );
    return settlementDto(row, paid);
  }
  async settle(actor: ReturnActor, id: string, input: SettleReturn) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      await this.manager(tx, actor, request.facilityId);
      const [existing] = await this.repository.settlements(tx, id);
      if (existing && request.status === "COMPLETED") {
        if (
          wholeVnd(existing.damageAmount) !== wholeVnd(input.damageAmount) ||
          wholeVnd(existing.unusedRentRefundAmount) !== wholeVnd(input.unusedRentRefundAmount)
        )
          throw new ConflictError(m.conflict);
        return settlementDto(
          existing,
          (await this.repository.refunds(tx, id)).reduce((sum, r) => sum + wholeVnd(r.amount), 0n),
        );
      }
      this.version(request.version, input.expectedVersion);
      const eligibility = await this.settlementEligibility(tx, context, request, input);
      const first = eligibility.blockingReasons[0];
      if (first) {
        if (
          first.code === blockerCode.EVIDENCE_INVALID ||
          first.code === blockerCode.DAMAGE_EVIDENCE_MISSING
        )
          throw new ValidationError(first.message);
        throw new ConflictError(first.message);
      }
      if (wholeVnd(input.damageAmount) > 0n) {
        await this.repository.audit(
          tx,
          actor.id,
          "DAMAGE_FEES_APPROVED",
          {
            amount: input.damageAmount,
            reason: input.reason,
            evidencePhotoIds: eligibility.damageEvidence,
          },
          id,
          request.facilityId,
        );
      }
      const result = await this.assess(tx, actor, context, request, input);
      await this.repository.updateRequest(tx, id, { status: "COMPLETED" });
      await this.repository.updateRental(tx, context.rental.id, {
        status: "CLOSED",
        closedAt: new Date(),
      });
      await this.repository.releaseOccupancy(
        tx,
        context.booking.id,
        context.rental.physicalUnitId,
        new Date(),
      );
      await this.repository.updateUnit(tx, context.rental.physicalUnitId, "AVAILABLE");
      return result;
    });
  }

  async finalize(actor: ReturnActor, id: string, expectedVersion: number) {
    return this.repository.lockedRequest(id, async (tx, context, request) => {
      if (actor.role === "FACILITY_MANAGER") await this.manager(tx, actor, request.facilityId);
      else await this.staff(tx, actor, request);
      if (request.status === "COMPLETED") return requestDto(request);
      this.version(request.version, expectedVersion);
      if (request.status === "CANCELLED") throw new ConflictError(m.conflict);

      const attempts = await this.repository.inspections(tx, id);
      const latest = attempts[0];
      if (!latest) throw new ConflictError(m.inspectionNotPassed);

      if (latest.status === "DRAFT") {
        const photos = await this.repository.photos(tx, latest.id);
        const status = reviewInspection(
          latest.definition,
          latest.results,
          photos.map((p) => p.id),
        );
        await this.repository.updateInspection(tx, latest.id, {
          status,
          completedBy: actor.id,
          completedAt: new Date(),
        });
        await this.repository.audit(
          tx,
          actor.id,
          "INSPECTION_COMPLETED",
          { inspectionId: latest.id, status },
          id,
          request.facilityId,
        );
        if (status === "FAIL") {
          await this.repository.updateRequest(tx, id, { status: "FAILED" });
          await this.repository.updateUnit(tx, context.rental.physicalUnitId, "MAINTENANCE");
          throw new ConflictError(m.inspectionNotPassed);
        }
      } else if (latest.status !== "PASS") {
        throw new ConflictError(m.inspectionNotPassed);
      }

      if (!context.rental.actualReturnAt) {
        const now = new Date();
        const at = now < context.rental.startAt ? context.rental.startAt : now;
        await this.repository.updateRental(tx, context.rental.id, { actualReturnAt: at });
        context.rental.actualReturnAt = at;
        await this.repository.audit(
          tx,
          actor.id,
          "PHYSICAL_RETURN_CONFIRMED",
          {
            actualReturnAt: at.toISOString(),
            recordedAt: now.toISOString(),
            reason: "Xác nhận khách hàng đã bàn giao trả kho thực tế",
          },
          id,
          request.facilityId,
        );
      }

      const settleInput: SettleReturn = {
        expectedVersion: request.version,
        damageAmount: "0",
        unusedRentRefundAmount: "0",
        reason: "Hoàn tất kiểm tra, xác nhận trả kho thành công và kết thúc hợp đồng thuê",
      };
      const eligibility = await this.settlementEligibility(tx, context, request, settleInput);
      const first = eligibility.blockingReasons[0];
      if (first) {
        if (
          first.code === blockerCode.EVIDENCE_INVALID ||
          first.code === blockerCode.DAMAGE_EVIDENCE_MISSING
        )
          throw new ValidationError(first.message);
        throw new ConflictError(first.message);
      }

      await this.assess(tx, actor, context, request, settleInput);

      const settlements = await this.repository.settlements(tx, id);
      const refunds = await this.repository.refunds(tx, id);
      const [latestSettlement] = settlements;
      if (latestSettlement) {
        const summary = refundSummary(latestSettlement, settlements, refunds);
        const remaining = wholeVnd(summary.remainingRefund);
        const payment = await this.repository.payment(tx, context.booking.id);
        if (remaining > 0n && payment) {
          const depositAvailable = wholeVnd(summary.remainingDepositRefund ?? "0");
          const rentAvailable = wholeVnd(summary.remainingRentRefund ?? "0");
          const refundRow = await this.repository.insertRefund(tx, {
            requestId: id,
            paymentId: payment.id,
            settlementId: latestSettlement.id,
            amount: remaining.toString(),
            depositRefundAmount: depositAvailable.toString(),
            rentRefundAmount: rentAvailable.toString(),
            reference: `REFUND-${id.slice(0, 8).toUpperCase()}`,
            evidencePhotoIds: [],
            idempotencyKey: latestSettlement.id,
            confirmedBy: actor.id,
          });
          if (refundRow) {
            await this.repository.audit(
              tx,
              actor.id,
              "MANUAL_REFUND_CONFIRMED",
              {
                refundId: refundRow.id,
                amount: refundRow.amount,
                depositRefundAmount: refundRow.depositRefundAmount,
                rentRefundAmount: refundRow.rentRefundAmount,
                reference: refundRow.reference,
                evidencePhotoIds: [],
              },
              id,
              request.facilityId,
            );
          }
        }
      }

      const now = new Date();
      const updated = await this.repository.updateRequest(tx, id, { status: "COMPLETED" });
      await this.repository.updateRental(tx, context.rental.id, {
        status: "CLOSED",
        closedAt: now,
      });
      await this.repository.releaseOccupancy(
        tx,
        context.booking.id,
        context.rental.physicalUnitId,
        now,
      );
      await this.repository.updateUnit(tx, context.rental.physicalUnitId, "AVAILABLE");
      return requestDto(updated);
    });
  }
}
