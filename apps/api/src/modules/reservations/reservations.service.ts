import type {
  BookingDraftInput,
  BookingPaymentInput,
  ReservationQuery,
} from "@metastorage/contracts";
import { AppError } from "../../common/errors/app-error";
import { RESERVATION_RECORD_MESSAGES as m } from "./reservations.messages";

export class ReservationsService {
  createReservationDraft(_input: BookingDraftInput, _customerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  listCustomerReservations(_customerId: string, _query: ReservationQuery): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  getCustomerReservation(_id: string, _customerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  listFacilityReservations(
    _facilityId: string,
    _query: ReservationQuery,
    _managerId: string,
  ): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  getReservation(_id: string, _actorId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  cancelReservation(_id: string, _customerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }

  startReservationPayment(_id: string, _input: BookingPaymentInput, _customerId: string): never {
    throw new AppError(m.notImplemented, 501, "NOT_IMPLEMENTED");
  }
}
