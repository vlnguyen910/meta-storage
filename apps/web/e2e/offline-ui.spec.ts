import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Demo@123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test("offline staff workflow survives reload without backend requests", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (/:4000|:8080|\/api\//.test(r.url())) requests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "staff@metastorage.test");
  await expect(page.getByRole("heading", { name: "Công việc được giao" })).toBeVisible();
  await page.goto("/staff/check-in?bookingCode=BK-2026-0003");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await page.getByRole("radio", { name: /Đúng ô kho vật lý/ }).check();
  await page
    .getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })
    .fill("Kho sạch, khô ráo, không hư hại.");
  await page.locator("input[type=file]").setInputFiles({
    name: "offline.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG3sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("offline.png")).toBeVisible();
  await page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" }).click();
  await expect(page.getByRole("heading", { name: "Xem lại & Hoàn tất kiểm tra" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Hoàn tất kiểm tra ô kho (Khóa biên bản)" }).click();
  await expect(
    page.getByRole("heading", { name: "Bàn giao kho & Kích hoạt thuê kho" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("checkbox", {
      name: "Đã đối chiếu với khách hàng và xác nhận khách đã nhận bàn giao ô kho.",
    })
    .check();
  await page
    .getByRole("button", { name: "Xác nhận bàn giao & Kích hoạt hợp đồng thuê kho" })
    .click();
  await expect(page.getByRole("heading", { name: "Thuê kho đang hoạt động" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thuê kho đang hoạt động" })).toBeVisible();
  await page.screenshot({ path: "/tmp/metastorage-offline-staff.png", fullPage: true });
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
test("all demo roles and public pages render without backend", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/:4000|:8080|\/api\//.test(r.url())) requests.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Tìm kho gần bạn/ }).first()).toBeVisible();
  await page.goto("/facilities");
  await expect(page.getByText("metastorage Sài Gòn Central", { exact: true })).toBeVisible();
  for (const email of ["manager", "operations", "admin", "customer"]) {
    await login(page, `${email}@metastorage.test`);
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: `/tmp/metastorage-offline-${email}.png`, fullPage: true });
  }
  expect(requests).toEqual([]);
});

test("guest checkout uses the selected price and creates a mock booking", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/:4000|:8080|\/api\//.test(r.url())) requests.push(r.url());
  });
  await page.goto("/reservations/new?facilityId=fac-hcm-central");
  await page.getByRole("button", { name: "Chọn loại này", exact: true }).first().click();
  await page.getByRole("button", { name: "Tiếp tục: Thông tin người thuê" }).click();
  await page.getByLabel("Họ và tên", { exact: true }).fill("Khách mock");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page.getByLabel("Địa chỉ email", { exact: true }).fill("customer@metastorage.test");
  await page.getByLabel("Thời hạn thuê", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Xem đơn thuê", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra thông tin đơn thuê kho" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("Khách mock");
  await page.getByRole("button", { name: "Xem đơn thuê", exact: true }).click();
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await expect(page.getByText("Thanh toán mô phỏng", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đặt thuê kho thành công!" })).toBeVisible();
  await expect(page.getByText(/Chế độ mock không gửi email/)).toBeVisible();
  await page.screenshot({ path: "/tmp/metastorage-offline-guest.png", fullPage: true });
  const bookings = await page.evaluate(
    () => JSON.parse(localStorage.getItem("metastorage.mock-db.v4") ?? "{}").bookings,
  );
  expect(bookings[0].contactName).toBe("Khách mock");
  expect(bookings[0].totalAmount).toBe(3600000);
  expect(requests).toEqual([]);
});

test("FM can assign a physical unit and Staff without acting as Staff", async ({ page }) => {
  await login(page, "manager@metastorage.test");
  const id = "b0000000-0000-0000-0000-000000000001";
  await page.goto(`/facility-manager/check-in?view=assign&bookingId=${id}`);
  await page.getByRole("radio", { name: "HCM-01-001", exact: true }).check();
  await page.getByRole("button", { name: "Xác nhận gán ô kho", exact: true }).click();
  await page.goto("/facility-manager/dashboard");
  await page.getByRole("button", { name: "Chỉ định / Đổi nhân viên", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Chỉ định nhân viên phụ trách" })).toBeVisible();
  await page.getByRole("radio", { name: /Trần Quốc Huy/ }).check();
  await page.getByRole("button", { name: "Xác nhận chỉ định", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chỉ định nhân viên phụ trách" })).toHaveCount(0);
  const booking = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem("metastorage.mock-db.v4") ?? "{}").bookings.find(
        (b: { id: string }) => b.id === id,
      ),
    id,
  );
  expect(booking.assignedStaff.id).toBe("user-2");
  expect(booking.assignedUnit.physicalUnitCode).toBe("HCM-01-001");
  await page.screenshot({ path: "/tmp/metastorage-offline-assigned.png", fullPage: true });
});
