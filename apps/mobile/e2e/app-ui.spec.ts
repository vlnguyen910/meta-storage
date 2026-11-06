import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

test.use({ actionTimeout: 10_000 });

async function openFoundation(page: Page) {
  await page.route("**/foundation-preview", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="vi"><head><title>Mobile foundation</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>html,body,#root{height:100%;margin:0}body{overflow:hidden}#root{display:flex;flex:1}</style>
      </head><body><div id="root"></div>
      <script src="/apps/mobile/e2e/app-ui-fixture.tsx.bundle?platform=web&dev=true&hot=false"></script>
      </body></html>`,
    }),
  );
  await page.goto("/foundation-preview");
  await expect(page.getByRole("button", { name: "Tìm kho", exact: true })).toBeVisible({
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
    test(`foundation fits ${width}x${height} ${landscape ? "landscape" : "portrait"}`, async ({
      page,
    }, testInfo) => {
      const viewport = landscape ? { width: height, height: width } : { width, height };
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openFoundation(page);
      const tabs = page.getByRole("tablist", { name: "Điều hướng chính" });
      await expect(tabs.getByRole("tab")).toHaveCount(3);
      for (const label of ["Trang chủ", "Kho của tôi", "Tài khoản"]) {
        const tab = tabs.getByRole("tab", { name: label, exact: true });
        await expect(tab).toBeVisible();
        const box = await tab.boundingBox();
        expect(box && box.height >= 44 && box.width >= 44).toBeTruthy();
        expect(
          box &&
            box.x >= 0 &&
            box.x + box.width <= viewport.width &&
            box.y + box.height <= viewport.height,
        ).toBeTruthy();
      }
      const bell = page.getByRole("button", { name: "Thông báo", exact: true });
      expect((await bell.boundingBox())?.width).toBeGreaterThanOrEqual(44);
      const logo = page.getByRole("button", { name: "Về trang chủ" }).locator("img");
      await expect
        .poll(() =>
          logo.evaluate(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        )
        .toBeTruthy();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath("foundation.png") });
      expect(errors).toEqual([]);
    });
  }
}

test("header actions, back and three controlled tabs work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFoundation(page);
  await page.getByRole("button", { name: "Thông báo", exact: true }).tap();
  await expect(page.getByTestId("foundation-feedback")).toHaveText("Đã mở thông báo");
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).tap();
  await page.getByRole("button", { name: "Quay lại", exact: true }).tap();
  await expect(page.getByTestId("foundation-feedback")).toHaveText("Đã quay lại");
  const profile = page.getByRole("tab", { name: "Tài khoản", exact: true });
  await profile.tap();
  await expect(profile).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Trang chủ", exact: true })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await page.getByRole("tab", { name: "Kho của tôi", exact: true }).tap();
  await expect(page.getByRole("tab", { name: "Kho của tôi", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "Về trang chủ" }).tap();
  await expect(page.getByRole("tab", { name: "Trang chủ", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "Yêu cầu hỗ trợ", exact: true }).tap();
  await expect(page.getByTestId("foundation-feedback")).toHaveText("Đã mở yêu cầu hỗ trợ");
});

test("search supports typing, submit, clear and disabled states", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFoundation(page);
  const input = page.getByRole("textbox", { name: "Tìm cơ sở kho", exact: true });
  await input.fill("  Sài Gòn  ");
  await expect(input).toHaveValue("  Sài Gòn  ");
  await input.press("Enter");
  await expect(page.getByTestId("foundation-feedback")).toHaveText("Tìm: Sài Gòn");
  const clear = page.getByRole("button", { name: "Xóa nội dung tìm kiếm" });
  expect((await clear.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  await clear.tap();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(clear).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Tìm kiếm đang tắt" })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Thông báo đang tắt" })).toBeDisabled();
});

test("foundation passes WCAG A/AA checks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFoundation(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
