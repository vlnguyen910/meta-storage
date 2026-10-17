import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./routes";

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
