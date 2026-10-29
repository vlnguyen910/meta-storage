import {
  type CreateInspectionInput,
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
  HandoverChecklistCompletionSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionListQuery,
  type InspectionRecord,
  ReturnChecklistCompletionSchema,
  type UpdateInspectionInput,
  type UpdatePolicyViolationFeeCatalog,
} from "@metastorage/contracts";
import {
  InspectionCondition,
  InspectionStatus,
  InspectionType,
  ReservationStatus,
} from "@metastorage/database";
import {
  APPOINTMENT_STATUSES as AppointmentStatus,
  APPOINTMENT_TYPES as AppointmentType,
} from "@metastorage/database/schema/appointments";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { mapPageDto } from "../../common/types/page.dto";
import type { AppointmentsService } from "../appointments/appointments.service";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import type { FacilityTasksRepository } from "../facility-tasks/facility-tasks.repository";
import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";
import type { MediaAssetsService } from "../media-assets/media-assets.service";
import type { RentalsService } from "../rentals/rentals.service";
import type { ReservationsService } from "../reservations/reservations.service";
import type { StorageUnitsService } from "../storage-units/storage-units.service";
import { INSPECTIONS_API_MESSAGES as m } from "./inspections.messages";
import type { InspectionRow, InspectionsRepository } from "./inspections.repository";

type InspectionActor = { id: string; role: UserRole };

export class InspectionsService {
  constructor(
    private readonly repository: InspectionsRepository,
    private readonly tasks: FacilityTasksRepository,
    private readonly rentals: RentalsService,
    private readonly storageUnits: StorageUnitsService,
    private readonly assignments: FacilityAssignmentsService,
    private readonly media: MediaAssetsService,
    private readonly appointments?: AppointmentsService,
    private readonly reservations?: ReservationsService,
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

  async historyForAppointment(
    appointmentId: string,
    actor: InspectionActor,
  ): Promise<InspectionRecord[]> {
    if (!this.appointments) throw new ConflictError(m.taskNotAvailable);
    await this.appointments.getAppointment(appointmentId, actor);
    const rows = await this.repository.listForAppointment(appointmentId);
    return Promise.all(rows.map((row) => this.get(row.id, actor)));
  }

  async create(input: CreateInspectionInput, actor: InspectionActor): Promise<InspectionRecord> {
    const context = await this.repository.findTaskContext(input.taskId);
    if (context?.referenceType === FacilityTaskReferenceType.APPOINTMENT)
      return this.startForAppointment(input, context.referenceId, actor);
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

  private async startForAppointment(
    input: CreateInspectionInput,
    appointmentId: string,
    actor: InspectionActor,
  ) {
    const appointments = this.appointments;
    if (!appointments) throw new ConflictError(m.taskNotAvailable);
    const existing = await this.repository.findExistingByTask(input.taskId);
    if (existing) return this.get(existing.id, actor);
    const record = await this.repository.transaction(async (tx) => {
      const { appointment, reservation, rental } = await appointments.requireInspectionContext(
        tx,
        appointmentId,
        actor,
      );
      const [task] = await this.tasks.findForUpdate(tx, input.taskId);
      if (
        !task ||
        task.referenceId !== appointment.id ||
        task.assignedStaffId !== actor.id ||
        task.status !== FacilityTaskStatus.IN_PROGRESS ||
        appointment.status !== AppointmentStatus.CONFIRMED
      )
        throw new ConflictError(m.taskNotAvailable);
      const [existing] = await this.repository.findByTask(tx, task.id);
      if (existing) return existing;
      if (
        appointment.appointmentType === AppointmentType.CHECK_OUT &&
        rental?.rental.status === "ACTIVE"
      ) {
        const [created] = await this.repository.create(tx, {
          storageUnitId: rental.rental.storageUnitId,
          rentalId: rental.rental.id,
          inspectedBy: actor.id,
          taskId: task.id,
          inspectionType: InspectionType.CHECK_OUT,
        });
        if (!created) throw new Error("Return inspection insert returned no row");
        return created;
      }
      if (
        appointment.appointmentType !== AppointmentType.CHECK_IN ||
        !reservation ||
        reservation.status !== ReservationStatus.CONFIRMED ||
        !input.storageUnitId
      )
        throw new ConflictError(m.handoverNotReady);
      const assignment = await this.storageUnits.findReservationAssignment(tx, reservation.id);
      if (!assignment || assignment.physicalUnitId !== input.storageUnitId)
        throw new ConflictError(m.handoverNotReady);
      await this.storageUnits.requireHandoverUnit(tx, {
        unitId: input.storageUnitId,
        taskId: task.id,
        facilityId: reservation.facilityId,
        unitTypeId: reservation.unitTypeId,
        reservationId: reservation.id,
        startsAt: reservation.rentalStartAt,
        endsAt: reservation.rentalEndAt,
      });
      const [created] = await this.repository.create(tx, {
        storageUnitId: input.storageUnitId,
        reservationId: reservation.id,
        inspectedBy: actor.id,
        taskId: task.id,
        inspectionType: InspectionType.CHECK_IN,
      });
      if (!created) throw new Error("Check-in inspection insert returned no row");
      return created;
    });
    return this.get(record.id, actor);
  }

  private async handoverReservation(current: InspectionRow, actor: InspectionActor) {
    const task = await this.repository.findTaskContext(current.taskId);
    const appointments = this.appointments;
    const reservations = this.reservations;
    if (
      !appointments ||
      !reservations ||
      task?.referenceType !== FacilityTaskReferenceType.APPOINTMENT
    )
      throw new ConflictError(m.handoverNotReady);
    await this.repository.transaction(async (tx) => {
      const { appointment, reservation } = await appointments.requireInspectionContext(
        tx,
        task.referenceId,
        actor,
      );
      const [inspection] = await this.repository.findForUpdate(tx, current.id);
      if (
        !reservation ||
        !inspection ||
        inspection.reservationId !== reservation.id ||
        inspection.inspectionType !== InspectionType.CHECK_IN ||
        inspection.status !== InspectionStatus.PASSED
      )
        throw new ConflictError(m.handoverNotReady);
      if (reservation.status === ReservationStatus.CHECKED_IN) {
        if (
          !(await this.rentals.findReservationRental(tx, reservation.id)) ||
          appointment.status !== AppointmentStatus.COMPLETED
        )
          throw new ConflictError(m.handoverNotReady);
        return;
      }
      if (
        reservation.status !== ReservationStatus.CONFIRMED ||
        appointment.status !== AppointmentStatus.CONFIRMED
      )
        throw new ConflictError(m.handoverNotReady);
      const [activeTask] = await this.tasks.findForUpdate(tx, task.id);
      if (
        !activeTask ||
        activeTask.assignedStaffId !== actor.id ||
        activeTask.status !== FacilityTaskStatus.IN_PROGRESS
      )
        throw new ConflictError(m.taskNotAvailable);
      const now = new Date();
      if (now >= reservation.rentalEndAt) throw new ConflictError(m.handoverNotReady);
      await this.storageUnits.requireHandoverUnit(tx, {
        unitId: inspection.storageUnitId,
        taskId: task.id,
        facilityId: reservation.facilityId,
        unitTypeId: reservation.unitTypeId,
        reservationId: reservation.id,
        startsAt: now,
        endsAt: reservation.rentalEndAt,
      });
      await this.rentals.createForHandover(tx, {
        reservationId: reservation.id,
        userId: reservation.customerId,
        storageUnitId: inspection.storageUnitId,
        startAt: now,
        endAt: reservation.rentalEndAt,
      });
      await this.storageUnits.markOccupied(tx, inspection.storageUnitId, now);
      await reservations.markCheckedIn(tx, reservation.id);
      await appointments.completeHandover(tx, appointment.id, actor);
    });
    return this.get(current.id, actor);
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
    if (
      current.inspectionType === InspectionType.CHECK_OUT &&
      current.status === InspectionStatus.PASSED &&
      input.status === InspectionStatus.PASSED
    )
      return this.get(id, actor);
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

    let alreadyCompleted = false;
    const updated = await this.repository.transaction(async (tx) => {
      if (current.inspectionType === InspectionType.CHECK_OUT) {
        const taskContext = await this.repository.findTaskContext(current.taskId, tx);
        if (
          !this.appointments ||
          taskContext?.referenceType !== FacilityTaskReferenceType.APPOINTMENT
        )
          throw new ConflictError(m.handoverNotReady);
        try {
          await this.appointments.requireInspectionContext(tx, taskContext.referenceId, actor);
        } catch (error) {
          if (input.status === InspectionStatus.PASSED) {
            const [completed] = await this.repository.findForUpdate(tx, id);
            if (completed?.status === InspectionStatus.PASSED) {
              alreadyCompleted = true;
              return completed;
            }
          }
          throw error;
        }
      }
      const [locked] = await this.repository.findForUpdate(tx, id);
      if (!locked) return undefined;
      if (
        locked.inspectionType === InspectionType.CHECK_OUT &&
        locked.status === InspectionStatus.PASSED &&
        input.status === InspectionStatus.PASSED
      ) {
        alreadyCompleted = true;
        return locked;
      }
      if (locked.status === InspectionStatus.PASSED || locked.status === InspectionStatus.FAILED)
        throw new ConflictError(m.alreadyCompleted);
      const [task] = await this.tasks.findForUpdate(tx, locked.taskId);
      if (
        !task ||
        task.assignedStaffId !== actor.id ||
        ![FacilityTaskStatus.ASSIGNED, FacilityTaskStatus.IN_PROGRESS].includes(task.status)
      )
        throw new ConflictError(m.taskNotAvailable);

      const nextStatus = input.status ?? InspectionStatus.IN_PROGRESS;
      if (
        locked.inspectionType === InspectionType.CHECK_OUT &&
        nextStatus === InspectionStatus.FAILED
      )
        throw new ConflictError(m.returnInspectionCannotFail);
      if (
        (nextStatus === InspectionStatus.PASSED || nextStatus === InspectionStatus.FAILED) &&
        !(input.condition ?? locked.condition)
      )
        throw new ConflictError(m.conditionRequired);
      if (nextStatus === InspectionStatus.PASSED) {
        const checklist = input.checklist ?? locked.checklist;
        const results = Array.isArray(checklist.results) ? checklist.results : [];
        const completionSchema =
          locked.inspectionType === InspectionType.CHECK_OUT
            ? ReturnChecklistCompletionSchema
            : HandoverChecklistCompletionSchema;
        if (!completionSchema.safeParse(results).success)
          throw new ConflictError(m.checklistRequired);
      }

      if (locked.inspectionType === InspectionType.CHECK_OUT && input.violations !== undefined) {
        if (input.policyVersion === undefined) throw new ConflictError(m.returnPolicyStale);
        const fees = await this.repository.replaceInspectionFees(
          tx,
          locked.id,
          input.policyVersion,
          input.violations,
        );
        if (!fees) throw new ConflictError(m.returnPolicyStale);
      } else if (input.violations !== undefined) {
        throw new ConflictError(m.returnPolicyStale);
      }

      if (
        locked.inspectionType === InspectionType.CHECK_OUT &&
        nextStatus === InspectionStatus.PASSED
      ) {
        await this.completeReturn(tx, locked, task, actor, input);
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

    if (!alreadyCompleted) {
      for (const assetId of removed) await this.media.removeImage("INSPECTION", id, assetId);
      for (const evidence of input.addEvidence ?? [])
        await this.media.uploadImage("INSPECTION", id, "EVIDENCE_PHOTO", actor.id, evidence);
    }
    return this.get(id, actor);
  }

  async handover(id: string, actor: InspectionActor): Promise<InspectionRecord> {
    const current = await this.getAccessibleRow(id, actor);
    if (!current.reservationId) throw new ConflictError(m.handoverNotReady);
    return this.handoverReservation(current, actor);
  }

  async getPolicyCatalog(actor: InspectionActor) {
    if (actor.role !== UserRole.BUSINESS_OPERATIONS_MANAGER)
      throw new ForbiddenError(m.policyCatalogForbidden);
    return this.repository.policyCatalog();
  }

  async updatePolicyCatalog(actor: InspectionActor, input: UpdatePolicyViolationFeeCatalog) {
    if (actor.role !== UserRole.BUSINESS_OPERATIONS_MANAGER)
      throw new ForbiddenError(m.policyCatalogForbidden);
    const result = await this.repository.updatePolicyCatalog(input);
    if (!result) throw new ConflictError(m.policyCatalogStale);
    return result;
  }

  private async completeReturn(
    tx: TaskTransaction,
    inspection: Awaited<ReturnType<InspectionsRepository["findForUpdate"]>>[number],
    task: Awaited<ReturnType<FacilityTasksRepository["findForUpdate"]>>[number],
    actor: InspectionActor,
    input: UpdateInspectionInput,
  ) {
    if (
      !this.appointments ||
      !task ||
      task.status !== FacilityTaskStatus.IN_PROGRESS ||
      task.referenceType !== FacilityTaskReferenceType.APPOINTMENT
    )
      throw new ConflictError(m.handoverNotReady);
    const { appointment, rental } = await this.appointments.requireInspectionContext(
      tx,
      task.referenceId,
      actor,
    );
    if (
      appointment.appointmentType !== AppointmentType.CHECK_OUT ||
      appointment.status !== AppointmentStatus.CONFIRMED ||
      !rental ||
      rental.rental.status !== "ACTIVE" ||
      rental.rental.id !== inspection.rentalId ||
      rental.rental.storageUnitId !== inspection.storageUnitId
    )
      throw new ConflictError(m.handoverNotReady);
    if ((input.condition ?? inspection.condition) !== InspectionCondition.GOOD)
      throw new ConflictError(m.returnUnitUnavailable);

    const fees = await this.repository.listInspectionFees(inspection.id, tx);
    const totalFees = fees.reduce((total, fee) => total + fee.amount, 0);
    const source = await this.repository.lockSourcePayment(tx, rental.rental.id);
    if (
      !source ||
      Number(source.payment.totalAmount) <= 0 ||
      Number(source.payment.totalAmount) !== source.quoteTotal
    )
      throw new ConflictError(m.returnPaymentMissing);
    if (totalFees > source.depositAmount) throw new ConflictError(m.returnPenaltyExceedsDeposit);

    const now = new Date();
    const closed = await this.repository.closeRental(tx, rental.rental.id, now);
    if (!closed.length) throw new ConflictError(m.handoverNotReady);
    if (
      !(await this.storageUnits.makeAvailableAfterReturn(
        tx,
        rental.rental.storageUnitId,
        rental.rental.id,
        rental.rental.reservationId,
        now,
      ))
    )
      throw new ConflictError(m.returnUnitUnavailable);
    const refundAmount = source.depositAmount - totalFees;
    if (refundAmount > 0)
      await this.repository.createDepositRefund(tx, {
        rentalId: rental.rental.id,
        sourcePaymentId: source.payment.id,
        bookingId: source.bookingId,
        reservationId: source.reservationId,
        amount: refundAmount,
        currency: source.payment.currency,
      });
    await this.appointments.completeHandover(tx, appointment.id, actor);
  }

  private async getAccessibleRow(id: string, actor: InspectionActor): Promise<InspectionRow> {
    const row = await this.repository.find(id);
    if (!row) throw new NotFoundError(m.notFound);
    if (actor.role === UserRole.FACILITY_STAFF) {
      if (row.assignedStaffId !== actor.id) throw new ForbiddenError(m.notAssigned);
      await this.assignments.requireFacilityAccess(
        row.facilityId,
        { kind: "assigned", userId: actor.id, role: actor.role },
        [UserRole.FACILITY_STAFF],
      );
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
      reservationId: fields.reservationId ?? bookingId,
      inspectedAt: fields.inspectedAt?.toISOString() ?? null,
      inspectDoneAt: fields.inspectDoneAt?.toISOString() ?? null,
    };
  }

  private async toRecord(
    row: InspectionRow,
    evidence: Awaited<ReturnType<MediaAssetsService["listImages"]>>,
  ): Promise<InspectionRecord> {
    const { assignedStaffId: _assignedStaffId, bookingId, ...fields } = row;
    const returnContext =
      fields.inspectionType === InspectionType.CHECK_OUT
        ? await this.returnContext(fields.id)
        : undefined;
    return {
      ...fields,
      reservationId: fields.reservationId ?? bookingId,
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
      ...(returnContext ? { returnContext } : {}),
    };
  }

  private async returnContext(inspectionId: string) {
    const [context, catalog, fees] = await Promise.all([
      this.repository.findReturnContext(inspectionId),
      this.repository.policyCatalog(),
      this.repository.listInspectionFees(inspectionId),
    ]);
    if (!context || context.depositAmount === null) return undefined;
    return {
      depositAmount: context.depositAmount,
      policyVersion: catalog.version,
      penalties: catalog.items
        .filter((item) => item.isActive)
        .map(({ code, name, amount }) => ({ code, name, amount })),
      fees: fees.map((fee) => ({
        code: fee.violationCode,
        name: fee.violationName,
        amount: fee.amount,
        note: fee.note,
      })),
      checkIn: context.checkIn
        ? {
            condition: context.checkIn.condition,
            checklist: context.checkIn.checklist,
            notes: context.checkIn.notes,
            inspectedAt: context.checkIn.inspectedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
