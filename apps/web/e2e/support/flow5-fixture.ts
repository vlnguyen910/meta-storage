import type {
  ApiFacility,
  ApiFacilityAssignment,
  ApiUnitType,
  FacilityTaskDetail,
  FacilityTaskReportDetail,
  StorageUnitListItem,
} from "@metastorage/contracts";
import type { Page } from "@playwright/test";

export const f5id = (n: number) => `93000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const f5now = "2026-10-23T03:00:00.000Z";
export const f5facility = f5id(1);
export const f5type = f5id(2);
export const f5staff = f5id(3);
export const f5staff2 = f5id(4);
export const f5manager = f5id(5);

// Contract-driven UI fixture only. Live PostgreSQL persistence is verified separately.
export function flow5Fixture() {
  return {
    facilities: [
      {
        id: f5facility,
        code: "HCM-TEST",
        name: "Cơ sở kiểm thử Flow 5",
        address: "Địa chỉ kiểm thử",
        description: null,
        isActive: true,
        createdAt: f5now,
        updatedAt: f5now,
      },
    ] as ApiFacility[],
    types: [
      {
        id: f5type,
        code: "TYPE-TEST",
        name: "Kho kiểm thử",
        sizeLabel: "4 m²",
        lengthM: 2,
        widthM: 2,
        heightM: 2,
        sizeCbm: 8,
        monthlyPrice: 1000000,
        isActive: true,
        createdAt: f5now,
        updatedAt: f5now,
      },
    ] as ApiUnitType[],
    units: [
      {
        id: f5id(6),
        facilityId: f5facility,
        unitTypeId: f5type,
        code: "HCM-TEST-01",
        floor: "1",
        locationDescription: null,
        status: "AVAILABLE",
        unitTypeName: "Kho kiểm thử",
        unitTypeSizeLabel: "4 m²",
        createdAt: f5now,
        updatedAt: f5now,
      },
    ] as StorageUnitListItem[],
    tasks: [
      {
        id: f5id(7),
        facilityId: f5facility,
        type: "INSPECT_UNIT",
        status: "ASSIGNED",
        title: "Kiểm tra kho được giao",
        description: "Kiểm tra tình trạng cửa kho",
        storageUnitId: f5id(6),
        bookingId: null,
        assignedStaffId: f5staff,
        assignedStaffName: "Nhân viên một",
        createdBy: f5manager,
        assignedBy: f5manager,
        assignerName: "Quản lý kiểm thử",
        version: 0,
        startedAt: null,
        completedBy: null,
        completedAt: null,
        assignedAt: f5now,
        createdAt: f5now,
        updatedAt: f5now,
      },
    ] as FacilityTaskDetail[],
    assignments: [
      {
        id: f5id(8),
        userId: f5staff,
        facilityId: f5facility,
        role: "FACILITY_STAFF",
        isActive: true,
        endedAt: null,
        assignedAt: f5now,
        userName: "Nhân viên một",
        userEmail: "staff1@example.test",
      },
    ] as ApiFacilityAssignment[],
    reports: [] as FacilityTaskReportDetail[],
    offerings: [
      {
        facilityId: f5facility,
        unitTypeId: f5type,
        isActive: true,
        code: "TYPE-TEST",
        name: "Kho kiểm thử",
        sizeLabel: "4 m²",
        monthlyPrice: 1000000,
      },
    ],
    writes: [] as Array<{ path: string; method: string; body: Record<string, unknown> }>,
    queries: [] as string[],
    maintenanceConflict: false,
    assignmentConflict: false,
    revokeConflict: false,
    inventoryError: false,
  };
}

export async function mockFlow5(
  page: Page,
  state: ReturnType<typeof flow5Fixture>,
  role = "FACILITY_MANAGER",
  actorId = f5manager,
) {
  const accounts = [
    {
      id: f5staff,
      name: "Nhân viên một",
      email: "staff1@example.test",
      role: "FACILITY_STAFF",
      status: "ACTIVE",
    },
    {
      id: f5staff2,
      name: "Nhân viên hai",
      email: "staff2@example.test",
      role: "FACILITY_STAFF",
      status: "ACTIVE",
    },
    {
      id: f5manager,
      name: "Quản lý kiểm thử",
      email: "manager@example.test",
      role: "FACILITY_MANAGER",
      status: "ACTIVE",
    },
  ];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    const method = request.method();
    const input = method === "GET" ? {} : (request.postDataJSON() ?? {});
    if (method !== "GET") state.writes.push({ path, method, body: input });
    state.queries.push(`${method} ${path}${url.search}`);
    let status = method === "POST" ? 201 : 200;
    let data: unknown;
    const fail = (message: string, code = 409) =>
      route.fulfill({
        status: code,
        json: { success: false, error: { code, message }, timestamp: f5now },
      });
    const pageData = <T>(items: T[]) => {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
    };
    if (path === "/auth/me")
      data = {
        id: actorId,
        name: "Người kiểm thử",
        email: "actor@example.test",
        role,
        assignedFacilityId: f5facility,
        status: "ACTIVE",
        isActive: true,
      };
    else if (path === "/facilities/my-assignments")
      data = [
        {
          id: f5id(10),
          facilityId: f5facility,
          facilityName: "Cơ sở kiểm thử Flow 5",
          facilityCode: "HCM-TEST",
          userId: actorId,
          role,
          isActive: true,
          endedAt: null,
          assignedAt: f5now,
        },
      ];
    else if (
      path === "/bookings/assigned-to-me" ||
      /^\/facilities\/[^/]+\/return-requests$/.test(path)
    )
      data = [];
    else if (path === "/facilities/management") data = state.facilities;
    else if (path === "/facilities" && method === "POST") {
      const row = { ...state.facilities[0], ...input, id: f5id(30) } as ApiFacility;
      state.facilities.push(row);
      data = row;
    } else if (path.match(/^\/facilities\/[^/]+$/)) {
      const row = state.facilities.find((item) => item.id === path.split("/").at(-1));
      if (!row) return fail("Không tìm thấy cơ sở", 404);
      if (method === "PATCH") Object.assign(row, input);
      data = row;
    } else if (path.endsWith("/staff"))
      data = accounts
        .filter((item) => item.role === "FACILITY_STAFF")
        .map((item) => ({ ...item, isActive: true }));
    else if (path === "/users") data = accounts;
    else if (path.endsWith("/unit-types/management")) data = state.offerings;
    else if (path.match(/^\/facilities\/[^/]+\/unit-types\/[^/]+$/)) {
      const unitTypeId = path.split("/").at(-1) ?? "";
      let offering = state.offerings.find((row) => row.unitTypeId === unitTypeId);
      if (!offering) {
        offering = { ...state.offerings[0], unitTypeId } as (typeof state.offerings)[number];
        state.offerings.push(offering);
      }
      Object.assign(offering, input);
      data = offering;
    } else if (path.startsWith("/facilities/") && path.endsWith("/unit-types"))
      data = state.types.filter((item) => item.isActive);
    else if (path === "/unit-types") {
      if (method === "POST") {
        const type = { ...state.types[0], ...input, id: f5id(31) } as ApiUnitType;
        state.types.push(type);
        data = type;
      } else data = state.types;
    } else if (path.startsWith("/unit-types/")) {
      const row = state.types.find((item) => item.id === path.split("/").at(-1));
      if (row) Object.assign(row, input);
      data = row;
    } else if (path.endsWith("/assignments")) {
      if (method === "POST") {
        const user = accounts.find((item) => item.id === input.userId);
        const row = {
          id: f5id(32),
          userId: String(input.userId),
          role: input.role,
          facilityId: f5facility,
          isActive: true,
          userName: user?.name,
          userEmail: user?.email,
          assignedAt: f5now,
          endedAt: null,
        } as ApiFacilityAssignment;
        state.assignments.push(row);
        data = row;
      } else data = state.assignments;
    } else if (path.includes("/assignments/") && method === "DELETE") {
      if (state.revokeConflict) return fail("Nhân viên vẫn còn công việc được giao");
      const row = state.assignments.find((item) => item.userId === path.split("/").at(-1));
      if (row) row.isActive = false;
      data = row;
    } else if (path.endsWith("/storage-units") && method === "POST") {
      const unit = {
        ...state.units[0],
        ...input,
        id: f5id(33),
        facilityId: f5facility,
      } as StorageUnitListItem;
      state.units.push(unit);
      data = unit;
    } else if (path === "/storage-units") {
      if (state.inventoryError) return fail("Không thể tải danh sách kho", 503);
      data = pageData(
        state.units.filter(
          (item) =>
            (!url.searchParams.get("status") || item.status === url.searchParams.get("status")) &&
            (!url.searchParams.get("unitTypeId") ||
              item.unitTypeId === url.searchParams.get("unitTypeId")),
        ),
      );
    } else if (path.match(/^\/storage-units\/[^/]+\/transitions$/)) {
      if (state.maintenanceConflict) return fail("Ô kho đang có booking còn hiệu lực");
      const unit = state.units.find((item) => item.id === path.split("/")[2]);
      if (!unit) return fail("Không tìm thấy ô kho", 404);
      unit.status = input.action === "ENTER_MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE";
      data = unit;
    } else if (path.startsWith("/storage-units/")) {
      const unit = state.units.find((item) => item.id === path.split("/").at(-1));
      if (unit && method === "PATCH") Object.assign(unit, input);
      data = unit;
    } else if (path === "/facility-tasks") {
      if (method === "POST") {
        const task = {
          ...state.tasks[0],
          ...input,
          id: f5id(34),
          storageUnitId: input.storageUnitId ?? null,
          bookingId: input.bookingId ?? null,
        } as FacilityTaskDetail;
        state.tasks.unshift(task);
        data = task;
      } else
        data = pageData(
          state.tasks.filter(
            (row) =>
              (role !== "FACILITY_STAFF" || row.assignedStaffId === actorId) &&
              (!url.searchParams.get("assignedStaffId") ||
                row.assignedStaffId === url.searchParams.get("assignedStaffId")) &&
              (!url.searchParams.get("type") || row.type === url.searchParams.get("type")),
          ),
        );
    } else if (path.match(/^\/facility-tasks\/[^/]+\/reports$/)) {
      const taskId = path.split("/")[2] ?? "";
      if (method === "POST") {
        const report = {
          id: f5id(50 + state.reports.length),
          taskId,
          submittedBy: actorId,
          submitterName: "Nhân viên một",
          content: String(input.content),
          submittedAt: f5now,
          acceptedBy: null,
          acceptedByName: null,
          acceptedAt: null,
        };
        state.reports.unshift(report);
        const task = state.tasks.find((item) => item.id === taskId);
        if (task) task.status = "AWAITING_APPROVAL";
        data = report;
      } else data = pageData(state.reports.filter((row) => row.taskId === taskId));
    } else if (path.match(/^\/facility-tasks\/[^/]+\/start$/)) {
      status = 200;
      const task = state.tasks.find((item) => item.id === path.split("/")[2]);
      if (!task) return fail("Không tìm thấy công việc", 404);
      task.status = "IN_PROGRESS";
      task.startedAt = f5now;
      data = task;
    } else if (path.match(/^\/facility-tasks\/[^/]+\/reports\/[^/]+\/accept$/)) {
      status = 200;
      const [, , taskId, , reportId] = path.split("/");
      const task = state.tasks.find((item) => item.id === taskId);
      const report = state.reports.find((item) => item.id === reportId && item.taskId === taskId);
      if (!task || !report) return fail("Không tìm thấy báo cáo của công việc", 404);
      task.status = "COMPLETED";
      task.completedBy = actorId;
      task.completedAt = f5now;
      report.acceptedBy = actorId;
      report.acceptedByName = "Quản lý kiểm thử";
      report.acceptedAt = f5now;
      data = task;
    } else if (path.match(/^\/facility-tasks\/[^/]+\/assign$/)) {
      const task = state.tasks.find((item) => item.id === path.split("/")[2]);
      if (!task) return fail("Không tìm thấy công việc", 404);
      if (state.assignmentConflict) {
        state.assignmentConflict = false;
        task.version++;
        return fail("Phân công đã thay đổi, vui lòng tải lại");
      }
      if (input.version !== task.version) return fail("Phiên bản cũ");
      task.assignedStaffId = String(input.assignedStaffId);
      task.assignedStaffName =
        accounts.find((item) => item.id === input.assignedStaffId)?.name ?? "";
      task.version++;
      data = task;
    } else if (path.startsWith("/facility-tasks/")) {
      const task = state.tasks.find((item) => item.id === path.split("/").at(-1));
      if (role === "FACILITY_STAFF" && task?.assignedStaffId !== actorId)
        return fail("Bạn không còn được giao công việc này", 403);
      data = task;
    } else {
      status = 404;
      data = null;
    }
    return route.fulfill({ status, json: { success: status < 400, data, timestamp: f5now } });
  });
}
