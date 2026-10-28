import { describe, expect, it, mock } from "bun:test";
import { CreateAppointmentSchema, UserRole, UserStatus } from "@metastorage/contracts";
import { AppointmentStatus, AppointmentType, ReservationStatus } from "@metastorage/database";
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
    const createAppointment = mock(async (input: unknown) => input);
    const repository = {
      isFacilityActive: async () => true,
      isCustomerActive: async () => true,
      slotExists: async () => true,
      createAppointment,
    } as unknown as AppointmentsRepository;
    const service = new AppointmentsService(repository, assignments);
    await service.createAppointment(
      {
        appointmentType: AppointmentType.SUPPORT,
        facilityId: "facility",
        scheduledDate: "2100-01-01",
        slotId: "slot",
      },
      customer,
    );
    expect(createAppointment).toHaveBeenCalledWith(
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
      findAppointmentById: async () => ({ customerId: "other", facilityId: "facility" }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).getAppointment("id", customer),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("không cho khách xem lịch được tạo bởi người khác", async () => {
    const repository = {
      findAppointmentById: async () => ({ customerId: "customer", createdBy: "staff" }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).getAppointment("id", customer),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("chỉ yêu cầu danh sách lịch do khách đăng nhập tạo", async () => {
    const listAppointments = mock(async () => ({ items: [], total: 0, limit: 20, offset: 0 }));
    const repository = { listAppointments } as unknown as AppointmentsRepository;
    await new AppointmentsService(repository, assignments).listAppointments(
      { limit: 20, offset: 0 },
      customer,
    );
    expect(listAppointments).toHaveBeenCalledWith({ limit: 20, offset: 0 }, customer.id, undefined);
  });

  it("dùng cơ sở đang chọn của staff và kiểm tra assignment", async () => {
    const listAppointments = mock(async () => ({ items: [], total: 0, limit: 20, offset: 0 }));
    const requireFacilityAccess = mock(async () => undefined);
    const repository = { listAppointments } as unknown as AppointmentsRepository;
    const facilityAssignmentsService = {
      requireFacilityAccess,
    } as unknown as FacilityAssignmentsService;
    const actor = {
      id: "staff",
      role: UserRole.FACILITY_STAFF,
      facilityId: "selected-facility",
    };
    await new AppointmentsService(repository, facilityAssignmentsService).listAppointments(
      { limit: 20, offset: 0 },
      actor,
    );
    expect(listAppointments).toHaveBeenCalledWith(
      { limit: 20, offset: 0 },
      undefined,
      "selected-facility",
    );
    expect(requireFacilityAccess).toHaveBeenCalledWith(
      "selected-facility",
      expect.objectContaining({ userId: actor.id, role: actor.role }),
    );
  });

  it("cho phép chỉnh sửa lịch đã hoàn thành", async () => {
    const updateAppointment = mock(async () => ({ status: AppointmentStatus.COMPLETED }));
    const repository = {
      findAppointmentById: async () => ({
        customerId: "customer",
        createdBy: "customer",
        status: AppointmentStatus.COMPLETED,
      }),
      updateAppointment,
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).updateAppointment(
        "id",
        { notes: "ghi chú" },
        customer,
      ),
    ).resolves.toMatchObject({ status: AppointmentStatus.COMPLETED });
    expect(updateAppointment).toHaveBeenCalledWith("id", { notes: "ghi chú" });
  });

  it("không cho khách xác nhận lịch hẹn", async () => {
    const repository = {
      findAppointmentById: async () => ({
        customerId: "customer",
        createdBy: "customer",
        status: AppointmentStatus.SCHEDULED,
      }),
    } as unknown as AppointmentsRepository;
    await expect(
      new AppointmentsService(repository, assignments).updateAppointment(
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
      new AppointmentsService(repository, assignments).createAppointment(
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

  it("cho phép nhân viên cập nhật trạng thái mà không kiểm tra trạng thái hiện tại", async () => {
    const updateAppointment = mock(async () => ({ status: AppointmentStatus.COMPLETED }));
    const repository = {
      findAppointmentById: async () => ({
        customerId: "customer",
        facilityId: "facility",
        status: AppointmentStatus.SCHEDULED,
      }),
      updateAppointment,
    } as unknown as AppointmentsRepository;
    const access = {
      requireFacilityAccess: async () => undefined,
    } as unknown as FacilityAssignmentsService;
    await expect(
      new AppointmentsService(repository, access).updateAppointment(
        "id",
        { status: AppointmentStatus.COMPLETED },
        { id: "staff", role: UserRole.FACILITY_STAFF },
      ),
    ).resolves.toMatchObject({ status: AppointmentStatus.COMPLETED });
    expect(updateAppointment).toHaveBeenCalledWith("id", {
      status: AppointmentStatus.COMPLETED,
    });
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
  it("không cho khách xem đặt kho của khách khác", async () => {
    const repository = {
      findReservationById: async () => ({ customerId: "other" }),
    } as unknown as ReservationsRepository;
    await expect(
      new ReservationsService(repository, assignments).getReservation("id", customer),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("chỉ yêu cầu danh sách đặt kho của khách đăng nhập", async () => {
    const listReservations = mock(async () => ({ items: [], total: 0, limit: 20, offset: 0 }));
    const repository = { listReservations } as unknown as ReservationsRepository;
    await new ReservationsService(repository, assignments).listReservations(
      { limit: 20, offset: 0 },
      customer,
    );
    expect(listReservations).toHaveBeenCalledWith({ limit: 20, offset: 0 }, customer.id, undefined);
  });

  it("dùng cơ sở đang chọn của staff và kiểm tra assignment", async () => {
    const listReservations = mock(async () => ({ items: [], total: 0, limit: 20, offset: 0 }));
    const requireFacilityAccess = mock(async () => undefined);
    const repository = { listReservations } as unknown as ReservationsRepository;
    const facilityAssignmentsService = {
      requireFacilityAccess,
    } as unknown as FacilityAssignmentsService;
    const actor = {
      id: "staff",
      role: UserRole.FACILITY_STAFF,
      facilityId: "selected-facility",
    };
    await new ReservationsService(repository, facilityAssignmentsService).listReservations(
      { limit: 20, offset: 0 },
      actor,
    );
    expect(listReservations).toHaveBeenCalledWith(
      { limit: 20, offset: 0 },
      undefined,
      "selected-facility",
    );
    expect(requireFacilityAccess).toHaveBeenCalledWith(
      "selected-facility",
      expect.objectContaining({ userId: actor.id, role: actor.role }),
    );
  });

  it("cho phép khách cập nhật đặt kho không ở trạng thái nháp", async () => {
    const updateReservation = mock(async () => ({ status: ReservationStatus.CONFIRMED }));
    const repository = {
      findReservationById: async () => ({
        customerId: customer.id,
        status: ReservationStatus.CONFIRMED,
        monthlyRateSnapshot: "100000",
        depositAmount: "100000",
      }),
      updateReservation,
    } as unknown as ReservationsRepository;
    const updatedReservation = await new ReservationsService(
      repository,
      assignments,
    ).updateReservation(
      "reservation",
      { startAt: "2100-01-31T00:00:00+07:00", requestedMonths: 1 },
      customer,
    );
    expect(updatedReservation).toMatchObject({ status: ReservationStatus.CONFIRMED });
    expect(updateReservation).toHaveBeenCalledWith(
      "reservation",
      customer.id,
      expect.objectContaining({ rentalFeeAmount: "100000", totalAmount: "200000" }),
    );
  });

  it("tính giá từ loại kho và ngày kết thúc theo tháng", async () => {
    const createReservation = mock(async (input: unknown) => input);
    const repository = {
      findActiveUnitType: async () => ({ monthlyPrice: 100000 }),
      createReservation,
    } as unknown as ReservationsRepository;
    await new ReservationsService(repository, assignments).createReservation(
      {
        facilityId: "facility",
        unitTypeId: "type",
        startAt: "2100-01-31T00:00:00+07:00",
        requestedMonths: 1,
      },
      customer,
    );
    expect(createReservation).toHaveBeenCalledWith(
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
