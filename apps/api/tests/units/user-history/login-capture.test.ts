import { describe, expect, it } from "bun:test";
import { captureSuccessfulLogin } from "../../../src/modules/user-history/login-capture";

const session = {
  id: "session-id",
  userId: "18500000-0000-4000-8000-000000000001",
  createdAt: new Date("2026-10-25T00:00:00Z"),
};

describe("successful login capture", () => {
  it("captures password and Google sign-ins, never session refresh/logout/signup", async () => {
    const events: unknown[] = [];
    const repository = {
      recordLogin: async (event: unknown) => {
        events.push(event);
      },
    };
    for (const path of [
      "/sign-in/email",
      "/callback/google",
      "/callback/:id",
      "/get-session",
      "/sign-out",
      "/sign-up/email",
    ]) {
      await captureSuccessfulLogin(
        repository,
        session,
        {
          path,
          providerId: "google",
          headers: new Headers({ "x-device-model": "iPhone 15", "x-device-platform": "ios" }),
        },
        () => {
          throw new Error("unexpected warning");
        },
      );
    }
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      sessionId: session.id,
      userId: session.userId,
      occurredAt: session.createdAt,
      model: "iPhone 15",
    });
    expect(events[0]).not.toHaveProperty("token");
  });

  it("does not interrupt a successful login when the log database is unavailable", async () => {
    let warnings = 0;
    await captureSuccessfulLogin(
      {
        recordLogin: async () => {
          throw new Error("unavailable");
        },
      },
      session,
      { path: "/sign-in/email", headers: new Headers() },
      () => {
        warnings += 1;
      },
    );
    expect(warnings).toBe(1);
  });
});
