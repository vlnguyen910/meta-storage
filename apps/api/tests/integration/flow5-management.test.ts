import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilityTasks,
  inArray,
  queryClient,
  rentals,
  storageUnitMaintenanceHistory,
  unitAssignments,
  unitTypes,
} from "@metastorage/database";
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { facilityTasksRoutes } from "../../src/modules/facility-tasks/facility-tasks.routes";
import { storageUnitsRoutes } from "../../src/modules/storage-units/storage-units.routes";
import { unitTypesRoutes } from "../../src/modules/unit-types/unit-types.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Flow 5 management APIs", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const createdUnitTypeIds: string[] = [];
  const allocationId = randomUUID();
  const maintenanceSlotId = randomUUID();
  const assignedBookingId = randomUUID();
  const rentedBookingId = randomUUID();
  const rentalId = randomUUID();

  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await f.app.register(facilitiesRoutes, { prefix: "/api/facilities" });
    await f.app.register(facilityTasksRoutes, { prefix: "/api/facility-tasks" });
    await f.app.register(storageUnitsRoutes, { prefix: "/api/storage-units" });
    await f.app.register(unitTypesRoutes, { prefix: "/api/unit-types" });
    await f.login();
  });

  afterAll(async () => {
    try {
      if (f) {
        await db.delete(unitAssignments).where(eq(unitAssignments.bookingId, assignedBookingId));
        await db.delete(rentals).where(eq(rentals.id, rentalId));
        await db.delete(bookings).where(inArray(bookings.id, [assignedBookingId, rentedBookingId]));
        await db.delete(checkInSlots).where(eq(checkInSlots.id, maintenanceSlotId));
        await db.delete(facilityTasks).where(eq(facilityTasks.facilityId, f.facilityId));
        await db.delete(capacityAllocations).where(eq(capacityAllocations.id, allocationId));
        await db
          .delete(storageUnitMaintenanceHistory)
          .where(eq(storageUnitMaintenanceHistory.storageUnitId, f.unitId));
        await f.cleanup();
        if (createdUnitTypeIds.length > 0) {
          await db.delete(unitTypes).where(inArray(unitTypes.id, createdUnitTypeIds));
        }
      }
    } finally {
      await queryClient.end();
    }
  });

  test("facility details are scoped, while management changes require Admin or BOM", async () => {
    expect((await f.api(null, "GET", `/facilities/${f.facilityId}`)).statusCode).toBe(401);
    expect((await f.api("manager", "GET", `/facilities/${f.facilityId}`)).statusCode).toBe(200);
    expect((await f.api("manager", "GET", `/facilities/${f.otherFacilityId}`)).statusCode).toBe(
      403,
    );
    expect((await f.api("customer", "GET", `/facilities/${f.facilityId}`)).statusCode).toBe(403);

    const publicList = await f.api(null, "GET", "/facilities");
    expect(publicList.statusCode).toBe(200);
    expect((await f.api("manager", "GET", "/facilities/management")).statusCode).toBe(403);
    const management = await f.api("admin", "GET", "/facilities/management?isActive=true");
    expect(management.statusCode).toBe(200);
    expect(management.json().data.some((item: { id: string }) => item.id === f.facilityId)).toBe(
      true,
    );

    expect(
      (await f.api("manager", "PATCH", `/facilities/${f.facilityId}`, { name: "Denied" }))
        .statusCode,
    ).toBe(403);
    const holdId = randomUUID();
    await db.insert(capacityAllocations).values({
      id: allocationId,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      referenceId: holdId,
      kind: "HOLD",
      status: "ACTIVE",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const blocked = await f.api("admin", "PATCH", `/facilities/${f.facilityId}`, {
      isActive: false,
    });
    expect(blocked.statusCode).toBe(409);
    await db.delete(capacityAllocations).where(eq(capacityAllocations.id, allocationId));
    const updated = await f.api("bom", "PATCH", `/facilities/${f.facilityId}`, {
      name: "Flow 5 updated",
      isActive: false,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({ name: "Flow 5 updated", isActive: false });
    expect(
      (await f.api("bom", "PATCH", `/facilities/${f.facilityId}`, { isActive: true })).statusCode,
    ).toBe(200);
  });

  test("Admin and BOM manage shared unit types and facility offerings; prices are not editable here", async () => {
    const create = await f.api("admin", "POST", "/unit-types", {
      code: `FLOW5-${randomUUID()}`,
      name: "Flow 5 managed type",
      sizeLabel: "6 m²",
      lengthM: 2,
      widthM: 3,
      heightM: 2.5,
      monthlyPrice: 1500000,
    });
    expect(create.statusCode).toBe(201);
    const typeId = create.json().data.id as string;
    createdUnitTypeIds.push(typeId);
    expect(create.json().data.sizeCbm).toBe(15);
    expect((await f.api("manager", "GET", "/unit-types")).statusCode).toBe(403);
    expect(
      (await f.api("admin", "PATCH", `/unit-types/${typeId}`, { monthlyPrice: 2 })).statusCode,
    ).toBe(400);
    const updated = await f.api("bom", "PATCH", `/unit-types/${typeId}`, { name: "Updated type" });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({ name: "Updated type", monthlyPrice: 1500000 });

    expect(
      (
        await f.api("manager", "POST", `/facilities/${f.facilityId}/storage-units`, {
          unitTypeId: typeId,
          code: `FLOW5-${randomUUID()}`,
        })
      ).statusCode,
    ).toBe(404);
    const offering = await f.api(
      "admin",
      "PATCH",
      `/facilities/${f.facilityId}/unit-types/${typeId}`,
      { isActive: true },
    );
    expect(offering.statusCode).toBe(200);
    expect(offering.json().data.isActive).toBe(true);
    expect(
      (await f.api("admin", "GET", `/facilities/${f.facilityId}/unit-types/management`))
        .json()
        .data.some((item: { unitTypeId: string }) => item.unitTypeId === typeId),
    ).toBe(true);

    const createdUnit = await f.api(
      "manager",
      "POST",
      `/facilities/${f.facilityId}/storage-units`,
      {
        unitTypeId: typeId,
        code: `FLOW5-${randomUUID()}`,
        floor: "3",
        locationDescription: "Quầy phía đông",
      },
    );
    expect(createdUnit.statusCode).toBe(201);
    const unitId = createdUnit.json().data.id as string;
    const patchedUnit = await f.api("manager", "PATCH", `/storage-units/${unitId}`, {
      locationDescription: "Quầy phía tây",
    });
    expect(patchedUnit.statusCode).toBe(200);
    expect(patchedUnit.json().data.locationDescription).toBe("Quầy phía tây");
    expect(
      (await f.api("otherManager", "PATCH", `/storage-units/${unitId}`, { floor: "4" })).statusCode,
    ).toBe(403);
    expect(
      (await f.api("manager", "PATCH", `/storage-units/${unitId}`, { status: "MAINTENANCE" }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await f.api("admin", "PATCH", `/facilities/${f.facilityId}/unit-types/${typeId}`, {
          isActive: false,
        })
      ).statusCode,
    ).toBe(200);
    const deactivatedType = await f.api("admin", "PATCH", `/unit-types/${typeId}`, {
      isActive: false,
    });
    expect(deactivatedType.statusCode).toBe(200);
    expect(deactivatedType.json().data.isActive).toBe(false);
  });

  test("FM directly enters and exits maintenance, and history records actor and reason", async () => {
    expect(
      (
        await f.api("manager", "POST", `/storage-units/${f.unitId}/transitions`, {
          action: "ENTER_MAINTENANCE",
          reason: "Kiểm tra hệ thống cửa cuốn",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await f.api("staff", "POST", `/storage-units/${f.unitId}/transitions`, {
          action: "EXIT_MAINTENANCE",
        })
      ).statusCode,
    ).toBe(403);
    const history = await f.api("manager", "GET", `/storage-units/${f.unitId}/maintenance-history`);
    expect(history.statusCode).toBe(200);
    expect(history.json().data.items[0]).toMatchObject({
      action: "ENTER_MAINTENANCE",
      previousStatus: "AVAILABLE",
      nextStatus: "MAINTENANCE",
      reason: "Kiểm tra hệ thống cửa cuốn",
      changedBy: f.ids.manager,
      changedByName: "manager",
    });
    expect(
      (await f.api("staff", "GET", `/storage-units/${f.unitId}/maintenance-history`)).statusCode,
    ).toBe(403);
    expect(
      (
        await f.api("manager", "POST", `/storage-units/${f.unitId}/transitions`, {
          action: "EXIT_MAINTENANCE",
        })
      ).statusCode,
    ).toBe(200);
    const finalHistory = await f.api(
      "bom",
      "GET",
      `/storage-units/${f.unitId}/maintenance-history`,
    );
    expect(
      finalHistory
        .json()
        .data.items.map((item: { action: string }) => item.action)
        .sort(),
    ).toEqual(["ENTER_MAINTENANCE", "EXIT_MAINTENANCE"]);

    await db.insert(checkInSlots).values({
      id: maintenanceSlotId,
      name: "Maintenance guard",
      startTime: "09:00",
      endTime: "10:00",
    });
    const makeBooking = (id: string, status: "CONFIRMED" | "CHECKED_IN") => ({
      id,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      requestedMonths: 1,
      checkInDate: "2035-01-01",
      checkInSlotId: maintenanceSlotId,
      rentalEndAt: new Date("2035-02-01T00:00:00.000Z"),
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      status,
      contactName: "Test renter",
      contactEmail: "renter@example.test",
      contactPhone: "0900000000",
    });
    await db.insert(bookings).values(makeBooking(assignedBookingId, "CONFIRMED"));
    await db.insert(unitAssignments).values({
      bookingId: assignedBookingId,
      physicalUnitId: f.unitId,
      assignedBy: f.ids.manager,
      status: "ACTIVE",
    });
    expect(
      (
        await f.api("manager", "POST", `/storage-units/${f.unitId}/transitions`, {
          action: "ENTER_MAINTENANCE",
          reason: "Có lịch nhận kho sắp tới",
        })
      ).statusCode,
    ).toBe(409);
    await db.delete(unitAssignments).where(eq(unitAssignments.bookingId, assignedBookingId));
    await db.delete(bookings).where(eq(bookings.id, assignedBookingId));

    await db.insert(bookings).values(makeBooking(rentedBookingId, "CHECKED_IN"));
    await db.insert(rentals).values({
      id: rentalId,
      bookingId: rentedBookingId,
      facilityId: f.facilityId,
      physicalUnitId: f.unitId,
      startAt: new Date("2035-01-01T00:00:00.000Z"),
      expectedEndAt: new Date("2035-02-01T00:00:00.000Z"),
      depositAmount: "1000000",
    });
    expect(
      (
        await f.api("manager", "POST", `/storage-units/${f.unitId}/transitions`, {
          action: "ENTER_MAINTENANCE",
          reason: "Không được bảo trì khi đang thuê",
        })
      ).statusCode,
    ).toBe(409);
  });

  test("membership validation preserves history and blocks revocation until tasks are reassigned", async () => {
    expect(
      (await f.api("manager", "GET", `/facilities/${f.facilityId}/assignments`)).statusCode,
    ).toBe(403);
    const reactivated = await f.api("admin", "POST", `/facilities/${f.facilityId}/assignments`, {
      userId: f.ids.expiredStaff,
      role: "FACILITY_STAFF",
    });
    expect(reactivated.statusCode).toBe(201);
    expect(reactivated.json().data).toMatchObject({ isActive: true, endedAt: null });
    expect(
      (
        await f.api("admin", "POST", `/facilities/${f.facilityId}/assignments`, {
          userId: f.ids.inactiveStaff,
          role: "FACILITY_STAFF",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await f.api("admin", "POST", `/facilities/${f.facilityId}/assignments`, {
          userId: f.ids.otherStaff,
          role: "FACILITY_STAFF",
        })
      ).statusCode,
    ).toBe(409);

    const task = await f.api("manager", "POST", "/facility-tasks", {
      facilityId: f.facilityId,
      assignedStaffId: f.ids.staff,
      type: "INSPECT_UNIT",
      title: "Kiểm tra kho trước thu hồi tài khoản",
      storageUnitId: f.unitId,
    });
    expect(task.statusCode).toBe(201);
    const taskId = task.json().data.id as string;
    expect(
      (await f.api("admin", "DELETE", `/facilities/${f.facilityId}/assignments/${f.ids.staff}`))
        .statusCode,
    ).toBe(409);
    const reassigned = await f.api("manager", "POST", `/facility-tasks/${taskId}/assign`, {
      assignedStaffId: f.ids.peerStaff,
      version: 0,
    });
    expect(reassigned.statusCode).toBe(200);
    const revoked = await f.api(
      "admin",
      "DELETE",
      `/facilities/${f.facilityId}/assignments/${f.ids.staff}`,
    );
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().data).toMatchObject({ isActive: false });
  });
});
