import {
  ApiErrorCode,
  type ConfirmReservationInput,
  PaymentStatus,
  type Reservation,
  type ReservationQuote,
  type ReservationQuoteInput,
  ReservationStatus,
  StorageUnitStatus,
  UserRole,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { addMonths, currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, hydrateFacility, saveMockDatabase } from "../database";
import { registerGuestCheckoutHandlers } from "./guest-checkout.handlers";

export function registerReservationHandlers(mock: MockAdapter): void {
  registerGuestCheckoutHandlers(mock);

  mock.onPost("/reservations/quote").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    if (user.role !== UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Chỉ khách thuê kho có thể đặt chỗ")];
    }
    const input = parseBody<ReservationQuoteInput>(config.data);
    const unit = database.units.find(
      (candidate) =>
        candidate.facilityId === input.facilityId &&
        candidate.unitTypeId === input.unitTypeId &&
        candidate.status === StorageUnitStatus.AVAILABLE,
    );
    if (!unit) {
      return [409, errorBody(ApiErrorCode.UNIT_UNAVAILABLE, "Loại kho này vừa hết chỗ")];
    }
    const quote: ReservationQuote = {
      id: `quote-${crypto.randomUUID()}`,
      ...input,
      unitType: unit.unitType,
      sizeLabel: unit.sizeLabel,
      monthlyPrice: unit.monthlyPrice,
      rentalTotal: unit.monthlyPrice * input.durationMonths,
      depositAmount: unit.monthlyPrice,
      totalEstimated: unit.monthlyPrice * (input.durationMonths + 1),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    database.quotes.push(quote);
    saveMockDatabase(database);
    return [200, envelope(quote, "Báo giá có hiệu lực trong 15 phút")];
  });

  mock.onPost("/reservations/confirm").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    if (user.role !== UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Bạn không có quyền tạo reservation")];
    }
    const input = parseBody<ConfirmReservationInput>(config.data);
    const quote = database.quotes.find((candidate) => candidate.id === input.quoteId);
    if (!quote || new Date(quote.expiresAt).getTime() < Date.now()) {
      return [
        409,
        errorBody(ApiErrorCode.RESERVATION_CONFLICT, "Báo giá đã hết hạn, vui lòng tạo lại"),
      ];
    }
    if (input.paymentToken === "tok_fail") {
      return [
        402,
        errorBody(ApiErrorCode.PAYMENT_FAILED, "Ngân hàng từ chối giao dịch thử nghiệm"),
      ];
    }
    const unit = database.units.find(
      (candidate) =>
        candidate.facilityId === quote.facilityId &&
        candidate.unitTypeId === quote.unitTypeId &&
        candidate.status === StorageUnitStatus.AVAILABLE,
    );
    const facility = database.facilities.find((candidate) => candidate.id === quote.facilityId);
    if (!unit || !facility) {
      return [409, errorBody(ApiErrorCode.UNIT_UNAVAILABLE, "Kho vừa được khách khác giữ chỗ")];
    }

    const reservationId = `res-${crypto.randomUUID()}`;
    const payment = {
      id: `pay-${crypto.randomUUID()}`,
      reservationId,
      amount: quote.depositAmount,
      status: PaymentStatus.SUCCEEDED,
      brand: input.cardBrand,
      last4: input.cardLast4,
      paidAt: new Date().toISOString(),
    };
    const reservation: Reservation = {
      id: reservationId,
      code: `RS-${String(database.reservations.length + 1).padStart(5, "0")}`,
      userId: user.id,
      facility: hydrateFacility(database, facility),
      unitTypeId: quote.unitTypeId,
      unitType: quote.unitType,
      sizeLabel: quote.sizeLabel,
      startDate: quote.startDate,
      endDate: addMonths(quote.startDate, quote.durationMonths),
      durationMonths: quote.durationMonths,
      status: ReservationStatus.CONFIRMED,
      monthlyPrice: quote.monthlyPrice,
      depositAmount: quote.depositAmount,
      totalEstimated: quote.totalEstimated,
      payment,
      createdAt: new Date().toISOString(),
    };
    unit.status = StorageUnitStatus.RESERVED;
    database.payments.push(payment);
    database.reservations.unshift(reservation);
    database.quotes = database.quotes.filter((candidate) => candidate.id !== quote.id);
    saveMockDatabase(database);
    return [201, envelope(reservation, "Đặt kho và thanh toán tiền cọc thành công")];
  });

  mock.onGet("/reservations/mine").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    if (user.role !== UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Bạn không có quyền xem dữ liệu này")];
    }
    return [200, envelope(database.reservations.filter((item) => item.userId === user.id))];
  });

  mock.onGet(/\/reservations\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    const reservationId = config.url?.split("/")[2] ?? "";
    const reservation = database.reservations.find((item) => item.id === reservationId);
    if (!reservation) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy reservation")];
    }
    if (reservation.userId !== user.id) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Bạn không có quyền xem reservation này")];
    }
    return [200, envelope(reservation)];
  });
}
