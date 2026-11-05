import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function openComponents(page: Page) {
  // Load a separate Metro entry without adding a preview route to the product.
  await page.route("**/theme-preview", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="vi"><head>
      <title>Mobile components</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>html,body,#root{height:100%;margin:0}body{overflow:hidden}#root{display:flex;flex:1}</style>
      </head><body><div id="root"></div>
      <script src="/apps/mobile/e2e/theme-fixture.tsx.bundle?platform=web&dev=true&hot=false"></script>
      </body></html>`,
    }),
  );
  await page.goto("/theme-preview");
  await expect(page.getByRole("button", { name: "Đặt kho", exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

for (const [width, height] of [
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
]) {
  for (const landscape of [false, true]) {
    test(`components fit ${width}x${height} ${landscape ? "landscape" : "portrait"}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(landscape ? { width: height, height: width } : { width, height });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openComponents(page);
      const primary = page.getByRole("button", { name: "Đặt kho", exact: true });
      await expect(primary).toHaveCSS("background-color", "rgb(22, 95, 77)");
      expect((await primary.boundingBox())?.height).toBeGreaterThanOrEqual(48);
      await expect(primary.locator("div").first()).toHaveCSS("font-family", /BeVietnamPro-Bold/);
      const longAction = page.getByRole("button", {
        name: "Xem thông tin đặt kho và lịch hẹn nhận bàn giao tại cơ sở",
      });
      const box = await longAction.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= (landscape ? height : width)).toBeTruthy();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath("components.png") });
      const field = page.getByRole("textbox", { name: "Họ và tên", exact: true });
      await field.scrollIntoViewIfNeeded();
      await expect(field).toHaveCSS("font-family", /BeVietnamPro-Regular/);
      await page.screenshot({ path: testInfo.outputPath("fields.png") });
      expect(errors).toEqual([]);
    });
  }
}

test("actions, fields and selection states remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openComponents(page);
  await page.getByRole("button", { name: "Đặt kho", exact: true }).tap();
  await expect(page.getByText("Đã chọn đặt kho", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Chưa chọn cơ sở" })).toBeDisabled();
  const loading = page.getByRole("button", { name: "Đang thanh toán" });
  await expect(loading).toBeDisabled();
  await expect(loading).toHaveAttribute("aria-busy", "true");
  const input = page.getByRole("textbox", { name: "Họ và tên", exact: true });
  expect(await input.evaluate((element) => getComputedStyle(element, "::placeholder").color)).toBe(
    "rgb(100, 116, 139)",
  );
  await input.fill("Nguyễn Minh Anh");
  await expect(input).toHaveValue("Nguyễn Minh Anh");
  await expect(input).toHaveAttribute("aria-describedby", /description$/);
  await expect(page.getByRole("textbox", { name: "Mã khách hàng" })).not.toBeEditable();
  await page.getByRole("tab", { name: "Kho doanh nghiệp" }).tap();
  await expect(page.getByRole("tab", { name: "Kho doanh nghiệp" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Không thể chọn" })).toBeDisabled();
  const date = page.getByRole("button", { name: "2026-11-06", exact: true });
  await date.tap();
  await expect(date).toHaveAttribute("aria-pressed", "true");
  expect((await date.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("tab", { name: "Tìm kho", exact: true }).tap();
  await expect(page.getByRole("tab", { name: "Tìm kho", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("shared components meet WCAG A/AA checks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openComponents(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
