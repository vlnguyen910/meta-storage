import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function signInOperations(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /operations@metastorage.test/ }).click();
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/operations\/dashboard/);
}

const pages = [
  ["dashboard", "Tổng quan hệ thống"],
  ["facilities", "Quản lý cơ sở toàn hệ thống"],
  ["pricing", "Chính sách giá thuê"],
  ["fees", "Tiền cọc và khoản phí"],
  ["business-rules", "Quy tắc kinh doanh"],
  ["reports", "Trung tâm báo cáo"],
  ["reports/revenue", "Báo cáo tiền thuê và doanh thu"],
  ["reports/utilization", "Sức chứa và hiệu suất sử dụng"],
] as const;

for (const [path, title] of pages) {
  test(`BOM ${path} uses accessible local mock data`, async ({ page }) => {
    await signInOperations(page);
    const backendRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(":4000/")) backendRequests.push(request.url());
    });
    await page.goto(`/operations/${path}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Dữ liệu minh họa", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(backendRequests).toEqual([]);
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("facility filtering, empty recovery, and edit dialog work", async ({ page }) => {
  await signInOperations(page);
  await page.goto("/operations/facilities");
  const search = page.getByLabel("Tìm cơ sở theo tên hoặc địa chỉ");
  await search.fill("missing-facility");
  await expect(page.getByText("Không có cơ sở phù hợp", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đặt lại bộ lọc" }).click();
  await page.getByRole("button", { name: "Chỉnh thông tin cơ sở: StoreX Sài Gòn Central" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Tên cơ sở", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Lưu bản mẫu" }).click();
  await expect(dialog.getByText("Vui lòng nhập thông tin này.", { exact: true })).toBeVisible();
  await dialog.getByLabel("Tên cơ sở", { exact: true }).fill("StoreX Central — bản mẫu");
  await dialog.getByRole("button", { name: "Lưu bản mẫu" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("rowheader", { name: /StoreX Central — bản mẫu/ })).toBeVisible();
});

test("pricing validates and retains edits across mock navigation", async ({ page }) => {
  await signInOperations(page);
  await page.goto("/operations/pricing");
  await page.getByRole("button", { name: "Chỉnh giá thuê mẫu: Mini" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Giá thuê mới (đ/tháng)").fill("-1");
  await dialog.getByRole("button", { name: "Lưu bản mẫu" }).click();
  await expect(dialog.getByText("Nhập số tiền hợp lệ, không nhỏ hơn 0.")).toBeVisible();
  await dialog.getByLabel("Giá thuê mới (đ/tháng)").fill("950000");
  await dialog.getByRole("button", { name: "Lưu bản mẫu" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("row", { name: /Mini/ })).toContainText("950.000");
  if (await page.getByRole("button", { name: "Mở menu vận hành" }).isVisible()) {
    await page.getByRole("button", { name: "Mở menu vận hành" }).click();
  }
  await page.getByRole("link", { name: "Cọc và phí", exact: true }).first().click();
  if (await page.getByRole("button", { name: "Mở menu vận hành" }).isVisible()) {
    await page.getByRole("button", { name: "Mở menu vận hành" }).click();
  }
  await page.getByRole("link", { name: "Giá thuê", exact: true }).first().click();
  await expect(page.getByRole("row", { name: /Mini/ })).toContainText("950.000");
});

test("report filter totals and CSV export use only selected fixtures", async ({ page }) => {
  await signInOperations(page);
  await page.goto("/operations/reports/revenue");
  await page.getByLabel("Cơ sở kho", { exact: true }).selectOption("SGC");
  await expect(page.getByText(/120\.000\.000/).first()).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "StoreX Bình Thạnh" })).toHaveCount(0);
  await page.getByLabel("Loại kho", { exact: true }).selectOption("mini");
  await expect(page.getByText(/30\.000\.000/).first()).toBeVisible();
  await page.getByLabel("Kỳ báo cáo mẫu", { exact: true }).selectOption("previous");
  await expect(page.getByText("Không có cơ sở phù hợp", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đặt lại bộ lọc" }).click();
  await page.getByLabel("Cơ sở kho", { exact: true }).selectOption("SGC");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV" }).click();
  expect((await download).suggestedFilename()).toBe("storex-operations-mock.csv");
  await page.getByRole("link", { name: "Quay lại trung tâm báo cáo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Trung tâm báo cáo" })).toBeVisible();
});

test("customer cannot enter the custom BOM layout", async ({ page }) => {
  await page.goto("/login");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
  await page.goto("/operations/facilities");
  await expect(page).toHaveURL(/\/forbidden/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Quản lý cơ sở toàn hệ thống" }),
  ).toHaveCount(0);
});
