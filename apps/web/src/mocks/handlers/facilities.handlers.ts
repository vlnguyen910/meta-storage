import {
  type CatalogFacility,
  type Facility,
  type FacilityStaffMember,
  type PaginatedResult,
  UserRole,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, optionsForUnits } from "../core/http";
import { getMockDatabase, hydrateFacility } from "../database";

export function registerFacilityHandlers(mock: MockAdapter): void {
  // GET /facilities/:facilityId/staff
  mock.onGet(/\/facilities\/[^/]+\/staff/).reply((config) => {
    const database = getMockDatabase();
    const match = config.url?.match(/\/facilities\/([^/?]+)\/staff/);
    const facilityId = match?.[1];

    const staffList: FacilityStaffMember[] = database.users
      .filter(
        (u) =>
          u.role === UserRole.FACILITY_STAFF &&
          (!facilityId || facilityId === "all" || u.assignedFacilityIds.includes(facilityId)),
      )
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        role: UserRole.FACILITY_STAFF,
        isActive: true,
      }));

    return [200, envelope(staffList)];
  });

  mock.onGet("/catalog/facilities").reply((config) => {
    const database = getMockDatabase();
    const search = String(config.params?.search ?? "")
      .trim()
      .toLowerCase();
    const city = String(config.params?.city ?? "")
      .trim()
      .toLowerCase();
    const page = Math.max(1, Number(config.params?.page ?? 1));
    const pageSize = Math.max(1, Number(config.params?.pageSize ?? 6));
    const sort = String(config.params?.sort ?? "name");
    const facilities = database.facilities
      .map((facility) => hydrateFacility(database, facility))
      .filter(
        (facility) =>
          facility.availableUnits > 0 &&
          (!search ||
            `${facility.name} ${facility.address.line1} ${facility.address.city}`
              .toLowerCase()
              .includes(search)) &&
          (!city || facility.address.city.toLowerCase().includes(city)),
      )
      .map(toCatalogFacility);
    facilities.sort((a, b) =>
      sort === "price"
        ? a.startingMonthlyPrice - b.startingMonthlyPrice
        : sort === "availability"
          ? b.availableUnits - a.availableUnits
          : a.name.localeCompare(b.name, "vi"),
    );
    const total = facilities.length;
    return [
      200,
      envelope({
        items: facilities.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      } satisfies PaginatedResult<CatalogFacility>),
    ];
  });

  mock.onGet(/\/catalog\/facilities\/[^/]+\/unit-types$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[3] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility && hydrateFacility(database, facility).availableUnits > 0
      ? [
          200,
          envelope(
            optionsForUnits(database.units.filter((unit) => unit.facilityId === facilityId)),
          ),
        ]
      : [404, errorBody(404, "Không tìm thấy facility")];
  });

  mock.onGet(/\/catalog\/facilities\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[3] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility && hydrateFacility(database, facility).availableUnits > 0
      ? [200, envelope(toCatalogFacility(hydrateFacility(database, facility)))]
      : [404, errorBody(404, "Không tìm thấy facility khả dụng")];
  });

  mock.onGet("/facilities").reply((config) => {
    const database = getMockDatabase();
    const search = String(config.params?.search ?? "")
      .trim()
      .toLowerCase();
    const city = String(config.params?.city ?? "");
    const page = Math.max(1, Number(config.params?.page ?? 1));
    const pageSize = Math.max(1, Number(config.params?.pageSize ?? 6));
    const sort = String(config.params?.sort ?? "name");
    let facilities = database.facilities.map((facility) => hydrateFacility(database, facility));
    facilities = facilities.filter(
      (facility) =>
        (!search || `${facility.name} ${facility.address.city}`.toLowerCase().includes(search)) &&
        (!city || facility.address.city === city),
    );
    facilities.sort((a, b) =>
      sort === "price"
        ? a.startingMonthlyPrice - b.startingMonthlyPrice
        : sort === "availability"
          ? b.availableUnits - a.availableUnits
          : a.name.localeCompare(b.name, "vi"),
    );
    const total = facilities.length;
    const result: PaginatedResult<Facility> = {
      items: facilities.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
    return [200, envelope(result)];
  });

  mock.onGet("/facilities/my-assignments").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];

    const assignments = user.assignedFacilityIds.map((facilityId) => {
      const facility = database.facilities.find((f) => f.id === facilityId);
      return {
        id: `assign-${user.id}-${facilityId}`,
        facilityId,
        userId: user.id,
        role: user.role,
        isActive: true,
        assignedAt: new Date(0).toISOString(),
        facilityName: facility?.name ?? facilityId,
        facilityCode: facility?.code ?? facilityId,
        userName: user.name,
        userEmail: user.email,
      };
    });
    return [200, envelope(assignments)];
  });

  mock.onGet(/\/facilities\/[^/]+\/assignments$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(401, "Vui lòng đăng nhập")];
    const facilityId = config.url?.split("/")[2] ?? "";
    if (user.role === UserRole.FACILITY_MANAGER && !user.assignedFacilityIds.includes(facilityId)) {
      return [403, errorBody(403, "Không có quyền truy cập cơ sở này")];
    }
    const matchingUsers = database.users.filter((u) => u.assignedFacilityIds.includes(facilityId));
    const assignments = matchingUsers.map((u) => ({
      id: `assign-${u.id}-${facilityId}`,
      facilityId,
      userId: u.id,
      role: u.role,
      isActive: true,
      assignedAt: new Date(0).toISOString(),
      userName: u.name,
      userEmail: u.email,
    }));
    return [200, envelope(assignments)];
  });

  mock.onGet(/\/facilities\/[^/]+\/availability$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[2] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility
      ? [
          200,
          envelope(
            optionsForUnits(database.units.filter((unit) => unit.facilityId === facilityId)),
          ),
        ]
      : [404, errorBody(404, "Không tìm thấy cơ sở")];
  });

  mock.onGet(/\/facilities\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[2] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility
      ? [200, envelope(hydrateFacility(database, facility))]
      : [404, errorBody(404, "Không tìm thấy cơ sở")];
  });
}

function toCatalogFacility(facility: Facility): CatalogFacility {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    address: `${facility.address.line1}, ${facility.address.district}, ${facility.address.city}`,
    description: facility.description,
    availableUnits: facility.availableUnits,
    totalUnits: facility.totalUnits,
    startingMonthlyPrice: facility.startingMonthlyPrice,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}
