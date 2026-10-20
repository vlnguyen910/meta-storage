import {
  accounts,
  and,
  db,
  eq,
  facilities,
  facilityAssignments,
  queryClient,
  users,
} from "@metastorage/database";
import { SEED_DEMO_USERS, SEED_USERS } from "@metastorage/database/demo-fixtures";
import { hashPassword } from "better-auth/crypto";
import { env } from "./config/env";
import { DEV_AUTH_PASSWORD } from "./dev/auth-fixtures";

// Account-only seed: do not rerun catalog, booking, payment or inventory fixtures.
try {
  if (env.NODE_ENV === "production") {
    throw new Error("Development facility account seeding is disabled in production");
  }
  const fixtures = [...SEED_USERS, ...SEED_DEMO_USERS].filter(
    (fixture) => fixture.role === "FACILITY_MANAGER" || fixture.role === "FACILITY_STAFF",
  );
  const password = await hashPassword(DEV_AUTH_PASSWORD);
  const result = await db.transaction(async (tx) => {
    const summary = { usersCreated: 0, credentialsCreated: 0, assignmentsCreated: 0 };
    for (const fixture of fixtures) {
      const suffix = fixture.email.match(/\.hcm(\d{2})@/);
      const facilityCode = `HCM-${suffix?.[1] ?? "01"}`;
      const [facility] = await tx
        .select({ id: facilities.id })
        .from(facilities)
        .where(and(eq(facilities.code, facilityCode), eq(facilities.isActive, true)));
      if (!facility) throw new Error(`Missing active facility ${facilityCode}`);

      let [user] = await tx.select().from(users).where(eq(users.email, fixture.email));
      if (!user) {
        [user] = await tx
          .insert(users)
          .values({ ...fixture, status: "ACTIVE", emailVerified: true })
          .returning();
        summary.usersCreated++;
      }
      if (!user || user.role !== fixture.role || user.status !== "ACTIVE" || !user.emailVerified) {
        throw new Error(`Existing user requires review: ${fixture.email}`);
      }
      // Legacy local fixtures have different UUIDs. Resolve by email and retain their IDs.
      const [active] = await tx
        .select()
        .from(facilityAssignments)
        .where(
          and(eq(facilityAssignments.userId, user.id), eq(facilityAssignments.isActive, true)),
        );
      if (
        active &&
        (active.facilityId !== facility.id || active.role !== fixture.role || active.endedAt)
      ) {
        throw new Error(`Existing assignment requires review: ${fixture.email}`);
      }
      if (!active) {
        const [historical] = await tx
          .select({ id: facilityAssignments.id })
          .from(facilityAssignments)
          .where(
            and(
              eq(facilityAssignments.userId, user.id),
              eq(facilityAssignments.facilityId, facility.id),
            ),
          );
        if (historical) throw new Error(`Historical assignment requires review: ${fixture.email}`);
        await tx.insert(facilityAssignments).values({
          userId: user.id,
          facilityId: facility.id,
          role: fixture.role,
          isActive: true,
        });
        summary.assignmentsCreated++;
      }
      const [credential] = await tx
        .select({ id: accounts.id, password: accounts.password })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));
      if (credential && !credential.password) {
        throw new Error(`Existing credential requires review: ${fixture.email}`);
      }
      if (!credential) {
        await tx.insert(accounts).values({
          id: `credential-${user.id}`,
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password,
        });
        summary.credentialsCreated++;
      }
    }
    return summary;
  });
  console.log("Facility development accounts ready", result);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await queryClient.end();
}
