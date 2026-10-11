import { UserRole } from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, parseBody, publicUser } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";

export function registerUsersHandlers(mock: MockAdapter): void {
  mock.onGet("/users").reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, "Vui lòng đăng nhập")];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) {
      return [403, errorBody(403, "Bạn không có quyền thực hiện thao tác này")];
    }
    return [200, envelope(database.users.map(publicUser))];
  });

  mock.onPatch(/\/users\/[^/]+\/role$/).reply((config) => {
    const database = getMockDatabase();
    const actor = currentUser(config, database);
    if (!actor) return [401, errorBody(401, "Vui lòng đăng nhập")];
    if (actor.role !== UserRole.SYSTEM_ADMINISTRATOR) {
      return [403, errorBody(403, "Bạn không có quyền thực hiện thao tác này")];
    }

    const userId = config.url?.split("/").at(-2);
    const target = database.users.find((user) => user.id === userId);
    if (!target) return [404, errorBody(404, "Không tìm thấy người dùng")];

    const { role } = parseBody<{ role: UserRole }>(config.data);
    target.role = role;
    target.assignedFacilityIds = [];
    saveMockDatabase(database);
    return [200, envelope(publicUser(target), "Vai trò đã được cập nhật")];
  });
}
