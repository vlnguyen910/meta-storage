import { describe, expect, test } from "bun:test";
import type { BookingListItem, FacilityTaskDetail } from "@metastorage/contracts";
import type { StaffSelection, StaffWorkFilters } from "../src/features/staff-api/staff-api.types";
import { filterStaffWork } from "../src/features/staff-api/staff-work.helpers";

const filters: StaffWorkFilters = { group: "pending", kind: "all", date: "2026-10-29", search: "" };
function booking(
  id: string,
  status = "CONFIRMED",
  time = "2026-10-29T01:00:00Z",
  stage = "WAITING_CUSTOMER",
): StaffSelection {
  return {
    kind: "booking",
    booking: {
      id,
      status,
      handoverStage: stage,
      bookingCode: `BK-${id}`,
      contactName: "Nguyễn Minh Anh",
      checkInSlotStart: time,
      assignedUnit: { physicalUnitCode: "HCM-02-4M-001" },
    } as BookingListItem,
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
        booking("pending"),
        booking("done", "CHECKED_IN"),
        booking("closed", "CANCELLED"),
        booking("tomorrow", "CONFIRMED", "2026-10-30T01:00:00Z"),
      ],
      filters,
    );
    expect(result.counts).toEqual({ pending: 1, done: 1, closed: 1 });
    expect(result.items.map((x) => (x.kind === "booking" ? x.booking.id : ""))).toEqual([
      "pending",
    ]);
  });
  test("keeps unscheduled facility tasks when a workday is selected", () => {
    const result = filterStaffWork(
      [task("unscheduled"), booking("tomorrow", "CONFIRMED", "2026-10-30T01:00:00Z")],
      filters,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("task");
  });
  test("prioritizes work in progress and then upcoming appointment times without mutating input", () => {
    const source = [
      booking("late", "CONFIRMED", "2026-10-29T03:00:00Z"),
      task("unscheduled"),
      booking("early"),
      booking("working", "CONFIRMED", "2026-10-29T05:00:00Z", "INSPECTING"),
    ];
    const result = filterStaffWork(source, filters);
    expect(
      result.items.map((x) =>
        x.kind === "booking" ? x.booking.id : x.kind === "task" ? x.task.id : "",
      ),
    ).toEqual(["working", "early", "late", "unscheduled"]);
    expect(source[0]).toBe(result.items[2]);
  });
  test("supports removing the date chip and filters by task type", () => {
    const source = [
      booking("today"),
      booking("tomorrow", "CONFIRMED", "2026-10-30T01:00:00Z"),
      task("inspection"),
    ];
    expect(filterStaffWork(source, { ...filters, date: "", kind: "booking" }).items).toHaveLength(
      2,
    );
    expect(filterStaffWork(source, { ...filters, kind: "task" }).counts).toEqual({
      pending: 1,
      done: 0,
      closed: 0,
    });
  });
  test("searches customer names, booking codes and units with trimmed case-insensitive text", () => {
    const source = [booking("001"), task("inspection")];
    for (const search of ["  NGUYỄN MINH ANH  ", "bk-001", "hcm-02-4m-001"]) {
      expect(filterStaffWork(source, { ...filters, search }).items[0]).toBe(source[0]);
      expect(filterStaffWork(source, { ...filters, search }).items).toHaveLength(1);
    }
  });
  test("shows completed and cancelled work only in their respective groups", () => {
    const source = [
      booking("no-show", "NO_SHOW"),
      task("done", "COMPLETED"),
      task("working", "IN_PROGRESS"),
    ];
    expect(filterStaffWork(source, { ...filters, group: "closed" }).items).toEqual([source[0]]);
    expect(filterStaffWork(source, { ...filters, group: "done" }).items).toEqual([source[1]]);
    expect(filterStaffWork(source, filters).items).toEqual([source[2]]);
  });
});
