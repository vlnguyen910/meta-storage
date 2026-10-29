import { describe, expect, test } from "bun:test";
import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import type { BookingCheckInService } from "../../../src/modules/bookings/booking-check-in.service";
import type { FacilityAssignmentsService } from "../../../src/modules/facilities/facility-assignments.service";
import type { FacilityTasksRepository } from "../../../src/modules/facility-tasks/facility-tasks.repository";
import { FacilityTasksService } from "../../../src/modules/facility-tasks/facility-tasks.service";

describe("starting a booking handover task", () => {
  test("checks booking readiness through Bookings before persisting IN_PROGRESS", async () => {
    const order: string[] = [];
    const now = new Date();
    const task = {
      id: "a0000000-0000-4000-8000-000000000001",
      facilityId: "b0000000-0000-4000-8000-000000000001",
      referenceId: "c0000000-0000-4000-8000-000000000001",
      referenceType: FacilityTaskReferenceType.BOOKING,
      type: FacilityTaskType.CHECK_IN_HANDOVER,
      assignedStaffId: "d0000000-0000-4000-8000-000000000001",
      status: FacilityTaskStatus.ASSIGNED,
    };
    const savedTask = {
      ...task,
      assignedBy: task.assignedStaffId,
      description: null,
      assignedStaffName: "Staff",
      assignerName: "Manager",
      startedAt: now,
      completedAt: null,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
      status: FacilityTaskStatus.IN_PROGRESS,
    };
    const repository = {
      findById: async () => [task],
      update: async () => {
        order.push("task:update");
        return { task: savedTask };
      },
    } as unknown as FacilityTasksRepository;
    const assignments = {
      requireFacilityAccess: async () => ({ kind: "assigned" }),
    } as unknown as FacilityAssignmentsService;
    const bookings = {
      assertCheckInCanStart: async (bookingId: string) => {
        expect(bookingId).toBe(task.referenceId);
        order.push("booking:readiness");
      },
    } as BookingCheckInService;
    const service = new FacilityTasksService(repository, assignments, bookings);

    await service.update(
      task.id,
      { status: FacilityTaskStatus.IN_PROGRESS },
      {
        id: task.assignedStaffId,
        role: UserRole.FACILITY_STAFF,
      },
    );

    expect(order).toEqual(["booking:readiness", "task:update"]);
  });
});
