import { describe, expect, test } from "bun:test";
import { providerEnvSchema } from "../../src/config/provider-env";

const cloudinary = {
  CLOUDINARY_CLOUD_NAME: "cloud",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
};

describe("required Cloudinary and optional Google configuration", () => {
  test("absent/blank providers allow password-only operation", () => {
    expect(
      providerEnvSchema.parse({ ...cloudinary, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: " " }),
    ).toMatchObject({
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    expect(providerEnvSchema.safeParse(cloudinary).success).toBe(true);
    expect(providerEnvSchema.safeParse({}).success).toBe(false);
  });
  test("rejects incomplete Google and Cloudinary credentials", () => {
    for (const values of [
      { ...cloudinary, GOOGLE_CLIENT_ID: "id" },
      { ...cloudinary, GOOGLE_CLIENT_SECRET: "secret" },
      { CLOUDINARY_CLOUD_NAME: "cloud" },
      { CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" },
    ])
      expect(providerEnvSchema.safeParse(values).success).toBe(false);
  });
  test("accepts complete credentials", () => {
    expect(
      providerEnvSchema.safeParse({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        CLOUDINARY_CLOUD_NAME: "cloud",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
      }).success,
    ).toBe(true);
  });
});
