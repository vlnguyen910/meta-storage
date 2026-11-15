import AxeBuilder from "@axe-core/playwright";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { expect, type Page, test } from "@playwright/test";
import { ADMIN_MESSAGES as AM } from "../src/features/administration/admin.messages";
import { FLOW } from "../src/features/facility-flow/flow.messages";
import { OPERATIONS_MESSAGES as OM } from "../src/features/operations/operations.messages";
import { TRANSACTION_MESSAGES as TM } from "../src/features/rentals/transactions.messages";
import { FACILITY_DASHBOARD_MESSAGES as FM } from "../src/modules/facility-manager/dashboard/facility-dashboard.messages";

const id = (n: number) => `97000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-10-25T05:00:00.000Z";
async function fixture(page: Page, role: UserRole) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (path === "/auth/me")
      data = {
        id: id(1),
        name: "Người kiểm thử",
        email: "qa@example.test",
        role,
        status: "ACTIVE",
        assignedFacilityId: id(2),
      };
    else if (path === "/users/customer-registrations") {
      const year = Number(new URL(route.request().url()).searchParams.get("year"));
      data = {
        year,
        years: [year, year - 1],
        items: Array.from({ length: 12 }, (_, index) => ({
          month: `${year}-${String(index + 1).padStart(2, "0")}`,
          count: index === 9 ? 3 : 0,
        })),
      };
    } else if (path === "/facilities/my-assignments")
      data = [{ facilityId: id(2), facilityName: "Cơ sở kiểm thử", isActive: true }];
    else if (path.endsWith("/staff"))
      data = Array.from({ length: 13 }, (_, i) => ({
        id: id(100 + i),
        name: `Nhân viên ${String(i + 1).padStart(2, "0")}`,
        email: `staff${i + 1}@example.test`,
        role: "FACILITY_STAFF",
        isActive: true,
        phone: "0901234567",
        assignedTasksCount: i % 2,
      }));
    else if (path === "/business-rules/pricing")
      data = {
        version: 1,
        depositMonths: 2,
        updatedAt: now,
        updatedBy: id(1),
        prices: Array.from({ length: 23 }, (_, i) => ({
          unitTypeId: id(200 + i),
          name: `Loại kho ${String(i + 1).padStart(2, "0")}`,
          code: `TYPE-${i + 1}`,
          monthlyPrice: 500000 + i * 10000,
          isActive: true,
        })),
      };
    else if (path === "/business-rules/pricing/history")
      data = Array.from({ length: 23 }, (_, i) => ({
        id: id(600 + i),
        version: 23 - i,
        operation: "DEPOSIT_POLICY",
        changedAt: now,
        changedBy: "Người vận hành",
        before: { depositMonths: 1 },
        after: { depositMonths: 2 },
      }));
    return route.fulfill({ json: { success: true, data } });
  });
}

async function inspect(page: Page, name: string) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  if (name.startsWith("transactions-") || name.startsWith("pricing-")) {
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  } else {
    await page.screenshot({ path: `test-results/audit-${name}.png`, fullPage: true });
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ html, failureSummary }) => ({ html, failureSummary })),
    })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [1440, 375]) {
  test(`transactions recover partial errors and page loaded payments at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, UserRole.STORAGE_CUSTOMER);
    let recover = false;
    let failedRequests = 0;
    await page.route("**/api/rentals/mine**", (route) => {
      const history = new URL(route.request().url()).searchParams.get("view") === "history";
      if (history && !recover) {
        failedRequests++;
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: 503, message: "Unavailable" } },
        });
      }
      const rental = {
        id: id(history ? 4 : 3),
        bookingCode: "BK-QA",
        facility: { id: id(2), name: "Cơ sở kiểm thử" },
        unitType: { name: "Kho thử" },
        payments: Array.from({ length: history ? 1 : 13 }, (_, i) => ({
          id: id((history ? 500 : 400) + i),
          paymentCode: `${history ? "HISTORY" : "PAY"}-${String(i + 1).padStart(2, "0")}`,
          status: i === 0 ? "PENDING" : "SUCCEEDED",
          totalAmount: "500000",
          createdAt: new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
          paidAt: i === 0 ? null : new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
        })),
      };
      return route.fulfill({
        json: { success: true, data: { items: [rental], nextCursor: null } },
      });
    });
    await page.route("**/api/rentals/*/payments", () => {
      throw new Error("Transaction lists must use the batched rental response");
    });
    await page.goto("/customer/transactions");
    await expect(page.getByText(TM.partialError)).toBeVisible({ timeout: 25000 });
    expect(failedRequests).toBeGreaterThan(0);
    await expect(page.getByText("PAY-13", { exact: true })).toBeVisible();
    await expect(page.getByText("PAY-01", { exact: true })).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Phân trang Lịch sử giao dịch" });
    await nav.getByRole("button", { name: "Trang sau" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("PAY-05", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: TM.viewFilter, exact: true }).click();
    await page.getByRole("option", { name: TM.current, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toHaveCount(0);
    await expect(page.getByText("PAY-13", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: TM.viewFilter, exact: true }).click();
    await page.getByRole("option", { name: TM.all, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toBeVisible();
    recover = true;
    await page.getByRole("button", { name: TM.retry, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toHaveCount(0);
    await expect(nav.getByRole("status").locator("strong")).toHaveText(["1", "8", "14"]);
    await inspect(page, `payment-pagination-${width}`);
    await nav.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(6);
    await expect(page.getByText("PAY-01", { exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });

  test(`BOM price search and policy history paginate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, UserRole.BUSINESS_OPERATIONS_MANAGER);
    await page.goto("/operations/pricing");
    await expect(page.locator("tbody tr")).toHaveCount(10);
    const nav = page.getByRole("navigation", { name: `Phân trang ${OM.pricingConfigTitle}` });
    await nav.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByRole("rowheader", { name: "Loại kho 11", exact: true })).toBeVisible();
    await page.getByLabel(OM.priceSearch).fill("Loại kho 23");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel(OM.priceSearch).fill("no-match");
    await expect(page.getByText(OM.noPriceMatch)).toBeVisible();
    await page.getByLabel(OM.priceSearch).fill("");
    await expect(page.getByRole("rowheader", { name: "Loại kho 01", exact: true })).toBeVisible();
    await inspect(page, `pricing-${width}`);
    await page.goto("/operations/business-rules");
    const history = page.getByRole("region", { name: OM.pricingHistoryTitle }).first();
    await expect(history.locator("tbody tr")).toHaveCount(10);
    await page
      .getByRole("navigation", { name: `Phân trang ${OM.pricingHistoryTitle}` })
      .getByRole("button", { name: "Trang sau" })
      .click();
    await expect(history.getByRole("rowheader", { name: "v13", exact: true })).toBeVisible();
    await inspect(page, `policy-history-${width}`);
  });
}

for (const width of [1440, 375]) {
  for (const role of [UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF]) {
    test(`${role} overview opens dispatch and highlights only its destination at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await fixture(page, role);
      const root = role === "FACILITY_MANAGER" ? "/facility-manager" : "/staff";
      await page.goto(`${root}/dashboard`);
      await expect(page.locator('aside [aria-current="page"]')).toHaveCount(1);
      await expect(page.locator('aside [aria-current="page"]')).toHaveText(FLOW.overview);
      await inspect(page, `${role}-overview-${width}`);
      await page
        .locator(
          `a[href="${root}/dashboard?view=${role === "FACILITY_MANAGER" ? "check-in" : "tasks"}"]`,
        )
        .last()
        .click();
      const destination = `${root}/dashboard?view=${role === UserRole.FACILITY_MANAGER ? "check-in" : "tasks"}`;
      await expect(page).toHaveURL(new URL(destination, "http://127.0.0.1:3104").href);
      await expect(page.locator('aside [aria-current="page"]')).toHaveCount(1);
      await expect(page.locator('aside [aria-current="page"]')).toHaveAttribute(
        "href",
        destination,
      );
      if (role === "FACILITY_MANAGER") {
        await page.goto(`${root}/dashboard?view=staff`);
        await expect(page.locator('aside [aria-current="page"]')).toHaveAttribute(
          "href",
          `${root}/staff`,
        );
        await expect(
          page.getByRole("heading", { name: "Nhân viên 01", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("navigation", { name: `Phân trang ${FM.staffSectionTitle}` })
          .getByRole("button", { name: "Trang sau" })
          .click();
        await expect(
          page.getByRole("heading", { name: "Nhân viên 07", exact: true }),
        ).toBeVisible();
        await page.getByLabel(FM.staffSearch).fill("Nhân viên 13");
        await expect(
          page.getByRole("heading", { name: "Nhân viên 13", exact: true }),
        ).toBeVisible();
        await inspect(page, `fm-staff-${width}`);
        await page.getByRole("link", { name: FM.staffViewBookingsAction }).click();
        await expect(page).toHaveURL(/dashboard\?view=check-in$/);
      }
      await inspect(page, `${role}-dispatch-${width}`);
    });
  }
}

for (const width of [1440, 375]) {
  test(`Admin dashboard charts monthly customer registrations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, UserRole.SYSTEM_ADMINISTRATOR);
    await page.goto("/system-admin/dashboard");
    await expect(page.getByRole("heading", { name: AM.titles.dashboard })).toBeVisible();
    await expect(page.getByRole("heading", { name: AM.customerChart })).toBeVisible();
    await expect(page.locator(".recharts-line-curve")).toBeVisible();
    for (const removed of [
      "Phân bố 5 vai trò",
      "Phân quyền theo cơ sở",
      "Đăng nhập gần đây",
      "Hoạt động gần đây",
    ]) {
      await expect(page.getByRole("heading", { name: removed })).toHaveCount(0);
    }
    await inspect(page, `admin-dashboard-${width}`);
    if (width < 1024) await page.getByRole("button", { name: AM.openMenu }).click();
    await page.getByRole("link", { name: AM.titles.users, exact: true }).click();
    await expect(page).toHaveURL(/\/system-admin\/users$/);
  });

  if (width === 1440) {
    test("Admin dashboard retries customer statistics after an API error", async ({ page }) => {
      await fixture(page, UserRole.SYSTEM_ADMINISTRATOR);
      let available = false;
      await page.route("**/api/users/customer-registrations", (route) => {
        if (!available) {
          return route.fulfill({ status: 503, json: { success: false, error: { code: 503 } } });
        }
        const year = new Date().getUTCFullYear();
        const month = `${year}-10`;
        return route.fulfill({
          json: {
            success: true,
            data: {
              year,
              years: [year],
              items: [{ month, count: 2 }],
              summary: {
                totalUsers: 2,
                activeUsers: 2,
                inactiveUsers: 0,
                unassignedFacilityUsers: 0,
              },
            },
          },
        });
      });
      await page.goto("/system-admin/dashboard");
      await expect(
        page.getByRole("alert").filter({ hasText: AM.customerChartError }),
      ).toBeVisible();
      available = true;
      await page.getByRole("button", { name: AM.customerChartRetry }).click();
      await expect(page.getByText("2 tài khoản mới", { exact: true })).toBeVisible();
    });
  }

  test(`Admin users paginate and filter API data at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, UserRole.SYSTEM_ADMINISTRATOR);
    const users = Array.from({ length: 23 }, (_, i) => ({
      id: id(100 + i),
      name: `QA User ${i + 1}`,
      email: `qa${i + 1}@example.test`,
      role: "FACILITY_STAFF",
      status: "ACTIVE",
      phone: null,
      createdAt: now,
      updatedAt: now,
    }));
    await page.route("**/api/users?**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      const offset = Number(params.get("offset") ?? 0);
      const limit = Number(params.get("limit") ?? 100);
      return route.fulfill({ json: { success: true, data: users.slice(offset, offset + limit) } });
    });
    await page.goto("/system-admin/users");
    await expect(page.locator("tbody tr")).toHaveCount(10);
    const nav = page.getByRole("navigation", { name: `Phân trang ${AM.titles.users}` });
    await expect(nav.getByRole("button", { name: "Trang trước" })).toBeDisabled();
    await nav.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByText("QA User 11", { exact: true })).toBeVisible();
    await nav.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(nav.getByRole("button", { name: "Trang sau" })).toBeDisabled();
    const search = page.getByRole("searchbox", { name: AM.search });
    await search.fill("no-match-qa");
    await search.press("Enter");
    await expect(page.getByText(AM.empty, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: AM.clearFilters }).click();
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await expect(nav.getByRole("button", { name: "Trang trước" })).toBeDisabled();
    await inspect(page, `admin-users-${width}`);
  });
}

for (const width of [1440, 375]) {
  test(`Transaction source errors stay in their view, retry and preserve rental cursors at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, UserRole.STORAGE_CUSTOMER);
    let recovered = false;
    await page.route("**/api/rentals/mine**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      const history = params.get("view") === "history";
      if (history && !recovered)
        return route.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: 503, message: "Unavailable" },
          },
        });
      const more = params.has("afterId");
      const rental = history ? 4 : more ? 5 : 3;
      return route.fulfill({
        json: {
          success: true,
          data: {
            items: [
              {
                id: id(rental),
                bookingCode: "BK-QA",
                facility: { id: id(2), name: "Cơ sở kiểm thử" },
                unitType: { name: "Kho thử" },
                payments: [
                  {
                    id: id(900 + rental),
                    paymentCode: `SOURCE-${rental}`,
                    status: "PENDING",
                    totalAmount: "500000",
                    createdAt: `2026-10-0${rental}T00:00:00.000Z`,
                    paidAt: null,
                  },
                ],
              },
            ],
            nextCursor: !history && !more ? { afterEndAt: now, afterId: id(3) } : null,
          },
        },
      });
    });
    await page.route("**/api/rentals/*/payments", () => {
      throw new Error("Transaction lists must use the batched rental response");
    });
    await page.goto("/customer/transactions");
    await expect(page.getByText(TM.partialError)).toBeVisible();
    await page.getByRole("button", { name: TM.viewFilter, exact: true }).click();
    await page.getByRole("option", { name: TM.current, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toHaveCount(0);
    await expect(page.getByText("SOURCE-3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: TM.viewFilter, exact: true }).click();
    await page.getByRole("option", { name: TM.history, exact: true }).click();
    await expect(page.getByText(TM.loadFailed)).toBeVisible();
    await inspect(page, `transaction-source-error-${width}`);
    recovered = true;
    await page.getByRole("button", { name: TM.retry, exact: true }).click();
    await expect(page.getByText("SOURCE-4", { exact: true })).toBeVisible();
    await expect(page.getByText(TM.loadFailed)).toHaveCount(0);
    await page.getByRole("button", { name: TM.viewFilter, exact: true }).click();
    await page.getByRole("option", { name: TM.current, exact: true }).click();
    await page.getByRole("button", { name: TM.loadMore, exact: true }).click();
    await expect(page.getByText("SOURCE-5", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: TM.loadMore, exact: true })).toHaveCount(0);
    expect(await page.locator("main").innerText()).toMatch(/SOURCE-5[\s\S]*SOURCE-3/);
  });
}

test("Reservation refresh clamps the page and keeps previous navigation usable", async ({
  page,
}) => {
  await page.clock.install();
  await fixture(page, UserRole.STORAGE_CUSTOMER);
  let count = 13;
  await page.route("**/api/reservations/mine", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: Array.from({ length: count }, (_, i) => ({
          id: id(800 + i),
          code: `RES-${i + 1}`,
          status: "CONFIRMED",
          facility: { id: id(2), name: "Cơ sở kiểm thử" },
          unitType: "Kho thử",
          sizeLabel: "5 m²",
          startDate: "2026-11-01",
          depositAmount: 500000,
        })),
      },
    }),
  );
  await page.goto("/customer/reservations");
  const nav = page.getByRole("navigation", { name: "Phân trang reservation" });
  await nav.getByRole("button", { name: "Trang sau" }).click();
  await nav.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.getByText("RES-13", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  count = 8;
  await page.clock.fastForward(31000);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(nav.getByText("Trang 2/2")).toBeVisible();
  await expect(page.getByText("RES-7", { exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Trang trước" }).click();
  await expect(nav.getByText("Trang 1/2")).toBeVisible();
  await expect(page.getByText("RES-1", { exact: true })).toBeVisible();
});
