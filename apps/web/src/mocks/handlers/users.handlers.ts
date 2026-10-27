import { UserRole, type UserStatus } from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, parseBody, publicUser } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import { USER_MOCK_MESSAGES as M } from "./users.messages";

export function registerUsersHandlers(mock: MockAdapter): void {
  mock.onGet("/users").reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, M.loginRequired)];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) {
      return [403, errorBody(403, M.forbidden)];
    }
    const limit = Number(config.params?.limit ?? 100);
    const offset = Number(config.params?.offset ?? 0);
    return [200, envelope(database.users.slice(offset, offset + limit).map(publicUser))];
  });

  mock.onGet("/users/customer-registrations").reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, M.loginRequired)];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) return [403, errorBody(403, M.forbidden)];
    const year = Number(config.params?.year ?? new Date().getUTCFullYear());
    const customers = database.users.filter((user) => user.role === UserRole.STORAGE_CUSTOMER);
    const years = [
      ...new Set([
        new Date().getUTCFullYear(),
        year,
        ...customers.map((user) => Number(user.createdAt.slice(0, 4))),
      ]),
    ].sort((a, b) => b - a);
    const items = Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      return {
        month,
        count: customers.filter((user) => user.createdAt.slice(0, 7) === month).length,
      };
    });
    const summary = {
      totalUsers: database.users.length,
      activeUsers: database.users.filter((user) => user.status === "ACTIVE").length,
      inactiveUsers: database.users.filter((user) => user.status === "INACTIVE").length,
      unassignedFacilityUsers: database.users.filter(
        (user) =>
          (user.role === UserRole.FACILITY_STAFF || user.role === UserRole.FACILITY_MANAGER) &&
          !user.assignedFacilityIds.length,
      ).length,
    };
    return [200, envelope({ year, years, items, summary })];
  });

  mock.onGet(/\/users\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, M.loginRequired)];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) return [403, errorBody(403, M.forbidden)];
    const userId = config.url?.split("/").at(-1);
    const target = database.users.find((user) => user.id === userId);
    if (!target) return [404, errorBody(404, M.userNotFound)];
    return [200, envelope(publicUser(target))];
  });

  mock.onPatch(/\/users\/[^/]+\/role$/).reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, M.loginRequired)];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) {
      return [403, errorBody(403, M.forbidden)];
    }

    const userId = config.url?.split("/").at(-2);
    const target = database.users.find((user) => user.id === userId);
    if (!target) return [404, errorBody(404, M.userNotFound)];

    const { role } = parseBody<{ role: UserRole }>(config.data);
    if (role === UserRole.STORAGE_CUSTOMER) return [403, errorBody(403, M.customerRoleForbidden)];
    if (role === UserRole.SYSTEM_ADMINISTRATOR && target.role !== UserRole.SYSTEM_ADMINISTRATOR)
      return [403, errorBody(403, M.adminCreationForbidden)];
    if (target.role === UserRole.SYSTEM_ADMINISTRATOR && role !== target.role)
      return [403, errorBody(403, M.adminProtected)];
    if (target.role !== role) target.assignedFacilityIds = [];
    target.role = role;
    saveMockDatabase(database);
    return [200, envelope(publicUser(target), M.roleUpdated)];
  });

  mock.onPatch(/\/users\/[^/]+\/status$/).reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, M.loginRequired)];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) return [403, errorBody(403, M.forbidden)];
    const userId = config.url?.split("/").at(-2);
    const target = database.users.find((user) => user.id === userId);
    if (!target) return [404, errorBody(404, M.userNotFound)];
    const { status } = parseBody<{ status: UserStatus }>(config.data);
    if (target.role === UserRole.SYSTEM_ADMINISTRATOR && status === "INACTIVE")
      return [403, errorBody(403, M.adminProtected)];
    target.status = status;
    if (status === "INACTIVE") target.assignedFacilityIds = [];
    saveMockDatabase(database);
    return [200, envelope(publicUser(target), M.statusUpdated)];
  });
}
