import {
  type CreateInspectionInput,
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
  HandoverChecklistCompletionSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionListQuery,
  type InspectionRecord,
  type UpdateInspectionInput,
  UserRole,
} from "@metastorage/contracts";
import { InspectionCondition, InspectionStatus, InspectionType } from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { mapPageDto } from "../../common/types/page.dto";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import type { FacilityTasksRepository } from "../facility-tasks/facility-tasks.repository";
import type { MediaAssetsService } from "../media-assets/media-assets.service";
import { INSPECTIONS_API_MESSAGES as m } from "./inspections.messages";
import type { InspectionRow, InspectionsRepository } from "./inspections.repository";

type InspectionActor = { id: string; role: UserRole };

export class InspectionsService {
  constructor(
    private readonly repository: InspectionsRepository,
    private readonly tasks: FacilityTasksRepository,
    private readonly assignments: FacilityAssignmentsService,
    private readonly media: MediaAssetsService,
  ) {}

  async listForStaff(query: InspectionListQuery, actor: InspectionActor) {
    const facilities = await this.assignments.listUserAssignments(actor.id, actor.role);
    const facilityIds = facilities.map(({ facilityId }) => facilityId);
    if (!facilityIds.length) return mapPageDto({ items: [], total: 0 }, query, (row) => row);
    const result = await this.repository.list(query, {
      staffId: actor.id,
      facilityIds,
    });
    return mapPageDto(result, query, (row) => this.toListItem(row));
  }

  async listForFacility(query: InspectionListQuery, actor: InspectionActor) {
    const facilityId = await this.assignments.getActiveFacilityId(
      actor.id,
      UserRole.FACILITY_MANAGER,
    );
    const result = await this.repository.list(query, { facilityId });
    return mapPageDto(result, query, (row) => this.toListItem(row));
  }

  async historyForBooking(bookingId: string, actor: InspectionActor): Promise<InspectionRecord[]> {
    await this.assertBookingAccess(bookingId, actor);
    const rows = await this.repository.listForBooking(bookingId, actor.id);
    return Promise.all(rows.map((row) => this.get(row.id, actor)));
  }

  async startForBooking(bookingId: string, actor: InspectionActor): Promise<InspectionRecord> {
    await this.assertBookingAccess(bookingId, actor);
    const result = await this.repository.startCheckIn(bookingId, actor.id);
    if ("error" in result) {
      if (result.error === "BOOKING_NOT_FOUND") throw new NotFoundError(m.bookingNotFound);
      if (result.error === "NOT_ASSIGNED") throw new ForbiddenError(m.notAssigned);
      if (result.error === "TASK_NOT_AVAILABLE") throw new ConflictError(m.taskNotAvailable);
      throw new ConflictError(m.checkInNotReady);
    }
    return this.get(result.inspection.id, actor);
  }

  private async assertBookingAccess(bookingId: string, actor: InspectionActor) {
    const booking = await this.repository.findAssignedBooking(bookingId);
    if (!booking) throw new NotFoundError(m.bookingNotFound);
    if (booking.assignedStaffId !== actor.id) throw new ForbiddenError(m.notAssigned);
    const assignments = await this.assignments.listUserAssignments(actor.id, actor.role);
    if (!assignments.some((assignment) => assignment.facilityId === booking.facilityId))
      throw new ForbiddenError(m.notAssigned);
  }

  async create(input: CreateInspectionInput, actor: InspectionActor): Promise<InspectionRecord> {
    const record = await this.repository.transaction(async (tx) => {
      const [task] = await this.tasks.findForUpdate(tx, input.taskId);
      if (
        !task ||
        task.assignedStaffId !== actor.id ||
        ![FacilityTaskStatus.ASSIGNED, FacilityTaskStatus.IN_PROGRESS].includes(task.status)
      )
        return undefined;

      const [existing] = await this.repository.findByTask(tx, task.id);
      if (existing) return existing;

      let storageUnitId: string | undefined;
      let inspectionType: InspectionType;
      if (
        task.type === FacilityTaskType.UNIT_INSPECTION &&
        task.referenceType === FacilityTaskReferenceType.STORAGE_UNIT
      ) {
        storageUnitId = task.referenceId;
        inspectionType = InspectionType.MAINTENANCE;
      } else {
        return undefined;
      }
      if (!storageUnitId) return undefined;

      const [created] = await this.repository.create(tx, {
        storageUnitId,
        inspectedBy: actor.id,
        taskId: task.id,
        inspectionType,
        status: InspectionStatus.PENDING,
      });
      return created;
    });
    if (!record) throw new ConflictError(m.taskNotAvailable);
    return this.get(record.id, actor);
  }

  async get(id: string, actor: InspectionActor): Promise<InspectionRecord> {
    const row = await this.getAccessibleRow(id, actor);
    return this.toRecord(row, await this.media.listImages("INSPECTION", id, "EVIDENCE_PHOTO"));
  }

  async update(
    id: string,
    input: UpdateInspectionInput,
    actor: InspectionActor,
  ): Promise<InspectionRecord> {
    const current = await this.getAccessibleRow(id, actor);
    if (actor.role !== UserRole.FACILITY_STAFF || current.assignedStaffId !== actor.id)
      throw new ForbiddenError(m.notAssigned);
    const existingEvidence = await this.media.listImages("INSPECTION", id, "EVIDENCE_PHOTO");
    const removed = new Set(input.removeEvidenceIds ?? []);
    if (removed.size !== (input.removeEvidenceIds ?? []).length)
      throw new ConflictError(m.evidenceNotFound);
    if ([...removed].some((assetId) => !existingEvidence.some((asset) => asset.id === assetId)))
      throw new NotFoundError(m.evidenceNotFound);
    if (
      existingEvidence.length - removed.size + (input.addEvidence?.length ?? 0) >
      INSPECTION_PHOTO_MAX_COUNT
    )
      throw new ConflictError(m.evidenceLimit);

    const updated = await this.repository.transaction(async (tx) => {
      const [locked] = await this.repository.findForUpdate(tx, id);
      if (!locked) return undefined;
      if (locked.status === InspectionStatus.PASSED || locked.status === InspectionStatus.FAILED)
        throw new ConflictError(m.alreadyCompleted);
      const [task] = await this.tasks.find(tx, locked.taskId);
      if (!task || task.assignedStaffId !== actor.id) return undefined;

      const nextStatus = input.status ?? InspectionStatus.IN_PROGRESS;
      if (
        (nextStatus === InspectionStatus.PASSED || nextStatus === InspectionStatus.FAILED) &&
        !(input.condition ?? locked.condition)
      )
        throw new ConflictError(m.conditionRequired);
      if (nextStatus === InspectionStatus.PASSED) {
        const checklist = input.checklist ?? locked.checklist;
        const results = Array.isArray(checklist.results) ? checklist.results : [];
        if (!HandoverChecklistCompletionSchema.safeParse(results).success)
          throw new ConflictError(m.checklistRequired);
      }

      const condition =
        input.condition === undefined
          ? undefined
          : input.condition === null
            ? null
            : InspectionCondition[input.condition];
      const now = new Date();
      const terminal =
        nextStatus === InspectionStatus.PASSED || nextStatus === InspectionStatus.FAILED;
      const [updatedRecord] = await this.repository.update(tx, id, {
        status: nextStatus as InspectionStatus,
        ...(condition === undefined ? {} : { condition }),
        ...(input.checklist === undefined ? {} : { checklist: input.checklist }),
        ...(input.notes === undefined ? {} : { notes: input.notes?.trim() || null }),
        inspectedAt: locked.inspectedAt ?? now,
        inspectDoneAt: terminal ? (locked.inspectDoneAt ?? now) : null,
      });
      return updatedRecord;
    });
    if (!updated) throw new NotFoundError(m.notFound);

    for (const assetId of removed) await this.media.removeImage("INSPECTION", id, assetId);
    for (const evidence of input.addEvidence ?? [])
      await this.media.uploadImage("INSPECTION", id, "EVIDENCE_PHOTO", actor.id, evidence);
    return this.get(id, actor);
  }

  async handover(id: string, actor: InspectionActor): Promise<InspectionRecord> {
    const current = await this.getAccessibleRow(id, actor);
    if (actor.role !== UserRole.FACILITY_STAFF || !current.bookingId)
      throw new ForbiddenError(m.notAssigned);
    await this.assertBookingAccess(current.bookingId, actor);
    const result = await this.repository.handover(id, actor.id);
    if ("error" in result) {
      if (result.error === "NOT_FOUND") throw new NotFoundError(m.notFound);
      if (result.error === "NOT_ASSIGNED") throw new ForbiddenError(m.notAssigned);
      throw new ConflictError(m.handoverNotReady);
    }
    return this.get(id, actor);
  }

  private async getAccessibleRow(id: string, actor: InspectionActor): Promise<InspectionRow> {
    const row = await this.repository.find(id);
    if (!row) throw new NotFoundError(m.notFound);
    if (actor.role === UserRole.FACILITY_STAFF) {
      if (row.assignedStaffId !== actor.id) throw new ForbiddenError(m.notAssigned);
      return row;
    }
    if (actor.role === UserRole.FACILITY_MANAGER) {
      const facilityId = await this.assignments.getActiveFacilityId(
        actor.id,
        UserRole.FACILITY_MANAGER,
      );
      if (row.facilityId !== facilityId) throw new ForbiddenError(m.notAssigned);
      return row;
    }
    throw new ForbiddenError(m.notAssigned);
  }

  private toListItem(row: InspectionRow) {
    const { assignedStaffId: _assignedStaffId, bookingId, ...fields } = row;
    return {
      ...fields,
      reservationId: bookingId,
      inspectedAt: fields.inspectedAt?.toISOString() ?? null,
      inspectDoneAt: fields.inspectDoneAt?.toISOString() ?? null,
    };
  }

  private toRecord(
    row: InspectionRow,
    evidence: Awaited<ReturnType<MediaAssetsService["listImages"]>>,
  ): InspectionRecord {
    const { assignedStaffId: _assignedStaffId, bookingId, ...fields } = row;
    return {
      ...fields,
      reservationId: bookingId,
      inspectedAt: fields.inspectedAt?.toISOString() ?? null,
      inspectDoneAt: fields.inspectDoneAt?.toISOString() ?? null,
      evidence: evidence.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        createdAt: asset.createdAt.toISOString(),
        url: asset.url,
      })),
    };
  }
}
