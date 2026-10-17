import { db, queryClient } from "./client";
import { PRICING_SETTINGS_ID, pricingSettings } from "./schema/pricing";

export async function seedPricingPolicy() {
  // Approved initial policy: one month of rent. Never a runtime quote fallback.
  // Existing settings are preserved when demo/deployment seeding is repeated.
  await db
    .insert(pricingSettings)
    .values({ id: PRICING_SETTINGS_ID, depositMonths: 1, version: 1 })
    .onConflictDoNothing();
}

if (import.meta.main) {
  try {
    await seedPricingPolicy();
  } finally {
    await queryClient.end();
  }
}
