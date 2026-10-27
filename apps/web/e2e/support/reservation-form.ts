import type { Page } from "@playwright/test";
import { checkoutMessages } from "../../src/features/reservations/checkout.messages";

export async function selectCheckInDate(page: Page, value: string) {
  const targetMonth = value.slice(0, 7);
  const targetCalendar = page.locator(`[data-calendar-month="${targetMonth}"]`);

  for (let month = 0; month < 72 && !(await targetCalendar.count()); month++) {
    await page.getByRole("button", { name: checkoutMessages.datePickerNextMonth }).click();
  }

  await page.locator(`[data-calendar-date="${value}"]`).click();
}

export async function tomorrowInVietnam(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const date = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + 1, 12));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}
