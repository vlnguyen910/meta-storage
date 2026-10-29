import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentRecordDto,
  type CheckInSlotOption,
  CreateAppointmentSchema,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";

const slots: CheckInSlotOption[] = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    name: "Ca 1",
    startTime: "07:00:00",
    endTime: "09:00:00",
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    name: "Ca 2",
    startTime: "09:00:00",
    endTime: "11:00:00",
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    name: "Ca 3",
    startTime: "14:00:00",
    endTime: "16:00:00",
  },
  {
    id: "e0000000-0000-0000-0000-000000000004",
    name: "Ca 4",
    startTime: "15:00:00",
    endTime: "17:00:00",
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
    const appointment = db.appointments.find(
      (item) => item.id === id && item.customerId === user.id,
    );
    if (!appointment) return [404, errorBody(404, "Không tìm thấy lịch hẹn")];
    const body = parseBody<{ status?: APPOINTMENT_STATUSES }>(config.data);
    if (
      body.status !== APPOINTMENT_STATUSES.CANCELLED ||
      ![APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.CONFIRMED].includes(appointment.status)
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
  });
}
