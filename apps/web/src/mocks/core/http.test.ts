import { describe, expect, it } from "vitest";
import { addMonths } from "./http";

describe("rental end date formatting", () => {
  it("keeps ISO date-time drafts as date-times", () => {
    expect(addMonths("2026-10-03T02:00:00.000Z", 3)).toBe("2027-01-03T02:00:00.000Z");
  });
  it("keeps legacy date-only quotes as dates", () => {
    expect(addMonths("2026-10-03", 3)).toBe("2027-01-03");
  });
});
