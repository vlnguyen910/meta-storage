import { ApiErrorCode } from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody } from "../core/http";
import { getMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
export function registerRentalHandlers(mock: MockAdapter): void {
  mock.onGet("/rentals/mine").reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, M.forbidden)];
    return [200, envelope(db.rentals.filter((r) => r.userId === user.id))];
  });
  mock.onGet(/\/rentals\/[^/]+$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const rental = db.rentals.find((r) => r.id === config.url?.split("/")[2]);
    if (!rental) return [404, errorBody(ApiErrorCode.NOT_FOUND, M.missing)];
    return rental.userId === user?.id
      ? [200, envelope(rental)]
      : [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
  });
}
