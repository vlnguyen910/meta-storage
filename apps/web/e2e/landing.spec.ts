import AxeBuilder from "@axe-core/playwright";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { expect, type Page, test } from "@playwright/test";

const facilityId = "97000000-0000-4000-8000-000000000001";
const secondId = "97000000-0000-4000-8000-000000000002";
const facility = (id: string, name: string) => ({
  id,
  name,
  code: "QA",
  address: "Địa chỉ cơ sở kiểm thử, TP. Hồ Chí Minh",
  coverUrl: null,
  description: null,
  isActive: true,
  startingMonthlyPrice: 450000,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
});

async function fixture(
  page: Page,
  mode: () => "ready" | "error" | "empty" = () => "ready",
  role?: UserRole,
) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return role
        ? route.fulfill({
            json: {
              success: true,
              data: {
                id: facilityId,
                name: "Người kiểm thử",
                email: "qa@example.test",
                role,
                status: "ACTIVE",
              },
            },
          })
        : route.fulfill({ status: 401, json: { success: false } });
    if (path.endsWith("/facilities/catalog")) {
      if (mode() === "error") return route.fulfill({ status: 503, json: { success: false } });
      const items =
        mode() === "empty"
          ? []
          : [facility(facilityId, "Kho kiểm thử A"), facility(secondId, "Kho kiểm thử B")];
      return route.fulfill({
        json: {
          success: true,
          data: { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 },
        },
      });
    }
    if (path.endsWith("/unit-types"))
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "unit-small",
              name: path.includes(secondId) ? "Kho nhỏ cơ sở B" : "Kho nhỏ cơ sở A",
              sizeLabel: "2 m²",
              lengthM: 2,
              widthM: 1,
              heightM: 2.5,
              monthlyPrice: 450000,
            },
            {
              id: "unit-large",
              name: "Kho lớn",
              sizeLabel: "8 m²",
              lengthM: 4,
              widthM: 2,
              heightM: 2.5,
              monthlyPrice: 1200000,
            },
          ],
        },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
}

for (const width of [360, 768, 1440]) {
  test(`landing is accessible and interactive at ${width}px`, async ({ page }, testInfo) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydration|hydrated/i.test(message.text()))
        hydrationErrors.push(message.text());
    });
    await page.setViewportSize({ width, height: 960 });
    await fixture(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thêm không gian.");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Đến nội dung chính" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expect(page.getByRole("button", { name: "Tìm kho phù hợp" })).toBeEnabled();
    const pricing = page.locator("#pricing");
    await expect(pricing.getByRole("heading", { name: "Kho nhỏ cơ sở A" })).toBeVisible();
    await pricing.getByRole("button", { name: "Dưới 3 m²", exact: true }).click();
    await expect(pricing.getByRole("heading", { name: "Kho lớn", exact: true })).toHaveCount(0);
    await pricing.getByLabel("Cơ sở lưu trữ").selectOption(secondId);
    await expect(pricing.getByRole("heading", { name: "Kho nhỏ cơ sở B" })).toBeVisible();
    await expect(pricing.getByRole("link", { name: "Chọn loại kho" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fcustomer%2Ffacilities",
    );
    const question = page.locator("summary").filter({ hasText: "Tôi có cần đăng nhập" });
    await question.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Bạn cần đăng nhập tài khoản khách hàng để đặt kho.", { exact: false }).last(),
    ).toBeVisible();
    if (width < 1280) {
      await page.getByLabel("Mở menu").click();
      await page
        .getByRole("navigation", { name: "Điều hướng trên di động" })
        .getByRole("link", { name: "Hướng dẫn thuê" })
        .click();
      await expect(page).toHaveURL(/#how-it-works$/);
      await expect(page.locator("header details")).not.toHaveAttribute("open");
    }
    await pricing.getByRole("button", { name: "Tất cả", exact: true }).click();
    await pricing.getByLabel("Cơ sở lưu trữ").selectOption(facilityId);
    await expect(pricing.getByRole("heading", { name: "Kho nhỏ cơ sở A" })).toBeVisible();
    await page.evaluate(async () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await document.fonts.ready;
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(hydrationErrors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
    await testInfo.attach(`landing-${width}`, {
      path: testInfo.outputPath(`landing-${width}.png`),
      contentType: "image/png",
    });
  });
}

for (const width of [1280, 1440]) {
  for (const role of [undefined, UserRole.STORAGE_CUSTOMER]) {
    test(`navbar stays centered without overlaps at ${width}px for ${role ?? "guest"}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await fixture(page, () => "ready", role);
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Tìm kho phù hợp" })).toBeEnabled();
      const header = page.locator("header");
      const nav = header.getByRole("navigation", { name: "Điều hướng chính" });
      const bounds = await nav.boundingBox();
      if (!bounds) throw new Error("Desktop navigation is missing");
      expect(Math.abs(bounds.x + bounds.width / 2 - width / 2)).toBeLessThan(2);
      await expect(nav.getByRole("link").first()).toHaveCSS("font-size", "16px");
      const brand = await header.getByRole("link").first().boundingBox();
      const account = await header
        .getByRole("link", {
          name: role ? "Mở trang quản lý của Người kiểm thử" : "Tra cứu kho của tôi",
          exact: true,
        })
        .boundingBox();
      if (!brand || !account) throw new Error("Header actions are missing");
      expect(brand.x + brand.width).toBeLessThanOrEqual(bounds.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(account.x);
      expect(await header.evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
      await header.screenshot({ path: testInfo.outputPath("navbar.png") });
    });
  }
}

for (const entry of [
  { role: undefined, destination: "/login?returnTo=%2Fcustomer%2Ffacilities" },
  { role: UserRole.STORAGE_CUSTOMER, destination: "/customer/facilities" },
  { role: UserRole.FACILITY_STAFF, destination: "/staff/tasks" },
]) {
  test(`search uses the correct workspace for ${entry.role ?? "guest"}`, async ({ page }) => {
    await fixture(page, () => "ready", entry.role);
    await page.goto("/");
    await page.getByRole("button", { name: "Tìm kho phù hợp" }).click();
    await expect(page).toHaveURL(new URL(entry.destination, "http://127.0.0.1:3120").href);
  });
}

test("removed public reservation page returns 404", async ({ page }) => {
  await fixture(page);
  const response = await page.goto(`/reservations/new?facilityId=${facilityId}&area=all`);
  expect(response?.status()).toBe(404);
});

test("content fades upward on scroll once and remains visible afterwards", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fixture(page);
  await page.goto("/");
  const reveal = page.locator("#how-it-works li [data-landing-reveal]").first();
  await expect(reveal).toHaveCSS("opacity", "0");
  await reveal.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await reveal.evaluate((el) => getComputedStyle(el).opacity)))
    .toBeGreaterThan(0);
  await expect(reveal).toHaveCSS("opacity", "1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(reveal).toHaveCSS("opacity", "1");
});

test("catalog errors can be retried without presenting fabricated availability", async ({
  page,
}) => {
  let mode: "ready" | "error" = "error";
  await fixture(page, () => mode);
  await page.goto("/");
  const retry = page.locator("main").getByRole("button", { name: "Thử lại" }).first();
  await expect(retry).toBeVisible();
  await expect(page.getByRole("button", { name: "Tìm kho phù hợp" })).toBeEnabled();
  mode = "ready";
  await retry.click();
  await expect(page.getByRole("button", { name: "Tìm kho phù hợp" })).toBeEnabled();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("empty catalog displays an honest empty state and still permits login", async ({ page }) => {
  await fixture(page, () => "empty");
  await page.goto("/");
  await expect(
    page.getByText("Chưa có cơ sở để hiển thị. Vui lòng quay lại sau.").first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tìm kho phù hợp" })).toBeEnabled();
  await expect(page.locator("#pricing article")).toHaveCount(0);
});
