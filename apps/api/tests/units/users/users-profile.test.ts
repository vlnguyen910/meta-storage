import { describe, expect, it } from "bun:test";
import { UpdateOwnProfileInputSchema } from "@metastorage/contracts";
import { toUserDto } from "../../../src/modules/users/users.dto";

describe("own profile boundary", () => {
  it("normalizes editable fields and rejects privilege or identity changes", () => {
    expect(UpdateOwnProfileInputSchema.parse({ name: "  Nguyen An  ", phone: null })).toEqual({
      name: "Nguyen An",
      phone: null,
    });
    for (const field of ["email", "role", "status", "password", "userId"]) {
      expect(
        UpdateOwnProfileInputSchema.safeParse({ name: "An", [field]: "forbidden" }).success,
      ).toBe(false);
    }
    expect(UpdateOwnProfileInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateOwnProfileInputSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("returns only public profile fields even if the stored record contains secrets", () => {
    const user = {
      id: "user",
      name: "An",
      email: "an@example.test",
      phone: null,
      role: "CUSTOMER" as const,
      status: "ACTIVE" as const,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: "private",
      token: "private",
      password: "private",
    };
    const dto = toUserDto(user);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "name",
        "email",
        "phone",
        "role",
        "status",
        "emailVerified",
        "image",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });
});
