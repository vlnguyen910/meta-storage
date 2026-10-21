import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("shows the global overlay during a blocking sign-in request", async ({ page }) => {
  await page.route("**/auth/sign-in/email", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid credentials" }),
    });
  });

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("loading-check@example.test");
  await page.locator('input[type="password"]').fill("invalid-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  const overlay = page.getByRole("status", { name: "Đang xử lý thao tác…" });
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("aria-busy", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(overlay).toBeHidden();
});

test("keeps loading visible from successful sign-in until the role page opens", async ({
  page,
}) => {
  const manager = {
    id: "40000000-0000-4000-8000-000000000003",
    name: "Quản lý demo",
    email: "manager@metastorage.test",
    phone: null,
    image: null,
    emailVerified: true,
    status: "ACTIVE",
    role: "FACILITY_MANAGER",
    assignedFacilityId: "30000000-0000-4000-8000-000000000001",
  };
  let sessionReads = 0;

  await page.route("**/auth/sign-in/email", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/auth/me", async (route) => {
    sessionReads += 1;
    if (sessionReads === 1) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: manager }),
    });
  });
  await page.route("**/facility-manager/dashboard**", async (route) => {
    if (route.request().resourceType() === "fetch") {
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    await route.continue();
  });

  await page.goto("/login?returnTo=%2Ffacility-manager%2Fdashboard");
  await page.locator('input[type="email"]').fill("manager@metastorage.test");
  await page.locator('input[type="password"]').fill("12345678");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  const globalLoading = page.locator('[role="status"][aria-busy="true"]');
  await expect(globalLoading).toBeVisible();
  await expect(page.getByText(/Chào mừng/)).toBeVisible();
  await expect(globalLoading).toBeVisible();
  await expect(page).toHaveURL(/\/facility-manager\/dashboard/);
  await expect(globalLoading).toBeHidden();
});

test("shows a page-shaped skeleton while facilities load and then exposes the retry state", async ({
  page,
}) => {
  await page.route("**/facilities**", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.abort();
  });

  await page.goto("/facilities");
  const skeleton = page.getByRole("status", { name: "Đang tìm cơ sở phù hợp…" });
  await expect(skeleton).toBeVisible();
  await expect(skeleton.locator("[aria-hidden='true']").first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(skeleton).toBeHidden();
});

test("shows the delayed full-screen fallback during slow App Router navigation", async ({
  page,
}) => {
  await page.route("**/forgot-password**", async (route) => {
    if (route.request().resourceType() === "fetch") {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    await route.continue();
  });

  await page.goto("/login");
  await page.getByRole("link", { name: /Quên mật khẩu/ }).click();

  const routeLoading = page.getByRole("status", { name: "Đang tải trang…" });
  await expect(routeLoading).toBeVisible();
  await expect(page).toHaveURL(/forgot-password/);
  await expect(routeLoading).toBeHidden();
});
