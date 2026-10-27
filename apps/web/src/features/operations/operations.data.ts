import { api } from "@/lib/api";
import { REPORTING_MESSAGES as R } from "./operations-reporting.messages";

export async function loadActiveFacilities() {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api.facilities.listActive({ limit: 100, offset });
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}
export async function loadPricingConfiguration() {
  const config = await api.pricing.getConfiguration({ limit: 100 });
  for (let offset = 100; config.prices.length === offset; offset += 100) {
    const page = await api.pricing.getConfiguration({ limit: 100, offset });
    if (page.version !== config.version) throw new Error(R.reloadError);
    config.prices.push(...page.prices);
  }
  return config;
}
