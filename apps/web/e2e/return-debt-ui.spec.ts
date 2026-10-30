import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { f5staff, flow5Fixture, mockFlow5 } from "./support/flow5-fixture";

test("Staff can record debt receipts on desktop and narrow screens", async ({ page }, testInfo) => {
  await mockFlow5(page, flow5Fixture(), "FACILITY_STAFF", f5staff);
  await page.routeWebSocket("**/api/notifications/ws", () => {});
  const debt = {
    id: "93000000-0000-4000-8000-000000000099",
    rentalId: "rental",
    customerId: "customer",
    customerName: "Khách kiểm thử",
    unitCode: "HCM-01",
    originalAmount: "50000",
    paidAmount: "0",
    remainingAmount: "50000",
    status: "UNPAID",
    currency: "VND",
    createdAt: "2026-10-30T02:00:00Z",
    payments: [] as unknown[],
  };
  await page.route("**/api/debts**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      expect(input).toMatchObject({
        amount: 20000,
        method: "BANK_TRANSFER",
        reference: "TEST-TRANSFER",
      });
      expect(input.idempotencyKey).toBeTruthy();
      debt.paidAmount = "20000";
      debt.remainingAmount = "30000";
      debt.status = "PARTIALLY_PAID";
      debt.payments = [
        {
          id: "receipt",
          totalAmount: "20000",
          method: input.method,
          reference: input.reference,
          paidAt: debt.createdAt,
        },
      ];
    }
    await route.fulfill({
      json: {
        success: true,
        data:
          url.pathname === "/api/debts" ? { items: [debt], total: 1, limit: 10, offset: 0 } : debt,
      },
    });
  });
  await page.goto("/staff/tasks");
  await page.getByRole("button", { name: "Công nợ trả kho", exact: true }).click();
  await page.getByRole("button", { name: "Xem lịch sử / ghi nhận khoản thu" }).click();
  await page.getByLabel("Số tiền đã nhận (VND)").fill("20000");
  await page.getByLabel("Phương thức", { exact: true }).selectOption("BANK_TRANSFER");
  await page.getByLabel("Mã giao dịch", { exact: true }).fill("TEST-TRANSFER");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "Xác nhận đã nhận tiền" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`debt-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Xác nhận đã nhận tiền" }).click();
  await expect(page.getByText("Đã ghi nhận khoản thu.")).toBeVisible();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "Đã thanh toán một phần" }),
  ).toBeVisible();
});

for (const amount of [50000, 100000, 150000]) {
  test(`Staff completes a return with deductions ${amount}`, async ({ page }) => {
    const state = flow5Fixture();
    const task = state.tasks[0];
    if (!task) throw new Error("Missing task fixture");
    task.referenceType = "APPOINTMENT";
    task.status = "IN_PROGRESS";
    await mockFlow5(page, state, "FACILITY_STAFF", f5staff);
    await page.routeWebSocket("**/api/notifications/ws", () => {});
    await page.route("**/api/facility-tasks/my*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { items: state.tasks, total: state.tasks.length, limit: 100, offset: 0 },
        },
      }),
    );
    await page.route(`**/api/appointments/${task.referenceId}`, (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            id: task.referenceId,
            appointmentType: "CHECK_OUT",
            status: "CONFIRMED",
            scheduledDate: "2026-10-30",
            slotStart: "09:00",
            facilityId: task.facilityId,
          },
        },
      }),
    );
    const fee = { code: "DAMAGE", name: "Phí xử lý", amount, note: "Đã đối chiếu" };
    const record = {
      id: "return-inspection",
      taskId: task.id,
      storageUnitId: task.referenceId,
      unitCode: "HCM-01",
      inspectionType: "CHECK_OUT",
      status: "IN_PROGRESS",
      condition: "MAJOR_DAMAGE",
      notes: "Hư hỏng đã ghi nhận",
      checklist: {
        results: ["ASSIGNED_UNIT", "DOOR_LOCK", "UNIT_CONDITION", "EXISTING_INVENTORY"].map(
          (itemCode) => ({
            itemCode,
            resultType: "PASS_FAIL",
            result: "PASS",
            note: null,
            photos: [],
          }),
        ),
      },
      evidence: [],
      returnContext: {
        depositAmount: 100000,
        policyVersion: 1,
        fees: [fee],
        penalties: [fee],
        checkIn: null,
      },
    };
    await page.route(`**/api/inspections/appointments/${task.referenceId}`, (route) =>
      route.fulfill({ json: { success: true, data: [record] } }),
    );
    let submitted: Record<string, unknown> | undefined;
    await page.route("**/api/inspections/return-inspection", async (route) => {
      submitted = route.request().postDataJSON();
      record.status = "PASSED";
      await route.fulfill({ json: { success: true, data: record } });
    });
    await page.goto(`/staff/tasks/${task.id}`);
    const finalize = page.getByRole("button", { name: "Xác nhận quyết toán và hoàn tất trả kho" });
    await expect(finalize).toBeDisabled();
    await page
      .getByLabel(
        amount < 100000
          ? "Tôi xác nhận đã hoàn đủ phần cọc còn dư cho khách."
          : "Tôi xác nhận quyết toán và công nợ phát sinh (nếu có).",
      )
      .check();
    await expect(finalize).toBeEnabled();
    await finalize.click();
    await expect.poll(() => submitted).toBeTruthy();
    expect(submitted?.settlement).toEqual({
      confirmed: true,
      deductionAmount: amount,
      ...(amount < 100000 ? { refund: { method: "CASH" } } : {}),
    });
  });
}
