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
});
