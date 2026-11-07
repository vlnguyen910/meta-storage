import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { checkoutMessages as m } from "../src/features/reservations/checkout.messages";

test("guest selects a future check-in date and a time slot", async ({ page }, testInfo) => {
  await page.goto("/reservations/new?facilityId=fac-hcm-central");
  await page.getByRole("button", { name: "Chọn loại này", exact: true }).first().click();
  await page.getByRole("button", { name: m.nextContact }).click();

  await expect(page.getByRole("heading", { name: m.contactTitle })).toBeVisible();
  for (let month = 1; month <= 12; month++) {
    await expect(page.getByRole("radio", { name: `${month} tháng`, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("radio", { name: "1 tháng", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "12 tháng", exact: true }).check();
  await expect(page.getByRole("radio", { name: "12 tháng", exact: true })).toBeChecked();
  await page.screenshot({
    path: `test-results/reservation-date-time-${testInfo.project.name}.png`,
    fullPage: true,
  });

  const { label, month, currentMonth } = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const tomorrow = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 1, 12));
    const date = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
    return {
      date,
      month: date.slice(0, 7),
      currentMonth: `${part("year")}-${String(part("month")).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(tomorrow),
    };
  });

  if (month !== currentMonth) {
    await page.getByRole("button", { name: m.datePickerNextMonth }).click();
  }

  const tomorrowButton = page.getByRole("button", {
    name: m.datePickerSelectDate(label),
  });
  await expect(tomorrowButton).toBeEnabled();
  await tomorrowButton.click();
  await expect(tomorrowButton).toHaveAttribute("aria-pressed", "true");

  const morningSlot = page.locator(
    'input[name="checkInSlotId"][value="11111111-1111-4111-8111-111111111111"]',
  );
  await expect(morningSlot).toBeVisible();
  await morningSlot.check();
  await expect(morningSlot).toBeChecked();
  await page.screenshot({
    path: `test-results/reservation-date-time-selected-${testInfo.project.name}.png`,
    fullPage: true,
  });

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
