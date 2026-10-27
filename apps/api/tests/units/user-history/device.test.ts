import { describe, expect, it } from "bun:test";
import { describeLoginDevice } from "../../../src/modules/user-history/login-device";

describe("login device description", () => {
  it("identifies iPhone without inventing a hardware model", () => {
    expect(
      describeLoginDevice(
        new Headers({
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        }),
      ),
    ).toEqual({ device: "iPhone", operatingSystem: "iOS", browser: "Safari", model: null });
  });
  it("extracts an Android model only when the client actually supplies it", () => {
    expect(
      describeLoginDevice(
        new Headers({
          "user-agent":
            "Mozilla/5.0 (Linux; Android 14; SM-S921B Build/UP1A) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
        }),
      ),
    ).toEqual({
      device: "Android phone",
      operatingSystem: "Android",
      browser: "Chrome",
      model: "SM-S921B",
    });
    expect(
      describeLoginDevice(
        new Headers({
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
        }),
      ).model,
    ).toBeNull();
  });
  it("bounds optional native model metadata and does not use it for authorization", () => {
    expect(
      describeLoginDevice(
        new Headers({ "x-device-model": "iPhone 15", "x-device-platform": "ios" }),
      ).model,
    ).toBe("iPhone 15");
    expect(
      describeLoginDevice(new Headers({ "x-device-model": "x".repeat(500) })).model?.length,
    ).toBe(120);
  });
  it("handles desktop and missing user agents", () => {
    expect(
      describeLoginDevice(
        new Headers({
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36 Edg/130.0",
        }),
      ).browser,
    ).toBe("Edge");
    expect(describeLoginDevice(new Headers())).toEqual({
      device: null,
      operatingSystem: null,
      browser: null,
      model: null,
    });
  });
});
