import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("shows labeled login action and no guest storage lookup action in the public header", async ({
  page,
}) => {
  await page.goto("/");

  const header = page.locator("header");
  const lookup = header.getByRole("link", { name: /Tra cứu kho/ });
  const login = header.getByRole("link", { name: "Đăng nhập", exact: true });
  await expect(lookup).toHaveCount(0);
  await expect(login).toBeVisible();
  await expect(login).toHaveAttribute("href", "/login");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
