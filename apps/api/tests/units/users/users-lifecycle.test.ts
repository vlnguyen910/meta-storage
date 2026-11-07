import { describe, expect, it } from "bun:test";
import { CreateUserInputSchema, UpdateUserRoleInputSchema } from "@metastorage/contracts";
import type { AuthService } from "../../../src/modules/auth/auth.service";
import type { UsersRepository } from "../../../src/modules/users/users.repository";
import { UsersService } from "../../../src/modules/users/users.service";

const id = "18500000-0000-4000-8000-000000000001";
const base = {
  id,
  name: "Staff",
  email: "staff@example.test",
  phone: null,
  role: "FACILITY_STAFF" as const,
  status: "ACTIVE" as const,
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fixture(overrides: Record<string, unknown> = {}, openWork = false) {
  const calls: string[] = [];
  const current = { ...base, ...overrides };
  const tx = {};
  const repository = {
    transaction: async (work: (connection: unknown) => Promise<unknown>) => work(tx),
    findByIdForUpdate: async () => current,
    hasOpenWork: async () => openWork,
    update: async (_id: string, input: object) => {
      calls.push("update");
      return { ...current, ...input };
    },
    deactivateAssignments: async () => {
      calls.push("deactivate assignments");
    },
    revokeSessions: async () => {
      calls.push("revoke sessions");
    },
  } as unknown as UsersRepository;
  return { service: new UsersService(repository, {} as AuthService), calls };
}

describe("approved user lifecycle", () => {
  it("rejects SYSTEM_ADMIN through management inputs", () => {
    expect(
      CreateUserInputSchema.safeParse({
        name: "Admin",
        email: "admin@example.test",
        password: "Password123",
        role: "SYSTEM_ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      }).success,
    ).toBe(false);
    expect(UpdateUserRoleInputSchema.safeParse({ role: "SYSTEM_ADMIN" }).success).toBe(false);
  });

  it("protects the bootstrap administrator and rejects promotion", async () => {
    await expect(
      fixture({ role: "SYSTEM_ADMIN" }).service.updateUser(id, { status: "INACTIVE" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      fixture({ role: "SYSTEM_ADMIN" }).service.updateUser(id, { role: "CUSTOMER" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(fixture().service.updateUser(id, { role: "SYSTEM_ADMIN" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("blocks locking or role change until assigned work is handed over", async () => {
    for (const input of [{ status: "INACTIVE" as const }, { role: "FACILITY_MANAGER" as const }]) {
      const { service, calls } = fixture({}, true);
      await expect(service.updateUser(id, input)).rejects.toMatchObject({ statusCode: 409 });
      expect(calls).toEqual([]);
    }
  });

  it("deactivates memberships and revokes all sessions after role change or lock", async () => {
    for (const input of [{ status: "INACTIVE" as const }, { role: "FACILITY_MANAGER" as const }]) {
      const { service, calls } = fixture();
      const user = await service.updateUser(id, input);
      expect(calls).toEqual(["update", "deactivate assignments", "revoke sessions"]);
      expect(user).not.toHaveProperty("password");
    }
  });

  it("keeps same-role updates and reactivation from revoking/restoring assignments", async () => {
    const same = fixture({}, true);
    await same.service.updateUser(id, { role: "FACILITY_STAFF" });
    expect(same.calls).toEqual(["update"]);
    const reactivated = fixture({ status: "INACTIVE" });
    await reactivated.service.updateUser(id, { status: "ACTIVE" });
    expect(reactivated.calls).toEqual(["update"]);
  });
});
