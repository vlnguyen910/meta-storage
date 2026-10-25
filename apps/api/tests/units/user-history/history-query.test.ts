import { describe, expect, it } from "bun:test";
import { LoginHistoryQuerySchema, UserActivityLogQuerySchema } from "@metastorage/contracts";

describe("history query boundaries", () => {
  it("bounds pagination and requires a valid timezone-aware ordered date range", () => {
    for (const schema of [LoginHistoryQuerySchema, UserActivityLogQuerySchema]) {
      expect(schema.parse({})).toEqual({ limit: 20, offset: 0 });
      for (const input of [
        { limit: 101 },
        { offset: -1 },
        { offset: 100001 },
        { from: "2026-10-25" },
        { from: "2026-10-25T10:00:00Z", to: "2026-10-25T09:00:00Z" },
        { from: "2026-10-25T10:00:00+07:00", to: "2026-10-25T02:00:00Z" },
      ])
        expect(schema.safeParse(input).success).toBe(false);
      expect(
        schema.safeParse({ from: "2026-10-25T10:00:00+07:00", to: "2026-10-25T03:00:00Z" }).success,
      ).toBe(true);
    }
  });
  it("does not accept failure/logout filters or arbitrary metadata searches", () => {
    expect(LoginHistoryQuerySchema.safeParse({ outcome: "FAILURE" }).success).toBe(false);
    expect(LoginHistoryQuerySchema.safeParse({ eventType: "LOGOUT" }).success).toBe(false);
    expect(UserActivityLogQuerySchema.safeParse({ password: "private" }).success).toBe(false);
  });
});
