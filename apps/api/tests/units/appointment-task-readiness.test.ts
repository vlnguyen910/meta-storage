import { describe, expect, test } from "bun:test";
import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { env } from "../../src/config/env";
import { AppointmentsService } from "../../src/modules/appointments/appointments.service";
import type { CheckInSlotsService } from "../../src/modules/appointments/check-in-slots.service";
import type { FacilityAssignmentsService } from "../../src/modules/facilities/facility-assignments.service";
import type { FacilityTasksRepository } from "../../src/modules/facility-tasks/facility-tasks.repository";
import { FacilityTasksService } from "../../src/modules/facility-tasks/facility-tasks.service";

function fixture(
  referenceType = FacilityTaskReferenceType.APPOINTMENT,
  appointmentType = "CHECK_IN",
) {
  const writes: string[] = [];
  const appointment = {
    appointmentType,
    id: "appointment",
    slotId: "slot",
    scheduledDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: "CONFIRMED",
  };
  const task = {
    id: "task",
    facilityId: "facility",
    referenceId: "appointment",
    referenceType,
    type:
      appointmentType === "CHECK_IN"
        ? FacilityTaskType.CHECK_IN_HANDOVER
        : appointmentType === "CHECK_OUT"
          ? FacilityTaskType.RETURN_INSPECTION
          : FacilityTaskType.HANDLE_SUPPORT,
    assignedStaffId: "staff",
    status: FacilityTaskStatus.ASSIGNED,
  };
  const repository = {
    findById: async () => [task],
    findAppointment: async () => appointment,
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
  return { writes, repository, actor, appointment };
}
describe("appointment task readiness", () => {
  test("support appointments still refuse an early start before writing the task", async () => {
    const f = fixture(FacilityTaskReferenceType.APPOINTMENT, "SUPPORT");
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
    "%s permits early check-in and check-out",
    async (mode) => {
      const previous = env.NODE_ENV;
      env.NODE_ENV = mode;
      try {
        for (const type of ["CHECK_IN", "CHECK_OUT"]) {
          const f = fixture(FacilityTaskReferenceType.APPOINTMENT, type);
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
          await service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor);
          expect(f.writes).toEqual(["update"]);
        }
      } finally {
        env.NODE_ENV = previous;
      }
    },
  );
  test.each(["CHECK_IN", "CHECK_OUT"])(
    "%s still requires confirmation and an unexpired appointment",
    async (type) => {
      const f = fixture(FacilityTaskReferenceType.APPOINTMENT, type);
      const slots = {
        findByIdForDate: async () => ({
          startsAt: new Date(Date.now() - 120000),
          endsAt: new Date(Date.now() - 60000),
        }),
        allowsCheckInDuringSameDaySlot: () => false,
      } as CheckInSlotsService;
      const service = new FacilityTasksService(
        f.repository,
        {} as FacilityAssignmentsService,
        slots,
      );
      f.appointment.status = "SCHEDULED";
      await expect(
        service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      f.appointment.status = "CONFIRMED";
      f.appointment.scheduledDate = "2000-01-01";
      await expect(
        service.update("task", { status: FacilityTaskStatus.IN_PROGRESS }, f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.writes).toEqual([]);
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

function appointmentFixture(appointmentType: "CHECK_IN" | "CHECK_OUT" | "SUPPORT") {
  const writes: string[] = [];
  const appointment = {
    id: "appointment",
    appointmentType,
    facilityId: "facility",
    customerId: "customer",
    reservationId: appointmentType === "CHECK_IN" ? "reservation" : null,
    rentalId: appointmentType === "CHECK_OUT" ? "rental" : null,
    assignedStaffId: "staff",
    slotId: "slot",
    scheduledDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: "CONFIRMED",
  };
  const slot = {
    startsAt: new Date(Date.now() + 60000),
    endsAt: new Date(Date.now() + 120000),
  };
  const reservation = { id: "reservation", status: "CHECKED_IN" };
  const rental = { id: "rental", status: "CLOSED" };
  const service = new AppointmentsService(
    {
      findById: async () => appointment,
      findByIdForUpdate: async () => appointment,
      transaction: async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          select: () => ({
            from: () => ({
              where: async () => [{ bookingId: null, reservationId: null }],
            }),
          }),
        }),
      update: async (_id: string, input: { status: string }) => {
        writes.push("update");
        return { ...appointment, ...input };
      },
    } as never,
    { requireFacilityAccess: async () => undefined } as never,
    {} as never,
    {
      findByIdForDate: async () => slot,
      allowsCheckInDuringSameDaySlot: () => false,
    } as never,
    { requireCustomerReservation: async () => reservation } as never,
    {
      requireAppointmentContext: async () => ({ rental }),
      getCustomerRental: async () => rental,
    } as never,
    {} as never,
    {
      finishAppointment: async () => {
        writes.push("finish");
      },
    } as never,
    {} as never,
  );
  const actor = { id: "staff", role: UserRole.FACILITY_STAFF };
  return { service, appointment, actor, writes, reservation, rental };
}

describe("early appointment inspection and completion", () => {
  test.each(["CHECK_IN", "CHECK_OUT"] as const)(
    "%s allows inspection and completion before the slot starts",
    async (type) => {
      const f = appointmentFixture(type);
      const context = await f.service.requireInspectionContext({} as never, "appointment", f.actor);
      expect(context.appointment.id).toBe("appointment");
      const result = await f.service.updateAppointment(
        "appointment",
        { status: "COMPLETED" },
        f.actor,
      );
      expect(result.status).toBe("COMPLETED");
      expect(f.writes).toEqual(["finish", "update"]);
    },
  );

  test.each(["CHECK_IN", "CHECK_OUT"] as const)(
    "%s still rejects inspection and completion after the appointment expires",
    async (type) => {
      const f = appointmentFixture(type);
      f.appointment.scheduledDate = "2000-01-01";
      await expect(
        f.service.requireInspectionContext({} as never, "appointment", f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.service.updateAppointment("appointment", { status: "COMPLETED" }, f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.writes).toEqual([]);
    },
  );

  test.each(["CHECK_IN", "CHECK_OUT"] as const)(
    "%s still requires the assigned staff member and confirmation",
    async (type) => {
      const f = appointmentFixture(type);
      const otherStaff = { ...f.actor, id: "other-staff" };
      await expect(
        f.service.requireInspectionContext({} as never, "appointment", otherStaff),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.updateAppointment("appointment", { status: "COMPLETED" }, otherStaff),
      ).rejects.toMatchObject({ statusCode: 403 });
      f.appointment.status = "SCHEDULED";
      await expect(
        f.service.requireInspectionContext({} as never, "appointment", f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.service.updateAppointment("appointment", { status: "COMPLETED" }, f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.writes).toEqual([]);
    },
  );

  test.each(["CHECK_IN", "CHECK_OUT"] as const)(
    "%s still requires handover or rental closure before completion",
    async (type) => {
      const f = appointmentFixture(type);
      f.reservation.status = "CONFIRMED";
      f.rental.status = "ACTIVE";
      await expect(
        f.service.updateAppointment("appointment", { status: "COMPLETED" }, f.actor),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.writes).toEqual([]);
    },
  );

  test("support appointment completion still waits until the slot starts", async () => {
    const f = appointmentFixture("SUPPORT");
    await expect(
      f.service.updateAppointment("appointment", { status: "COMPLETED" }, f.actor),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(f.writes).toEqual([]);
  });
});
