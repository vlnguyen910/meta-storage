import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

test.use({ actionTimeout: 10_000 });
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "customer@example.test",
  name: "Nguyễn Văn A",
  emailVerified: true,
  role: "CUSTOMER",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function mockApi(page: Page, initialRole?: string) {
  let role = initialRole;
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() ?? {};
    requests.push({ path, body });
    if (path.endsWith("/get-session")) {
      await route.fulfill({
        json: role
          ? {
              user: { ...user, role },
              session: {
                id: "session",
                token: "test-session",
                userId: user.id,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }
          : null,
      });
    } else if (path.endsWith("/sign-in/email")) {
      role = "CUSTOMER";
      await route.fulfill({ json: { token: "test-session", user, redirect: false } });
    } else if (path.endsWith("/sign-out")) {
      role = undefined;
      await route.fulfill({ json: { success: true } });
    } else if (
      path.endsWith("/customer-sign-up") ||
      path.endsWith("/request-password-reset") ||
      path.endsWith("/send-verification-email")
    ) {
      await route.fulfill({ json: { status: true, message: "OK" } });
    } else if (path.endsWith("/sign-in/social")) {
      await route.fulfill({
        status: 503,
        json: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable" },
      });
    } else {
      // Workspace APIs are outside this auth test; an explicit error keeps them out of the real API.
      await route.fulfill({
        status: 501,
        json: { error: { message: "Workspace API not modeled" } },
      });
    }
  });
  return requests;
}

async function openLogin(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

async function assertFits(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  const viewport = page.viewportSize();
  for (const action of await page.getByRole("button").all()) {
    const box = await action.boundingBox();
    expect(box && box.width >= 44 && box.height >= 44).toBeTruthy();
    expect(box && box.x >= 0 && box.x + box.width <= (viewport?.width ?? 0)).toBeTruthy();
  }
}

for (const [width, height] of [
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
]) {
  for (const landscape of [false, true]) {
    test(`auth fits ${width}x${height} ${landscape ? "landscape" : "portrait"}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(landscape ? { width: height, height: width } : { width, height });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockApi(page);
      await openLogin(page);
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
      await page.getByRole("button", { name: "Đăng ký ngay", exact: true }).tap();
      await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath("register.png"), fullPage: true });
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).tap();
      await page.getByRole("button", { name: "Quên mật khẩu?", exact: true }).tap();
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath("recovery.png"), fullPage: true });
      await page.getByRole("textbox", { name: "Email liên kết" }).fill("customer@example.test");
      await page.getByRole("button", { name: "Gửi liên kết khôi phục", exact: true }).tap();
      await expect(page.getByText(/Nếu email tồn tại/)).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test("startup opens login, validates credentials and supports password visibility", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await openLogin(page);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).tap();
  await expect(page.getByText("Vui lòng nhập địa chỉ email hợp lệ.")).toBeVisible();
  expect(calls.some((call) => call.path.endsWith("/sign-in/email"))).toBe(false);
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await password.fill("example-password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).tap();
  await expect(password).toHaveJSProperty("type", "text");
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).tap();
  await expect(password).toHaveAttribute("type", "password");
});

test("register submits the shared contract with optional phone and can resend verification", async ({
  page,
}) => {
  await page.clock.install();
  const calls = await mockApi(page);
  await openLogin(page);
  await page.getByRole("button", { name: "Đăng ký ngay", exact: true }).tap();
  await page.getByRole("button", { name: "Đăng ký", exact: true }).tap();
  await expect(page.getByText("Vui lòng nhập họ và tên.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email *", exact: true })
    .fill("  Customer@Example.test  ");
  await page.getByLabel("Mật khẩu *", { exact: true }).fill("example-password");
  await page.getByRole("textbox", { name: "Họ và tên *", exact: true }).fill("Nguyễn Văn A");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Kiểm tra email của bạn" })).toBeVisible();
  const body = calls.find((call) => call.path.endsWith("/customer-sign-up"))?.body;
  expect(body).toEqual({
    name: "Nguyễn Văn A",
    email: "customer@example.test",
    password: "example-password",
    confirmPassword: "example-password",
    callbackTarget: "mobile",
  });
  await expect(page.getByRole("button", { name: /Gửi lại email \(/ })).toBeDisabled();
  await page.clock.runFor(46000);
  await page.getByRole("button", { name: "Gửi lại email xác minh", exact: true }).tap();
  await expect(page.getByText(/Đã gửi lại email xác minh/)).toBeVisible();
  expect(calls.find((call) => call.path.endsWith("/send-verification-email"))?.body).toEqual({
    email: "customer@example.test",
    callbackURL: "metastorage://auth/verified",
  });
});

test("login routes to the workspace and sign-out returns directly to login", async ({ page }) => {
  await mockApi(page);
  await openLogin(page);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(user.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
});

test("restores a staff session without a login or landing page", async ({ page }) => {
  await mockApi(page, "FACILITY_STAFF");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Công việc của tôi", exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toHaveCount(0);
});

test("handles unverified email, server errors, recovery and Google failures", async ({ page }) => {
  await mockApi(page);
  await page.route("**/sign-in/email", (route) =>
    route.fulfill({ status: 403, json: { code: "EMAIL_NOT_VERIFIED", message: "Verify email" } }),
  );
  await openLogin(page);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(user.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Kiểm tra email của bạn" })).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục đăng nhập" }).tap();
  await page.getByRole("button", { name: "Tiếp tục với Google" }).tap();
  await expect(page.getByText(/Chưa thể đăng nhập với Google/)).toBeVisible();
  await page.getByRole("button", { name: "Quên mật khẩu?", exact: true }).tap();
  await page.route("**/request-password-reset", (route) =>
    route.fulfill({ status: 503, json: { message: "Thử lại sau" } }),
  );
  await page.getByRole("textbox", { name: "Email liên kết" }).fill(user.email);
  await page.getByRole("button", { name: "Gửi liên kết khôi phục", exact: true }).tap();
  await expect(page.getByText("Thử lại sau", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gửi liên kết khôi phục", exact: true }),
  ).toBeEnabled();
});

test("auth pages pass WCAG A/AA", async ({ page }) => {
  await mockApi(page);
  await openLogin(page);
  for (const destination of [undefined, "Đăng ký ngay", "Đăng nhập", "Quên mật khẩu?"]) {
    if (destination) await page.getByRole("button", { name: destination, exact: true }).tap();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});

async function openPreview(page: Page, query: string) {
  await page.route("**/authentication-preview?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="vi"><head><title>Auth callback</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}body{overflow:hidden}#root{display:flex;flex:1}</style></head><body><div id="root"></div><script src="/apps/mobile/e2e/authentication-fixture.tsx.bundle?platform=web&dev=true&hot=false"></script></body></html>`,
    }),
  );
  await page.goto(`/authentication-preview?${query}`);
}

test("offline demo also starts at the new login and keeps home and logout away from landing", async ({
  page,
}) => {
  await openPreview(page, "demo=1");
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("customer@metastorage.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("12345678");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trang chủ", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#M-C01$/);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
});

for (const failed of [false, true]) {
  test(`verification callback ${failed ? "expired" : "returned"} preserves the login requirement`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPreview(
      page,
      `callback=${encodeURIComponent(`metastorage://auth/verified${failed ? "?error=token_expired" : ""}`)}`,
    );
    await expect(
      page.getByRole("heading", {
        name: failed ? "Liên kết không hợp lệ" : "Đã mở liên kết xác minh",
      }),
    ).toBeVisible({ timeout: 120_000 });
    await assertFits(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath("verification.png") });
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Tiếp tục đăng nhập" }).tap();
    await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  });
}
