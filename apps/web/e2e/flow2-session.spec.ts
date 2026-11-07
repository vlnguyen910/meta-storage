import { expect, test } from "@playwright/test";

test("API proxy preserves cookie login, reload, logout and protected navigation", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Địa chỉ Email", exact: true })
    .fill("manager@integration.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Thông tin đăng nhập không đúng.", { exact: true })).toBeVisible();
  await page.getByLabel("Mật khẩu", { exact: true }).fill("IntegrationOnly123!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/facility-manager\/dashboard/);
  await expect(page.getByRole("heading", { name: "Chưa được gán cơ sở" })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "flow2-session")).toMatchObject(
    {
      httpOnly: true,
      sameSite: "Lax",
      domain: "127.0.0.1",
    },
  );
  await page.reload();
  await expect(page.getByText("Manager Integration", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await context.cookies()).some((cookie) => cookie.name === "flow2-session")).toBe(false);
  await page.goto("/facility-manager/dashboard");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});

test("login stays disabled before hydration and never falls back to a GET form", async ({
  page,
}) => {
  let release: () => void = () => {};
  const hydration = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async (route) => {
    await hydration;
    await route.continue();
  });
  try {
    await page.goto("/login", { waitUntil: "commit" });
    const submit = page.getByRole("button", { name: "Đăng nhập", exact: true });
    await expect(submit).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Địa chỉ Email", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    release();
    await expect(submit).toBeEnabled();
  } finally {
    release();
  }
});
