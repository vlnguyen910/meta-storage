import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { UserRole } from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";
import { ADMIN_MESSAGES as AM } from "../src/features/administration/admin.messages";
import type { AdminMockData } from "../src/features/administration/admin.types";
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
    else if (path === "/facilities/my-assignments")
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
      const rental = {
        id: id(history ? 4 : 3),
        bookingCode: "BK-QA",
        facility: { id: id(2), name: "Cơ sở kiểm thử" },
        unitType: { name: "Kho thử" },
      };
      return route.fulfill({
        json: { success: true, data: { items: [rental], nextCursor: null } },
      });
    });
    await page.route("**/api/rentals/*/payments", (route) => {
      const history = route.request().url().includes(id(4));
      if (history && !recover) {
        failedRequests++;
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: 503, message: "Unavailable" } },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: Array.from({ length: history ? 1 : 13 }, (_, i) => ({
            id: id((history ? 500 : 400) + i),
            paymentCode: `${history ? "HISTORY" : "PAY"}-${String(i + 1).padStart(2, "0")}`,
            status: i === 0 ? "PENDING" : "SUCCEEDED",
            totalAmount: "500000",
            createdAt: new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
            paidAt: i === 0 ? null : new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
            returnRefunds: [],
          })),
        },
      });
    });
    await page.goto("/customer/transactions");
    await expect(page.getByText(TM.partialError)).toBeVisible({ timeout: 25000 });
    expect(failedRequests).toBeGreaterThan(0);
    await expect(page.getByText("PAY-13", { exact: true })).toBeVisible();
    await expect(page.getByText("PAY-01", { exact: true })).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Phân trang Lịch sử giao dịch" });
    await nav.getByRole("button", { name: "Trang sau" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("PAY-07", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: TM.current, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toHaveCount(0);
    await expect(page.getByText("PAY-13", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: TM.all, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toBeVisible();
    recover = true;
    await page.getByRole("button", { name: TM.retry, exact: true }).click();
    await expect(page.getByText(TM.partialError)).toHaveCount(0);
    await expect(nav.getByText("Hiển thị 1–6 / 14")).toBeVisible();
    await inspect(page, `transactions-${width}`);
    await nav.getByRole("button", { name: "Trang sau" }).click();
    await nav.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByText(TM.createdAt, { exact: true })).toHaveCount(2);
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
  test(`Admin lists paginate, reset filters and export all matches at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    // The admin prototype clones its local seed rather than calling an API. Expand only
    // that seed inside this browser context, without adding production test hooks.
    await page.addInitScript(() => {
      const clone = window.structuredClone.bind(window);
      window.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
        const result = clone(value, options);
        if (
          result &&
          typeof result === "object" &&
          "users" in result &&
          "audits" in result &&
          "logins" in result &&
          "facilities" in result
        ) {
          const seed = result as AdminMockData;
          const staff = seed.users.find((user) => user.role === "FACILITY_STAFF");
          if (staff)
            return {
              ...seed,
              users: Array.from({ length: 23 }, (_, i) => ({
                ...staff,
                id: `QA-${i + 1}`,
                name: `QA User ${i + 1}`,
                email: `qa${i + 1}@example.test`,
              })),
              logins: Array.from({ length: 23 }, (_, i) => ({
                ...seed.logins[0],
                id: `LOGIN-QA-${i + 1}`,
              })),
              audits: Array.from({ length: 23 }, (_, i) => ({
                ...seed.audits[0],
                id: `AUDIT-QA-${i + 1}`,
              })),
            };
        }
        return result;
      }) as typeof window.structuredClone;
    });
    await fixture(page, UserRole.SYSTEM_ADMINISTRATOR);
    for (const section of ["users", "login-history", "activity-logs"] as const) {
      await page.goto(`/system-admin/${section}`);
      await expect(page.locator("tbody tr")).toHaveCount(10);
      const nav = page.getByRole("navigation", { name: `Phân trang ${AM.titles[section]}` });
      await expect(nav.getByRole("button", { name: "Trang trước" })).toBeDisabled();
      await nav.getByRole("button", { name: "Trang sau" }).click();
      await expect(nav.getByText("Hiển thị 11–20 / 23")).toBeVisible();
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: AM.export }).click();
      const csv = await download;
      const path = await csv.path();
      if (!path) throw new Error("The CSV download did not produce a local file");
      expect((await readFile(path, "utf8")).trim().split(/\r?\n/)).toHaveLength(24);
      await nav.getByRole("button", { name: "Trang sau" }).click();
      await expect(page.locator("tbody tr")).toHaveCount(3);
      await expect(nav.getByRole("button", { name: "Trang sau" })).toBeDisabled();
      await page
        .getByRole("searchbox", { name: section === "activity-logs" ? AM.auditSearch : AM.search })
        .fill("no-match-qa");
      await expect(page.getByText(AM.empty, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: AM.reset }).click();
      await expect(page.locator("tbody tr")).toHaveCount(10);
      await expect(nav.getByRole("button", { name: "Trang trước" })).toBeDisabled();
      await inspect(page, `admin-${section}-${width}`);
    }
  });
}

test("Transaction source errors stay in their view, retry and preserve rental cursors", async ({
  page,
}) => {
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
    return route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            {
              id: id(history ? 4 : more ? 5 : 3),
              bookingCode: "BK-QA",
              facility: { id: id(2), name: "Cơ sở kiểm thử" },
              unitType: { name: "Kho thử" },
            },
          ],
          nextCursor: !history && !more ? { afterEndAt: now, afterId: id(3) } : null,
        },
      },
    });
  });
  await page.route("**/api/rentals/*/payments", (route) => {
    const rental = Number(new URL(route.request().url()).pathname.split("/").at(-2)?.slice(-1));
    return route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: id(900 + rental),
            paymentCode: `SOURCE-${rental}`,
            status: "PENDING",
            totalAmount: "500000",
            createdAt: `2026-10-0${rental}T00:00:00.000Z`,
            paidAt: null,
            returnRefunds: [],
          },
        ],
      },
    });
  });
  await page.goto("/customer/transactions");
  await expect(page.getByText(TM.partialError)).toBeVisible();
  await page.getByRole("button", { name: TM.current, exact: true }).click();
  await expect(page.getByText(TM.partialError)).toHaveCount(0);
  await expect(page.getByText("SOURCE-3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: TM.history, exact: true }).click();
  await expect(page.getByText(TM.loadFailed)).toBeVisible();
  await inspect(page, "transaction-source-error");
  recovered = true;
  await page.getByRole("button", { name: TM.retry, exact: true }).click();
  await expect(page.getByText("SOURCE-4", { exact: true })).toBeVisible();
  await expect(page.getByText(TM.loadFailed)).toHaveCount(0);
  await page.getByRole("button", { name: TM.current, exact: true }).click();
  await page.getByRole("button", { name: TM.loadMore, exact: true }).click();
  await expect(page.getByText("SOURCE-5", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: TM.loadMore, exact: true })).toHaveCount(0);
  expect(await page.locator("main").innerText()).toMatch(/SOURCE-5[\s\S]*SOURCE-3/);
});

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
