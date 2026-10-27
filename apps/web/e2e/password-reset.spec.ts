import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_MESSAGES as m } from "../src/features/auth/auth.messages";

test("keeps auth and storage lookup actions visible without landscape overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/reset-password?token=landscape-test");
  await expect(
    page.locator("header").getByRole("link", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: /Tra cứu kho/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("rejects a missing or expired reset link and offers recovery", async ({ page }) => {
  for (const path of [
    "/reset-password",
    "/reset-password?error=INVALID_TOKEN",
    `/reset-password?token=${"a".repeat(257)}`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole("alert").filter({ hasText: m.resetInvalid })).toBeVisible();
    await expect(page.getByRole("button", { name: m.resetSubmit })).toHaveCount(0);
    await expect(page.getByRole("link", { name: m.resetRequestNew })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  }
});

test("requests recovery through the real auth endpoint and shows a generic result", async ({
  page,
}) => {
  await page.route("**/api/auth/request-password-reset", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: "customer@example.test" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });
  await page.goto("/forgot-password");
  await page.getByLabel(m.forgotPasswordEmailLabel).fill("customer@example.test");
  await page.getByRole("button", { name: m.forgotPasswordSubmitBtn }).click();
  await expect(page.getByRole("heading", { name: m.forgotPasswordSuccessTitle })).toBeVisible();
  await expect(page.getByText(m.securityNoticeBody)).toBeVisible();
});

test("validates matching passwords, retries a failed request, and completes recovery", async ({
  page,
}) => {
  let attempts = 0;
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/reset-password", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token: "browser-test-token",
      newPassword: "NewPassword123!",
    });
    attempts++;
    if (attempts === 1) await pending;
    await route.fulfill({
      status: attempts === 1 ? 400 : 200,
      contentType: "application/json",
      body: JSON.stringify(attempts === 1 ? { code: "INVALID_TOKEN" } : { status: true }),
    });
  });
  await page.goto("/reset-password?token=browser-test-token");
  await expect(page.getByRole("heading", { name: m.resetTitle })).toBeVisible();
  await page.getByLabel(m.resetNewPassword).fill("short");
  await page.getByLabel(m.confirmPasswordLabel).fill("different");
  await page.getByRole("button", { name: m.resetSubmit }).click();
  await expect(page.getByText(m.resetPasswordLength)).toBeVisible();
  await expect(page.getByText(m.passwordsDoNotMatch)).toBeVisible();
  expect(attempts).toBe(0);
  await page.getByLabel(m.resetNewPassword).fill("NewPassword123!");
  await page.getByLabel(m.confirmPasswordLabel).fill("NewPassword123!");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("reset-form.png"), fullPage: true });
  await page.getByRole("button", { name: m.resetSubmit }).click();
  await expect(page.getByRole("button", { name: m.resetSubmitting })).toBeDisabled();
  release();
  await expect(page.getByRole("alert").filter({ hasText: m.resetFailed })).toBeVisible();
  await page.getByRole("button", { name: m.resetSubmit }).click();
  await expect(page.getByRole("heading", { name: m.resetSuccessTitle })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("button", { name: m.resetSubmit })).toHaveCount(0);
  await page.getByRole("link", { name: m.backToLogin }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("shows unverified email guidance from the numeric API error envelope", async ({ page }) => {
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        error: { code: 403, message: "Email not verified" },
      }),
    }),
  );
  await page.goto("/login");
  await page.getByLabel(m.emailLabel, { exact: true }).fill("unverified@example.test");
  await page.getByLabel(m.passwordLabel, { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: m.loginButton, exact: true }).click();
  await expect(page.getByText(m.loginEmailNotVerified)).toBeVisible();
});
