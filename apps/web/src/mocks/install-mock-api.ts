import { ApiErrorCode } from "@metastorage/contracts";
import type { AxiosInstance } from "axios";
import MockAdapter from "axios-mock-adapter";
import { errorBody } from "./core/http";
import { registerAuthHandlers } from "./handlers/auth.handlers";
import { registerBookingHandlers } from "./handlers/bookings.handlers";
import { registerDashboardHandlers } from "./handlers/dashboards.handlers";
import { registerFacilityHandlers } from "./handlers/facilities.handlers";
import { registerInspectionHandlers } from "./handlers/inspections.handlers";
import { registerRentalHandlers } from "./handlers/rentals.handlers";
import { registerReservationHandlers } from "./handlers/reservations.handlers";
import { registerUsersHandlers } from "./handlers/users.handlers";
import { MOCK_MESSAGES } from "./mock.messages";

const installed = new WeakSet<AxiosInstance>();

export function installMockApi(http: AxiosInstance): void {
  if (installed.has(http) || typeof window === "undefined") return;
  installed.add(http);

  const delayResponse = Number(process.env.NEXT_PUBLIC_MOCK_DELAY_MS ?? 400);
  const mock = new MockAdapter(http, { delayResponse });

  registerAuthHandlers(mock);
  registerFacilityHandlers(mock);
  registerReservationHandlers(mock);
  registerRentalHandlers(mock);
  registerInspectionHandlers(mock);
  registerBookingHandlers(mock);
  registerDashboardHandlers(mock);
  registerUsersHandlers(mock);

  mock.onAny().reply(404, errorBody(ApiErrorCode.NOT_FOUND, MOCK_MESSAGES.endpoint));
}
