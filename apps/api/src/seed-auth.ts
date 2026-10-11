import { accounts, and, db, eq, queryClient, users } from "@metastorage/database";
import { hashPassword } from "better-auth/crypto";
import { env } from "./config/env";
import { DEV_AUTH_ACCOUNTS, DEV_AUTH_PASSWORD } from "./dev/auth-fixtures";

try {
  if (env.NODE_ENV === "production") {
    throw new Error("Development auth seeding is disabled in production");
  }

  const password = await hashPassword(DEV_AUTH_PASSWORD);
  await db.transaction(async (tx) => {
    for (const fixture of DEV_AUTH_ACCOUNTS) {
      const [user] = await tx.select().from(users).where(eq(users.email, fixture.email));
      if (
        !user ||
        user.id !== fixture.id ||
        user.role !== fixture.role ||
        !user.emailVerified ||
        user.status !== "ACTIVE"
      ) {
        throw new Error(
          `Run bun run db:seed first: ${fixture.email} must be active and verified with role ${fixture.role}`,
        );
      }

      const credentialFilter = and(
        eq(accounts.userId, user.id),
        eq(accounts.providerId, "credential"),
      );
      const [credential] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(credentialFilter);
      if (credential) {
        await tx.update(accounts).set({ password, updatedAt: new Date() }).where(credentialFilter);
      } else {
        await tx.insert(accounts).values({
          id: `credential-${fixture.id}`,
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password,
        });
      }
    }
  });
  console.log("Development credentials prepared for all four Swagger role examples.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await queryClient.end();
}
