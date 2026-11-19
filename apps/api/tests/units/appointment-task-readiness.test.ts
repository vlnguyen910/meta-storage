import { describe, expect, test } from "bun:test";
import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { env } from "../../src/config/env";
import type { CheckInSlotsService } from "../../src/modules/appointments/check-in-slots.service";
import type { FacilityAssignmentsService } from "../../src/modules/facilities/facility-assignments.service";
import type { FacilityTasksRepository } from "../../src/modules/facility-tasks/facility-tasks.repository";
import { FacilityTasksService } from "../../src/modules/facility-tasks/facility-tasks.service";

function fixture(referenceType = FacilityTaskReferenceType.APPOINTMENT) {
  const writes: string[] = [];
  const task = {
    id: "task",
    facilityId: "facility",
    referenceId: "appointment",
    referenceType,
    type: FacilityTaskType.CHECK_IN_HANDOVER,
    assignedStaffId: "staff",
    status: FacilityTaskStatus.ASSIGNED,
  };
  const repository = {
    findById: async () => [task],
    findAppointment: async () => ({
      appointmentType: "CHECK_IN",
      id: "appointment",
      slotId: "slot",
      scheduledDate: "2030-01-01",
      status: "CONFIRMED",
    }),
    update: async () => {
      writes.push("update");
      const now = new Date();
      return {
        task: {
          ...task,
          assignedBy: "manager",
          description: null,
          assignedStaffName: "Staff",
          assignerName: "Manager",
          startedAt: now,
          completedAt: null,
          assignedAt: now,
          createdAt: now,
          updatedAt: now,
          status: FacilityTaskStatus.IN_PROGRESS,
        },
      };
    },
  } as unknown as FacilityTasksRepository;
  const actor = { id: "staff", role: UserRole.FACILITY_STAFF };
  return { writes, repository, actor };
}
describe("appointment task readiness", () => {
  test("refuses an early start before writing the task", async () => {
    const f = fixture();
    const slots = {
      findByIdForDate: async () => ({
        startsAt: new Date(Date.now() + 60000),
        endsAt: new Date(Date.now() + 120000),
      }),
      allowsCheckInDuringSameDaySlot: () => false,
    } as CheckInSlotsService;
    const service = new FacilityTasksService(f.repository, {} as FacilityAssignmentsService, slots);
    await expect(
      service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(f.writes).toEqual([]);
  });
  test("allows a confirmed appointment within its slot", async () => {
    const f = fixture();
    const slots = {
      findByIdForDate: async () => ({
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 60000),
      }),
      allowsCheckInDuringSameDaySlot: () => false,
    } as CheckInSlotsService;
    const service = new FacilityTasksService(f.repository, {} as FacilityAssignmentsService, slots);
    await service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor);
    expect(f.writes).toEqual(["update"]);
  });
  test.each(["develop", "development", "test", "production"] as const)(
    "%s only permits early check-in in development environments",
    async (mode) => {
      const previous = env.NODE_ENV;
      env.NODE_ENV = mode;
      try {
        const f = fixture();
        const slots = {
          findByIdForDate: async () => ({
            startsAt: new Date(Date.now() + 60000),
            endsAt: new Date(Date.now() + 120000),
          }),
          allowsCheckInDuringSameDaySlot: () => false,
        } as CheckInSlotsService;
        const service = new FacilityTasksService(
          f.repository,
          {} as FacilityAssignmentsService,
          slots,
        );
        const request = service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor);
        if (mode === "develop" || mode === "development") {
          await request;
          expect(f.writes).toEqual(["update"]);
        } else {
          await expect(request).rejects.toMatchObject({ statusCode: 409 });
          expect(f.writes).toEqual([]);
        }
      } finally {
        env.NODE_ENV = previous;
      }
    },
  );
  test("requires conversion of legacy booking tasks before starting", async () => {
    const f = fixture(FacilityTaskReferenceType.BOOKING);
    const service = new FacilityTasksService(f.repository, {} as FacilityAssignmentsService);
    await expect(
      service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(f.writes).toEqual([]);
  });
  test("resets an in-progress appointment task to a fresh assigned task when unit is reassigned", async () => {
    const events: string[] = [];
    const repository = {
      findActiveAppointmentTask: async () => [
        {
          id: "old-task",
          facilityId: "facility",
          referenceId: "appointment",
          referenceType: FacilityTaskReferenceType.APPOINTMENT,
          type: FacilityTaskType.CHECK_IN_HANDOVER,
          assignedStaffId: "staff",
          status: FacilityTaskStatus.IN_PROGRESS,
        },
      ],
      hasTaskInspection: async () => true,
      setWorkflowStatus: async (_tx: unknown, id: string, status: FacilityTaskStatus) => {
        events.push(`cancel:${id}:${status}`);
      },
      createAppointmentTask: async (
        _tx: unknown,
        input: { assignedStaffId: string; type: string },
      ) => {
        events.push(`create:${input.type}:${input.assignedStaffId}`);
      },
    } as unknown as FacilityTasksRepository;
    const assignments = {
      requireActiveAssignments: async () => undefined,
    } as unknown as FacilityAssignmentsService;
    const service = new FacilityTasksService(repository, assignments);
    await service.assignAppointment(
      {} as never,
      {
        id: "appointment",
        facilityId: "facility",
        appointmentType: "CHECK_IN",
        assignedStaffId: "staff",
      } as never,
      "manager",
      { resetInProgress: true },
    );
    expect(events).toEqual(["cancel:old-task:CANCELLED", "create:CHECK_IN_HANDOVER:staff"]);
  });
});
