import { UserRole } from "@metastorage/database/schema/user-enums";
import { describe, expect, it } from "vitest";
import { roleHome, routes, safeReturnTo, storageEntryHref } from "./routes";

describe("storageEntryHref", () => {
  it("takes guests to login and returns customers to facilities after login", () => {
    const href = new URL(storageEntryHref(null), "http://localhost");
    expect(href.pathname).toBe(routes.login);
    expect(href.searchParams.get("returnTo")).toBe(routes.customer.facilities);
    expect(storageEntryHref(UserRole.STORAGE_CUSTOMER)).toBe(routes.customer.facilities);
  });

  it.each(Object.values(UserRole).filter((role) => role !== UserRole.STORAGE_CUSTOMER))(
    "keeps %s in their own workspace",
    (role) => expect(storageEntryHref(role)).toBe(roleHome[role]),
  );
});

describe("safeReturnTo", () => {
  it("accepts local application paths", () => {
    expect(safeReturnTo("/customer/reservations/new?facilityId=fac-1", "/fallback")).toBe(
      "/customer/reservations/new?facilityId=fac-1",
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeReturnTo("https://example.com", "/fallback")).toBe("/fallback");
    expect(safeReturnTo("//example.com", "/fallback")).toBe("/fallback");
    expect(safeReturnTo(null, "/fallback")).toBe("/fallback");
  });
});
