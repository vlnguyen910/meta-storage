import { CreateRentalRenewalSchema } from "@metastorage/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { renewalCommandKey } from "./renewal.hooks";

describe("renewal command recovery", () => {
  beforeEach(() => localStorage.clear());
  it("reuses the command after reload without sharing it across customers or requests", () => {
    const key = renewalCommandKey("customer-a", "rental:quote:3");
    expect(renewalCommandKey("customer-a", "rental:quote:3")).toBe(key);
    expect(renewalCommandKey("customer-b", "rental:quote:3")).not.toBe(key);
    expect(renewalCommandKey("customer-a", "rental:quote:4")).not.toBe(key);
    expect(CreateRentalRenewalSchema.safeParse({ months: 3, idempotencyKey: key }).success).toBe(
      true,
    );
  });
});
