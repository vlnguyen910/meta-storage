import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody } from "../core/http";
import { getMockDatabase } from "../database";
import { MOCK_MESSAGES as M } from "../mock.messages";
export function registerRentalHandlers(mock: MockAdapter): void {
  mock.onGet("/rentals/mine").reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    if (!user) return [401, errorBody(401, M.forbidden)];
    const history = config.params?.view === "history";
    const items = db.rentals
      .filter((r) => r.userId === user.id)
      .filter((r) =>
        history
          ? ["CLOSED", "CANCELLED"].includes(r.status)
          : !["CLOSED", "CANCELLED"].includes(r.status),
      );
    return [200, envelope({ items, nextCursor: null })];
  });
  mock.onGet(/\/rentals\/[^/]+$/).reply((config) => {
    const db = getMockDatabase();
    const user = currentUser(config, db);
    const rental = db.rentals.find((r) => r.id === config.url?.split("/")[2]);
    if (!rental) return [404, errorBody(404, M.missing)];
    return rental.userId === user?.id
      ? [200, envelope(rental)]
      : [403, errorBody(403, M.forbidden)];
  });
}
