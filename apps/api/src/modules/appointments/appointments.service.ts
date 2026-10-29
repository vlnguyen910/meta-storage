import type {
  AppointmentQuery,
  AssignBookingStaffInput,
  CheckInLookupInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@metastorage/contracts";
import { AppError } from "../../common/errors/app-error";
import { APPOINTMENT_MESSAGES as m } from "./appointments.messages";

export class AppointmentsService {
  listCheckInSlots(): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  lookupCheckIn(_input: CheckInLookupInput, _staffId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  scheduleAppointment(_input: CreateAppointmentInput, _customerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  listAppointments(_query: AppointmentQuery, _actorId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  listCustomerAppointments(_query: AppointmentQuery, _customerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  listFacilityAppointments(_query: AppointmentQuery, _managerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  listAssignedAppointments(_staffId: string, _query: AppointmentQuery): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  getAppointment(_id: string, _actorId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  assignAppointmentStaff(_id: string, _input: AssignBookingStaffInput, _managerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  updateAppointment(_id: string, _input: UpdateAppointmentInput, _actorId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }
}
