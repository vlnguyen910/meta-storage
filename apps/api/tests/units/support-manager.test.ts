import { describe, expect, mock, test } from "bun:test";
import { FacilitySupportTicketSchema } from "@metastorage/contracts";
import type { SupportTicketRow } from "@metastorage/database";
import type { FacilitiesRepository } from "../../src/modules/facilities/facilities.repository";
import type { FacilityAssignmentsRepository } from "../../src/modules/facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../../src/modules/facilities/facility-assignments.service";
import type { SupportRepository } from "../../src/modules/support/support.repository";
import { SupportService } from "../../src/modules/support/support.service";

const facilityId = "30000000-0000-4000-8000-000000000002";
const ticketId = "40000000-0000-4000-8000-000000000001";
const row = {
  ticket: {
    id: ticketId,
    facilityId,
    ownerUserId: "50000000-0000-4000-8000-000000000001",
    reservationId: "60000000-0000-4000-8000-000000000001",
    bookingId: null,
    rentalId: null,
    paymentId: null,
    category: "PAYMENT",
    subject: "Payment issue",
    description: "Please check the payment.",
    idempotencyKey: "private-command-key",
    createdAt: new Date("2026-11-08T03:15:50.705Z"),
    actionDueAt: new Date("2026-11-08T15:15:50.705Z"),
  } satisfies SupportTicketRow,
  customer: { name: "Customer", email: "customer@example.test", phone: null },
  unitCode: null,
  storageUnitId: null,
  bookingCode: null,
};

function fixture(active = true) {
  const read = mock(async () => [row]);
  const assignments = new FacilityAssignmentsService(
    {
      findActiveAssignment: async (facility: string, actorId: string) =>
        active && facility === facilityId && actorId === "manager" ? {} : undefined,
    } as unknown as FacilityAssignmentsRepository,
    {} as FacilitiesRepository,
  );
  const service = new SupportService(
    { facilityList: read } as unknown as SupportRepository,
    assignments,
  );
  return { service, read };
}

describe("manager support reads", () => {
  test("rejects unassigned managers and inactive assignments before reading tickets", async () => {
    for (const active of [true, false]) {
      const { service, read } = fixture(active);
      const actor = active ? "unassigned-manager" : "manager";
      await expect(service.facilityList(actor, facilityId, { limit: 20 })).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(service.facilityDetail(actor, facilityId, ticketId)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(read).not.toHaveBeenCalled();
    }
  });
  test("keeps reads within the assigned facility and omits internal command keys", async () => {
    const { service, read } = fixture();
    const page = await service.facilityList("manager", facilityId, { limit: 20 });
    expect(read).toHaveBeenCalledWith(facilityId, { limit: 20 }, undefined);
    expect(FacilitySupportTicketSchema.safeParse(page.items[0]).success).toBe(true);
    expect(JSON.stringify(page)).not.toContain("private-command-key");
    expect(page.nextCursor).toBeNull();
    await expect(
      service.facilityList("manager", "foreign-facility", { limit: 20 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  test("scopes detail lookups to the facility and returns 404 for missing tickets", async () => {
    const { service, read } = fixture();
    await service.facilityDetail("manager", facilityId, ticketId);
    expect(read).toHaveBeenCalledWith(facilityId, { limit: 1 }, undefined, ticketId);
    read.mockResolvedValueOnce([]);
    await expect(service.facilityDetail("manager", facilityId, ticketId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
  test("rejects malformed cursors before issuing a database query", async () => {
    const { service, read } = fixture();
    await expect(
      service.facilityList("manager", facilityId, { limit: 1, cursor: "invalid" }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(read).not.toHaveBeenCalled();
  });
});
