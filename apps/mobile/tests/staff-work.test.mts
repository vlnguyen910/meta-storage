import { describe, expect, test } from "bun:test";
import type { AppointmentRecordDto, FacilityTaskDetail } from "@metastorage/contracts";
import type { StaffSelection, StaffWorkFilters } from "../src/features/staff-api/staff-api.types";
import { filterStaffWork } from "../src/features/staff-api/staff-work.helpers";

const filters: StaffWorkFilters = { group: "pending", kind: "all", date: "2026-10-29", search: "" };
function appointment(
  id: string,
  status = "SCHEDULED",
  time = "2026-10-29T01:00:00Z",
  stage = "WAITING_CUSTOMER",
): StaffSelection {
  return {
    kind: "appointment",
    appointment: {
      id,
      status,
      handoverStage: stage,
      scheduledDate: time.slice(0, 10),
      slotStart: `${String(new Date(time).getUTCHours() + 7).padStart(2, "0")}:00:00`,
      customerName: "Nguyễn Minh Anh",
      contactPhone: "0901234567",
      assignedUnit: { physicalUnitCode: "HCM-02-4M-001" },
    } as AppointmentRecordDto,
  };
}
function task(id: string, status = "ASSIGNED"): StaffSelection {
  return {
    kind: "task",
    task: {
      id,
      status,
      type: "UNIT_INSPECTION",
      description: "Kiểm tra cửa và khóa",
    } as FacilityTaskDetail,
  };
}
describe("Staff work presentation", () => {
  test("counts status groups within the same date, search and type filters", () => {
    const result = filterStaffWork(
      [
        appointment("pending"),
        appointment("done", "COMPLETED"),
        appointment("closed", "CANCELLED"),
        appointment("tomorrow", "SCHEDULED", "2026-10-30T01:00:00Z"),
      ],
      filters,
    );
    expect(result.counts).toEqual({ pending: 1, done: 1, closed: 1 });
    expect(result.items.map((x) => (x.kind === "appointment" ? x.appointment.id : ""))).toEqual([
      "pending",
    ]);
  });
  test("keeps unscheduled facility tasks when a workday is selected", () => {
    const result = filterStaffWork(
      [task("unscheduled"), appointment("tomorrow", "SCHEDULED", "2026-10-30T01:00:00Z")],
      filters,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("task");
  });
  test("prioritizes work in progress and then upcoming appointment times without mutating input", () => {
    const source = [
      appointment("late", "SCHEDULED", "2026-10-29T03:00:00Z"),
      task("unscheduled"),
      appointment("early"),
      appointment("working", "CONFIRMED", "2026-10-29T05:00:00Z", "INSPECTING"),
    ];
    const result = filterStaffWork(source, filters);
    expect(
      result.items.map((x) =>
        x.kind === "appointment" ? x.appointment.id : x.kind === "task" ? x.task.id : "",
      ),
    ).toEqual(["working", "early", "late", "unscheduled"]);
    expect(source[0]).toBe(result.items[2]);
  });
  test("supports removing the date chip and filters by task type", () => {
    const source = [
      appointment("today"),
      appointment("tomorrow", "SCHEDULED", "2026-10-30T01:00:00Z"),
      task("inspection"),
    ];
    expect(
      filterStaffWork(source, { ...filters, date: "", kind: "appointment" }).items,
    ).toHaveLength(2);
    expect(filterStaffWork(source, { ...filters, kind: "task" }).counts).toEqual({
      pending: 1,
      done: 0,
      closed: 0,
    });
  });
  test("searches customer names, appointment IDs and phones with trimmed case-insensitive text", () => {
    const source = [appointment("001"), task("inspection")];
    for (const search of ["  NGUYỄN MINH ANH  ", "001", "0901234567"]) {
      expect(filterStaffWork(source, { ...filters, search }).items[0]).toBe(source[0]);
      expect(filterStaffWork(source, { ...filters, search }).items).toHaveLength(1);
    }
  });
  test("shows completed and cancelled work only in their respective groups", () => {
    const source = [
      appointment("no-show", "NO_SHOW"),
      task("done", "COMPLETED"),
      task("working", "IN_PROGRESS"),
    ];
    expect(filterStaffWork(source, { ...filters, group: "closed" }).items).toEqual([source[0]]);
    expect(filterStaffWork(source, { ...filters, group: "done" }).items).toEqual([source[1]]);
    expect(filterStaffWork(source, filters).items).toEqual([source[2]]);
  });
});

test("staff can search the displayed reservation reference and unit without changing the selected ID", () => {
  const item = appointment("71000000-0000-4000-8000-000000000005");
  if (item.kind !== "appointment") throw new Error("Expected appointment fixture");
  item.appointment.reservationId = "81000000-0000-4000-8000-000000000005";
  for (const search of ["BK-8100-000005", "HCM-02-4M-001"]) {
    const result = filterStaffWork([item], { ...filters, search });
    expect(result.items).toEqual([item]);
    expect(result.items[0]?.kind === "appointment" && result.items[0].appointment.id).toBe(
      item.appointment.id,
    );
  }
});
