import { randomUUID } from "node:crypto";
import {
  accounts,
  and,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityUnitTypes,
  queryClient,
  storageUnits,
  unitTypes,
  users,
} from "@metastorage/database";
import { hashPassword, verifyPassword } from "better-auth/crypto";

const email = "staff@metastorage.test";
const password = "Demo@123";
const unitTypeCodes = [
  "UT-2M",
  "UT-2M",
  "UT-2M",
  "UT-4M",
  "UT-4M",
  "UT-4M",
  "UT-6M",
  "UT-6M",
  "UT-AC-4M",
  "UT-AC-4M",
];

async function seedFlow2Demo() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed must not run in production.");
  }
  const passwordHash = await hashPassword(password);
  const result = await db.transaction(async (tx) => {
    const [facility] = await tx
      .select()
      .from(facilities)
      .where(eq(facilities.code, "HCM-01"))
      .for("update");
    if (!facility?.isActive) throw new Error("Active HCM-01 facility is required.");
    const types = await tx
      .select({ code: unitTypes.code, id: unitTypes.id })
      .from(unitTypes)
      .innerJoin(facilityUnitTypes, eq(facilityUnitTypes.unitTypeId, unitTypes.id))
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facility.id),
          eq(unitTypes.isActive, true),
          eq(facilityUnitTypes.isActive, true),
        ),
      );
    const typeMap = new Map(types.map((type) => [type.code, type.id]));
    for (const code of unitTypeCodes) {
      if (!typeMap.has(code)) throw new Error(`Missing active unit type: ${code}`);
    }

    const [staff] = await tx
      .insert(users)
      .values({
        email,
        name: "Trần Quốc Huy (Facility Staff)",
        role: "FACILITY_STAFF",
        status: "ACTIVE",
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          role: "FACILITY_STAFF",
          status: "ACTIVE",
          emailVerified: true,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!staff) throw new Error("Staff seed failed.");
    const [credential] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, staff.id), eq(accounts.providerId, "credential")));
    if (credential) {
      await tx
        .update(accounts)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(accounts.id, credential.id));
    } else {
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId: staff.id,
        accountId: staff.id,
        providerId: "credential",
        password: passwordHash,
      });
    }
    await tx
      .insert(facilityAssignments)
      .values({
        userId: staff.id,
        facilityId: facility.id,
        role: "FACILITY_STAFF",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [facilityAssignments.userId, facilityAssignments.facilityId],
        set: { role: "FACILITY_STAFF", isActive: true, endedAt: null },
      });

    let added = 0;
    for (const [index, typeCode] of unitTypeCodes.entries()) {
      const code = `HCM-01-${String(index + 9).padStart(3, "0")}`;
      const typeId = typeMap.get(typeCode);
      if (!typeId) throw new Error(`Missing unit type: ${typeCode}`);
      const inserted = await tx
        .insert(storageUnits)
        .values({
          code,
          facilityId: facility.id,
          unitTypeId: typeId,
          status: "AVAILABLE",
          floor: "Tầng trệt",
          locationDescription: `Khu demo Flow 2 · ${code}`,
        })
        .onConflictDoNothing({ target: storageUnits.code })
        .returning({ id: storageUnits.id });
      added += inserted.length;
      const [unit] = await tx.select().from(storageUnits).where(eq(storageUnits.code, code));
      if (unit?.facilityId !== facility.id || unit.unitTypeId !== typeId) {
        throw new Error(`Existing unit ${code} belongs to a different facility or type.`);
      }
    }
    return { staffId: staff.id, facility: facility.name, added };
  });

  const [credential] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, result.staffId), eq(accounts.providerId, "credential")));
  if (!credential?.password || !(await verifyPassword({ hash: credential.password, password }))) {
    throw new Error("Seeded credential verification failed.");
  }
  console.log({
    email,
    role: "FACILITY_STAFF",
    facility: result.facility,
    addedUnits: result.added,
  });
  console.log("Credential verified. Demo units: HCM-01-009 through HCM-01-018.");
}

seedFlow2Demo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => queryClient.end());
