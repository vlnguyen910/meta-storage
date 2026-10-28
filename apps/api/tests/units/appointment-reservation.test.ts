import { describe, expect, it, mock } from "bun:test";
import { CreateAppointmentSchema, UserRole, UserStatus } from "@metastorage/contracts";
import { AppointmentStatus, AppointmentType } from "@metastorage/database";
import type { AppointmentsRepository } from "../../src/modules/appointments/appointments.repository";
import { AppointmentsService } from "../../src/modules/appointments/appointments.service";
import { assertActiveUser, assertUserHasRole } from "../../src/modules/auth/auth.authorization";
import type { FacilityAssignmentsService } from "../../src/modules/facilities/facility-assignments.service";
import type { ReservationsRepository } from "../../src/modules/reservations/reservations.repository";
import { ReservationsService } from "../../src/modules/reservations/reservations.service";

const customer = { id: "customer", role: UserRole.STORAGE_CUSTOMER };
const assignments = {} as FacilityAssignmentsService;

describe("quyền người dùng", () => {
  it("chỉ chấp nhận tài khoản đang hoạt động và vai trò được cấp", () => {
    const user = { role: UserRole.STORAGE_CUSTOMER, status: UserStatus.ACTIVE };
    expect(() => assertActiveUser(user)).not.toThrow();
    expect(() => assertUserHasRole(user, [UserRole.STORAGE_CUSTOMER])).not.toThrow();
    expect(() => assertUserHasRole(user, [UserRole.FACILITY_STAFF])).toThrow();
    expect(() => assertActiveUser({ ...user, status: UserStatus.INACTIVE })).toThrow();
  });
});

describe("appointment service", () => {
  it("tạo lịch hỗ trợ độc lập và lấy khách từ phiên đăng nhập", async () => {
    const create = mock(async (input: unknown) => input);
    const repository = {
      isFacilityActive: async () => true,
      isCustomerActive: async () => true,
      slotExists: async () => true,
      create,
    } as unknown as AppointmentsRepository;
    const service = new AppointmentsService(repository, assignments);
    await service.create(
      {
        appointmentType: AppointmentType.SUPPORT,
        facilityId: "facility",
        scheduledDate: "2100-01-01",
        slotId: "slot",
      },
      customer,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer",
        facilityId: "facility",
        createdBy: "customer",
        supportTicketId: undefined,
      }),
    );
  });

  it("không cho khách xem lịch của khách khác", async () => {
    const repository = {
      findById: async () => ({ customerId: "other", facilityId: "facility" }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).get("id", customer),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("không cho cập nhật lịch đã hoàn thành", async () => {
    const repository = {
      findById: async () => ({ customerId: "customer", status: AppointmentStatus.COMPLETED }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).update("id", { notes: "ghi chú" }, customer),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("không cho khách xác nhận lịch hẹn", async () => {
    const repository = {
      findById: async () => ({ customerId: "customer", status: AppointmentStatus.SCHEDULED }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).update(
        "id",
        { status: AppointmentStatus.CONFIRMED },
        customer,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("từ chối lịch check-in của khách khác", async () => {
    const repository = {
      findReservationContext: async () => ({ customerId: "other", facilityId: "facility" }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).create(
        {
          appointmentType: AppointmentType.CHECK_IN,
          reservationId: "reservation",
          scheduledDate: "2100-01-01",
          slotId: "slot",
        },
        customer,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("không cho nhân viên hoàn thành lịch chưa xác nhận", async () => {
    const repository = {
      findById: async () => ({
        customerId: "customer",
        facilityId: "facility",
        status: AppointmentStatus.SCHEDULED,
      }),
    } as unknown as AppointmentsRepository;
    const access = {
      requireFacilityAccess: async () => undefined,
    } as unknown as FacilityAssignmentsService;
    await expect(
      new AppointmentsService(repository, access).update(
        "id",
        { status: AppointmentStatus.COMPLETED },
        { id: "staff", role: UserRole.FACILITY_STAFF },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("yêu cầu hồ sơ phù hợp với loại lịch", () => {
    expect(
      CreateAppointmentSchema.safeParse({
        appointmentType: AppointmentType.CHECK_IN,
        scheduledDate: "2100-01-01",
        slotId: "b03c6ea1-f246-48db-9c86-f592e314c0a1",
      }).success,
    ).toBe(false);
  });
});

describe("reservation service", () => {
  it("tính giá từ loại kho và ngày kết thúc theo tháng", async () => {
    const create = mock(async (input: unknown) => input);
    const repository = {
      findActiveUnitType: async () => ({ monthlyPrice: 100000 }),
      create,
    } as unknown as ReservationsRepository;
    await new ReservationsService(repository, assignments).create(
      {
        facilityId: "facility",
        unitTypeId: "type",
        startAt: "2100-01-31T00:00:00+07:00",
        requestedMonths: 1,
      },
      customer,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer",
        rentalStartAt: new Date("2100-01-31T00:00:00+07:00"),
        rentalEndAt: new Date("2100-02-28T00:00:00+07:00"),
        rentalFeeAmount: "100000",
        depositAmount: "100000",
        totalAmount: "200000",
      }),
    );
  });
});
