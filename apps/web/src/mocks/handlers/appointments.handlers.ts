import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentRecordDto,
  type CheckInSlotOption,
  CreateAppointmentSchema,
  type PhysicalUnitAssignment,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";

const slots: CheckInSlotOption[] = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    name: "Ca 1",
    startTime: "09:00:00",
    endTime: "10:30:00",
    sameDayCheckInEnabled: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    name: "Ca 2",
    startTime: "10:30:00",
    endTime: "12:00:00",
    sameDayCheckInEnabled: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    name: "Ca 3",
    startTime: "14:00:00",
    endTime: "15:30:00",
    sameDayCheckInEnabled: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000004",
    name: "Ca 4",
    startTime: "15:30:00",
    endTime: "17:00:00",
    sameDayCheckInEnabled: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000005",
    name: "Demo check-in ngay",
    startTime: "08:00:00",
    endTime: "23:59:59.999999",
    sameDayCheckInEnabled: true,
  },
];

export function registerAppointmentHandlers(mock: MockAdapter): void {
  mock.onGet("/appointments/check-in-slots").reply(200, envelope(slots));
  mock.onGet("/appointments/mine").reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];
    const items = db.appointments.filter(
      (item) =>
        item.customerId === user.id &&
        (!config.params?.appointmentType ||
          item.appointmentType === config.params.appointmentType) &&
        (!config.params?.status || item.status === config.params.status),
    );
    return [200, envelope(items)];
  });
  mock.onPost("/appointments").reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const parsed = CreateAppointmentSchema.safeParse(parseBody(config.data));
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];
    if (!parsed.success) return [400, errorBody(400, "Thông tin lịch hẹn không hợp lệ")];
    const input = parsed.data;
    const rental = input.rentalId
      ? db.rentals.find((item) => item.id === input.rentalId && item.userId === user.id)
      : undefined;
    if (input.appointmentType === APPOINTMENT_TYPES.CHECK_OUT && !rental)
      return [404, errorBody(404, "Không tìm thấy kho thuê")];
    const slot = slots.find((item) => item.id === input.slotId);
    if (!slot) return [400, errorBody(400, "Khung giờ không hợp lệ")];
    const facilityId = rental?.facility.id ?? input.facilityId ?? "fac-hcm-central";
    const facility = db.facilities.find((item) => item.id === facilityId);
    const record: AppointmentRecordDto = {
      id: crypto.randomUUID(),
      facilityId,
      appointmentType: input.appointmentType,
      scheduledDate: input.scheduledDate,
      slotId: input.slotId,
      status: APPOINTMENT_STATUSES.SCHEDULED,
      customerId: user.id,
      contactPhone: input.contactPhone ?? user.phone ?? null,
      reservationId: input.reservationId ?? null,
      rentalId: input.rentalId ?? null,
      supportTicketId: input.supportTicketId ?? null,
      assignedStaffId: null,
      createdBy: user.id,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slotName: slot.name,
      slotStart: slot.startTime,
      slotEnd: slot.endTime,
      facility: facility
        ? {
            id: facility.id,
            name: facility.name,
            address: `${facility.address.line1}, ${facility.address.ward}, ${facility.address.district}, ${facility.address.city}`,
          }
        : undefined,
    };
    db.appointments.push(record);
    saveMockDatabase(db);
    return [201, envelope(record)];
  });
  mock.onPatch(/\/appointments\/[^/]+$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];
    const id = config.url?.split("/").at(-1);
    const appointment = db.appointments.find((item) => item.id === id);
    if (!appointment) return [404, errorBody(404, "Không tìm thấy lịch hẹn")];

    // If customer is cancelling
    if (user.role === UserRole.STORAGE_CUSTOMER) {
      if (appointment.customerId !== user.id)
        return [403, errorBody(403, "Không có quyền thực hiện")];
      const body = parseBody<{ status?: APPOINTMENT_STATUSES }>(config.data);
      if (
        body.status !== APPOINTMENT_STATUSES.CANCELLED ||
        ![APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.CONFIRMED].includes(
          appointment.status,
        )
      )
        return [409, errorBody(409, "Lịch hẹn không thể hủy")];
      const startsAt = Date.parse(
        `${appointment.scheduledDate}T${appointment.slotStart ?? "00:00"}+07:00`,
      );
      if (startsAt <= Date.now()) return [409, errorBody(409, "Đã quá thời hạn hủy lịch hẹn")];
      appointment.status = APPOINTMENT_STATUSES.CANCELLED;
      appointment.updatedAt = new Date().toISOString();
      saveMockDatabase(db);
      return [200, envelope(appointment)];
    }

    // Facility Manager / Admin updating appointment (unit, staff, status, notes)
    const body = parseBody<{
      status?: APPOINTMENT_STATUSES;
      assignedStaffId?: string;
      physicalUnitId?: string;
      assignmentReason?: string;
      notes?: string;
    }>(config.data);

    if (body.assignedStaffId) {
      const staff = db.users.find(
        (u) => u.id === body.assignedStaffId && u.role === UserRole.FACILITY_STAFF,
      );
      if (staff) {
        appointment.assignedStaffId = staff.id;
        (appointment as { assignedStaffName?: string }).assignedStaffName = staff.name;
        const booking = db.bookings.find(
          (b) => b.id === appointment.reservationId || b.id === appointment.id,
        );
        if (booking) {
          booking.assignedStaff = {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            phone: staff.phone ?? null,
            role: UserRole.FACILITY_STAFF,
            isActive: true,
          };
        }
      }
    }

    if (body.physicalUnitId) {
      const unit = db.units.find((u) => u.id === body.physicalUnitId);
      if (unit) {
        const assignment: PhysicalUnitAssignment = {
          id: crypto.randomUUID(),
          bookingId: appointment.reservationId ?? appointment.id,
          physicalUnitId: unit.id,
          physicalUnitCode: unit.code,
          assignedBy: user.id,
          assignerName: user.name,
          status: "ACTIVE",
          assignedAt: new Date().toISOString(),
          endedAt: null,
          reason: body.assignmentReason ?? null,
        };
        appointment.assignedUnit = {
          id: assignment.id,
          physicalUnitId: assignment.physicalUnitId,
          physicalUnitCode: assignment.physicalUnitCode,
          assignedBy: assignment.assignedBy,
          assignedAt: assignment.assignedAt,
          endedAt: assignment.endedAt,
          reason: assignment.reason ?? null,
          status: assignment.status,
        };
        const booking = db.bookings.find(
          (b) => b.id === appointment.reservationId || b.id === appointment.id,
        );
        if (booking) {
          booking.assignedUnit = assignment;
        }
      }
    }

    if (body.status) {
      appointment.status = body.status;
    }

    if (body.notes !== undefined) {
      appointment.notes = body.notes;
    }

    appointment.updatedAt = new Date().toISOString();
    saveMockDatabase(db);
    return [200, envelope(appointment)];
  });

  mock.onPost(/\/appointments\/[^/]+\/assign-staff$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];
    const id = config.url?.split("/").slice(-2, -1)[0];
    const appointment = db.appointments.find((item) => item.id === id);
    if (!appointment) return [404, errorBody(404, "Không tìm thấy lịch hẹn")];
    const body = parseBody<{ staffId: string }>(config.data);
    const staff = db.users.find((u) => u.id === body.staffId && u.role === UserRole.FACILITY_STAFF);
    if (!staff) return [404, errorBody(404, "Không tìm thấy nhân viên")];

    appointment.assignedStaffId = staff.id;
    (appointment as { assignedStaffName?: string }).assignedStaffName = staff.name;
    appointment.status = APPOINTMENT_STATUSES.CONFIRMED;
    const booking = db.bookings.find(
      (b) => b.id === appointment.reservationId || b.id === appointment.id,
    );
    if (booking) {
      booking.assignedStaff = {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone ?? null,
        role: UserRole.FACILITY_STAFF,
        isActive: true,
      };
    }
    appointment.updatedAt = new Date().toISOString();
    saveMockDatabase(db);
    return [200, envelope(appointment)];
  });
}
