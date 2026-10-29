import { UserRole } from "@metastorage/database/schema/user-enums";
import type MockAdapter from "axios-mock-adapter";
import { dashboardFor } from "../core/dashboard-data";
import { currentUser, envelope, errorBody } from "../core/http";
import { getMockDatabase } from "../database";

export function registerDashboardHandlers(mock: MockAdapter): void {
  mock.onGet(/\/dashboards\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];
    const requestedRole = decodeURIComponent(config.url?.split("/")[2] ?? "") as UserRole;
    if (requestedRole !== user.role || user.role === UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(403, "Dashboard không thuộc phạm vi của bạn")];
    }
    const facilityId = config.params?.facilityId as string | undefined;
    if (
      user.role === UserRole.FACILITY_MANAGER &&
      facilityId &&
      !user.assignedFacilityIds.includes(facilityId)
    ) {
      return [403, errorBody(403, "Cơ sở không thuộc quyền quản lý của bạn")];
    }
    return [200, envelope(dashboardFor(user, database, facilityId))];
  });
}
