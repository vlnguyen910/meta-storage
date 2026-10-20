import { afterAll, beforeAll, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  CONTRACT_PDF_MAX_BYTES,
  HANDOVER_CHECKLIST_ITEMS,
  INSPECTION_CHECKLIST_VERSION,
} from "@metastorage/contracts";
import {
  accounts,
  bookingContractAudit,
  bookingContracts,
  bookings,
  checkInSlots,
  checkInVerifications,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityUnitTypes,
  handoverInspections,
  inArray,
  notificationOutbox,
  payments,
  queryClient,
  rentals,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { PDFDocument } from "pdf-lib";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { ContractsRepository } from "../../src/modules/contracts/contracts.repository";
import { contractsRoutes } from "../../src/modules/contracts/contracts.routes";
import { ContractsService } from "../../src/modules/contracts/contracts.service";
import type { ContractTransaction } from "../../src/modules/contracts/contracts.types";
import { InspectionsRepository } from "../../src/modules/inspections/inspections.repository";
import { inspectionsRoutes } from "../../src/modules/inspections/inspections.routes";
import { InspectionsService } from "../../src/modules/inspections/inspections.service";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const app = Fastify();
const roles = {
  owner: "CUSTOMER",
  other: "CUSTOMER",
  fm: "FACILITY_MANAGER",
  otherFm: "FACILITY_MANAGER",
  fs: "FACILITY_STAFF",
  otherFs: "FACILITY_STAFF",
  admin: "SYSTEM_ADMIN",
  bom: "BUSINESS_OPERATION_MANAGER",
} as const;
const ids = Object.fromEntries(Object.keys(roles).map((key) => [key, randomUUID()])) as Record<
  keyof typeof roles,
  string
>;
const cookies = {} as Record<keyof typeof roles, string>;
const fixture = {
  facility: randomUUID(),
  otherFacility: randomUUID(),
  type: randomUUID(),
  slot: randomUUID(),
};
const objects = new Map<string, Uint8Array>();
let pdf: Uint8Array;
let readyForCleanup = false;
let failGet = false;
let interceptGet: (() => Promise<void>) | undefined;
let interceptPut: (() => Promise<void>) | undefined;
const storage = {
  async put(key: string, bytes: Uint8Array) {
    objects.set(key, bytes);
    const hook = interceptPut;
    interceptPut = undefined;
    if (hook) await hook();
  },
  async get(key: string) {
    const hook = interceptGet;
    interceptGet = undefined;
    if (hook) await hook();
    if (failGet || !objects.has(key)) throw new Error("Object unavailable");
    return new Uint8Array(objects.get(key));
  },
  async remove(key: string) {
    objects.delete(key);
  },
};
async function api(
  who: keyof typeof roles | null,
  method: "GET" | "POST",
  path: string,
  payload?: unknown,
) {
  return app.inject({
    method,
    url: `/api${path}`,
    headers: who ? { cookie: cookies[who] } : {},
    payload,
  });
}
async function scenario() {
  const bookingId = randomUUID(),
    unitId = randomUUID(),
    assignmentId = randomUUID(),
    verificationId = randomUUID(),
    inspectionId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(storageUnits).values({
      id: unitId,
      code: unitId,
      facilityId: fixture.facility,
      unitTypeId: fixture.type,
      status: "RESERVED",
    });
    await tx.insert(bookings).values({
      id: bookingId,
      userId: ids.owner,
      contactName: "MVP customer",
      contactEmail: "contact@example.test",
      contactPhone: "0900000000",
      facilityId: fixture.facility,
      unitTypeId: fixture.type,
      requestedMonths: 1,
      checkInDate: "2032-06-01",
      checkInSlotId: fixture.slot,
      rentalEndAt: new Date("2032-07-01T03:00:00Z"),
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "500000",
      totalAmount: "1500000",
      status: "CONFIRMED",
      assignedStaffId: ids.fs,
    });
    await tx
      .insert(unitAssignments)
      .values({ id: assignmentId, bookingId, physicalUnitId: unitId, assignedBy: ids.fm });
    await tx.insert(checkInVerifications).values({
      id: verificationId,
      bookingId,
      facilityId: fixture.facility,
      staffId: ids.fs,
      unitAssignmentId: assignmentId,
    });
    const paymentId = randomUUID();
    await tx.insert(payments).values({
      id: paymentId,
      bookingId,
      holdTokenHash: "fixture",
      provider: "mock",
      paymentCode: paymentId.replaceAll("-", ""),
      providerPaymentId: paymentId,
      idempotencyKey: paymentId,
      totalAmount: "1500000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date("2032-05-30"),
    });
    await tx.insert(handoverInspections).values({
      id: inspectionId,
      bookingId,
      facilityId: fixture.facility,
      physicalUnitId: unitId,
      unitAssignmentId: assignmentId,
      verificationId,
      unitCode: unitId,
      createdBy: ids.fs,
      completedBy: ids.fs,
      completedAt: new Date(),
      status: "COMPLETED",
      correctUnit: true,
      checklistVersion: INSPECTION_CHECKLIST_VERSION,
      checklistDefinition: [...HANDOVER_CHECKLIST_ITEMS],
      checklistResults: HANDOVER_CHECKLIST_ITEMS.map((item) => ({
        itemCode: item.code,
        resultType: "PASS_FAIL" as const,
        result: "PASS" as const,
        note: null,
        photos: [],
      })),
    });
  });
  return { bookingId, unitId, inspectionId };
}
function upload(
  bookingId: string,
  options: { who?: keyof typeof roles; bytes?: Uint8Array; key?: string } = {},
) {
  return api(options.who ?? "fm", "POST", `/bookings/${bookingId}/contracts`, {
    filename: "Hợp đồng.pdf",
    mimeType: "application/pdf",
    dataBase64: Buffer.from(options.bytes ?? pdf).toString("base64"),
    idempotencyKey: options.key ?? randomUUID(),
  });
}
function issue(
  bookingId: string,
  contractId: string,
  expected: string | null = null,
  who: keyof typeof roles = "fm",
) {
  return api(who, "POST", `/bookings/${bookingId}/contracts/${contractId}/issue`, {
    expectedCurrentIssuedId: expected,
  });
}
function handover(inspectionId: string, who: keyof typeof roles = "fs") {
  return api(who, "POST", `/inspections/${inspectionId}/handover`, { version: 0 });
}

describe.skipIf(!target)("contract PDFs and physical handover on existing local PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(target as string);
    if (
      process.env.DATABASE_URL !== target ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.port !== "5433" ||
      url.pathname !== "/metastorage"
    )
      throw new Error("Existing local container only");
    setSystemTime(new Date("2032-06-01T03:00:00Z"));
    const doc = await PDFDocument.create();
    doc.addPage([500, 700]).drawText("STOREX contract fixture");
    pdf = await doc.save();
    const hashed = await (await auth.$context).password.hash("ContractTest123!");
    readyForCleanup = true;
    await db.transaction(async (tx) => {
      for (const [key, role] of Object.entries(roles)) {
        const id = ids[key as keyof typeof roles];
        await tx.insert(users).values({
          id,
          name: "Contract test",
          email: `${id}@example.test`,
          role,
          status: "ACTIVE",
          emailVerified: true,
        });
        await tx.insert(accounts).values({
          id: randomUUID(),
          userId: id,
          accountId: id,
          providerId: "credential",
          password: hashed,
        });
      }
      await tx.insert(facilities).values([
        {
          id: fixture.facility,
          code: fixture.facility,
          name: "Contract test",
          address: "Local test",
        },
        {
          id: fixture.otherFacility,
          code: fixture.otherFacility,
          name: "Other contract test",
          address: "Local test",
        },
      ]);
      for (const key of ["fm", "fs", "otherFs", "otherFm"] as const)
        await tx.insert(facilityAssignments).values({
          userId: ids[key],
          facilityId: key === "otherFm" ? fixture.otherFacility : fixture.facility,
          role: roles[key],
        });
      await tx.insert(unitTypes).values({
        id: fixture.type,
        code: fixture.type,
        name: "MVP type",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });
      await tx
        .insert(facilityUnitTypes)
        .values({ facilityId: fixture.facility, unitTypeId: fixture.type });
      await tx
        .insert(checkInSlots)
        .values({ id: fixture.slot, name: "Contract test", startTime: "09:00", endTime: "10:30" });
    });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    app.decorate("db", db);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api" });
    await app.register(contractsRoutes, { prefix: "/api", storage });
    await app.register(inspectionsRoutes, { prefix: "/api", contractStorage: storage });
    await app.ready();
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const r = await api(null, "POST", "/auth/sign-in/email", {
        email: `${ids[key]}@example.test`,
        password: "ContractTest123!",
      });
      expect(r.statusCode).toBe(200);
      cookies[key] = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    }
  });
  afterAll(async () => {
    setSystemTime();
    try {
      await app.close();
      if (!readyForCleanup) return;
      await db.transaction(async (tx) => {
        const scoped = tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.facilityId, fixture.facility));
        await tx
          .delete(bookingContractAudit)
          .where(inArray(bookingContractAudit.bookingId, scoped));
        await tx.delete(handoverInspections).where(inArray(handoverInspections.bookingId, scoped));
        await tx.delete(bookingContracts).where(inArray(bookingContracts.bookingId, scoped));
        await tx.delete(notificationOutbox).where(inArray(notificationOutbox.bookingId, scoped));
        await tx.delete(rentals).where(inArray(rentals.bookingId, scoped));
        await tx
          .delete(checkInVerifications)
          .where(inArray(checkInVerifications.bookingId, scoped));
        await tx.delete(unitAssignments).where(inArray(unitAssignments.bookingId, scoped));
        await tx.delete(payments).where(inArray(payments.bookingId, scoped));
        await tx.delete(bookings).where(eq(bookings.facilityId, fixture.facility));
        await tx.delete(storageUnits).where(eq(storageUnits.facilityId, fixture.facility));
        await tx
          .delete(facilityUnitTypes)
          .where(eq(facilityUnitTypes.facilityId, fixture.facility));
        await tx
          .delete(facilityAssignments)
          .where(inArray(facilityAssignments.userId, Object.values(ids)));
        await tx
          .delete(facilities)
          .where(inArray(facilities.id, [fixture.facility, fixture.otherFacility]));
        await tx.delete(unitTypes).where(eq(unitTypes.id, fixture.type));
        await tx.delete(checkInSlots).where(eq(checkInSlots.id, fixture.slot));
        await tx.delete(users).where(inArray(users.id, Object.values(ids)));
      });
    } finally {
      await queryClient.end();
    }
  });

  test("upload is FM-scoped and does not issue; owner cannot read unpublished PDFs", async () => {
    const f = await scenario();
    expect((await api(null, "GET", `/bookings/${f.bookingId}/contracts`)).statusCode).toBe(401);
    for (const who of ["owner", "fs", "otherFm", "admin", "bom"] as const)
      expect((await upload(f.bookingId, { who })).statusCode).toBe(403);
    const r = await upload(f.bookingId);
    expect(r.statusCode).toBe(201);
    expect(r.json().data.status).toBe("UPLOADED");
    expect(r.json().data.issuedAt).toBeNull();
    const id = r.json().data.id;
    expect((await api("owner", "GET", `/bookings/${f.bookingId}/contracts`)).json().data).toEqual(
      [],
    );
    expect(
      (await api("owner", "GET", `/bookings/${f.bookingId}/contracts/${id}/pdf`)).statusCode,
    ).toBe(404);
    expect((await handover(f.inspectionId)).statusCode).toBe(409);
    expect(await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId))).toHaveLength(
      0,
    );
  });

  test("issue requires backend-verified successful payment and complete existing booking data", async () => {
    const f = await scenario(),
      r = await upload(f.bookingId),
      id = r.json().data.id;
    await db
      .update(payments)
      .set({ status: "PENDING", paidAt: null })
      .where(eq(payments.bookingId, f.bookingId));
    expect((await issue(f.bookingId, id)).statusCode).toBe(409);
    await db.update(payments).set({ status: "FAILED" }).where(eq(payments.bookingId, f.bookingId));
    expect((await issue(f.bookingId, id)).statusCode).toBe(409);
    await db
      .update(payments)
      .set({ status: "SUCCEEDED", paidAt: new Date() })
      .where(eq(payments.bookingId, f.bookingId));
    await db.update(bookings).set({ contactName: " " }).where(eq(bookings.id, f.bookingId));
    expect((await issue(f.bookingId, id)).statusCode).toBe(422);
    await db
      .update(bookings)
      .set({ contactName: "MVP customer" })
      .where(eq(bookings.id, f.bookingId));
    const issued = await issue(f.bookingId, id);
    expect(issued.statusCode).toBe(200);
    expect(issued.json().data.status).toBe("ISSUED");
    expect(issued.json().data.terms.contactEmail).toBe("contact@example.test");
    expect(JSON.stringify(issued.json().data)).not.toMatch(
      /objectKey|idempotency|passport|cccd|secret/i,
    );
  });

  test("PDF content/size/encryption validation blocks upload before storage writes", async () => {
    const f = await scenario(),
      before = objects.size;
    for (const bytes of [Buffer.from("not a PDF"), Buffer.from("%PDF-1.7\n%%EOF")])
      expect((await upload(f.bookingId, { bytes })).statusCode).toBe(422);
    const empty = await PDFDocument.create();
    // Preserve zero pages so this tests a structurally parseable but unreadable contract.
    expect(
      (await upload(f.bookingId, { bytes: await empty.save({ addDefaultPage: false }) }))
        .statusCode,
    ).toBe(422);
    const encrypted = await PDFDocument.create();
    encrypted.addPage();
    encrypted.context.trailerInfo.Encrypt = encrypted.context.register(
      encrypted.context.obj({ Filter: "Standard", V: 1, R: 2, Length: 40 }),
    );
    expect((await upload(f.bookingId, { bytes: await encrypted.save() })).statusCode).toBe(422);
    expect(
      (await upload(f.bookingId, { bytes: new Uint8Array(CONTRACT_PDF_MAX_BYTES + 1) })).statusCode,
    ).toBe(422);
    expect(objects.size).toBe(before);
  });

  test("a readable PDF exactly at the 20 MiB limit is accepted", async () => {
    const f = await scenario();
    const maximum = Buffer.alloc(CONTRACT_PDF_MAX_BYTES, 0x20);
    Buffer.from(pdf).copy(maximum);
    Buffer.from("\n%%EOF").copy(maximum, maximum.length - 6);
    const r = await upload(f.bookingId, { bytes: maximum });
    expect(r.statusCode).toBe(201);
    expect(r.json().data.byteSize).toBe(CONTRACT_PDF_MAX_BYTES);
  });

  test("concurrent upload retries deduplicate, issue CAS preserves history and current-issued selection", async () => {
    const f = await scenario(),
      key = randomUUID(),
      before = objects.size;
    const uploads = await Promise.all([upload(f.bookingId, { key }), upload(f.bookingId, { key })]);
    expect(uploads.map((r) => r.statusCode)).toEqual([201, 201]);
    const id = uploads[0].json().data.id;
    expect(uploads[1].json().data.id).toBe(id);
    expect(objects.size).toBe(before + 1);
    const first = await Promise.all([issue(f.bookingId, id), issue(f.bookingId, id)]);
    expect(first.map((r) => r.statusCode)).toEqual([200, 200]);
    const newer = await upload(f.bookingId);
    const next = newer.json().data.id;
    expect(
      (await api("owner", "GET", `/bookings/${f.bookingId}/contracts`)).json().data[0].id,
    ).toBe(id);
    expect((await issue(f.bookingId, next)).statusCode).toBe(409);
    expect((await issue(f.bookingId, next, id)).statusCode).toBe(200);
    const list = (await api("owner", "GET", `/bookings/${f.bookingId}/contracts`)).json().data;
    expect(list).toHaveLength(2);
    expect(list[0].currentIssued).toBe(true);
    expect(list[1].currentIssued).toBe(false);
  });

  test("concurrent issuance of different versions has one winner; handover rejects a candidate superseded during object read", async () => {
    const f = await scenario(),
      a = (await upload(f.bookingId)).json().data.id,
      b = (await upload(f.bookingId)).json().data.id;
    const raced = await Promise.all([issue(f.bookingId, a), issue(f.bookingId, b)]);
    expect(raced.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = raced.find((r) => r.statusCode === 200)?.json().data.id;
    const next = (await upload(f.bookingId)).json().data.id;
    interceptGet = async () => {
      expect((await issue(f.bookingId, next, current)).statusCode).toBe(200);
    };
    expect((await handover(f.inspectionId)).statusCode).toBe(409);
    expect(await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId))).toHaveLength(
      0,
    );
    expect(
      (
        await db
          .select()
          .from(handoverInspections)
          .where(eq(handoverInspections.id, f.inspectionId))
      )[0]?.contractId,
    ).toBeNull();
  });

  test("revoked FM permission after object upload rolls back metadata and cleans only the new object", async () => {
    const f = await scenario(),
      before = objects.size;
    interceptPut = async () => {
      await db
        .update(facilityAssignments)
        .set({ isActive: false })
        .where(eq(facilityAssignments.userId, ids.fm));
    };
    try {
      expect((await upload(f.bookingId)).statusCode).toBe(403);
      expect(objects.size).toBe(before);
      expect(
        await db.select().from(bookingContracts).where(eq(bookingContracts.bookingId, f.bookingId)),
      ).toHaveLength(0);
    } finally {
      await db
        .update(facilityAssignments)
        .set({ isActive: true })
        .where(eq(facilityAssignments.userId, ids.fm));
    }
  });

  test("an unknown commit outcome retains the referenced object and upload retry returns the committed version", async () => {
    const f = await scenario(),
      before = objects.size;
    const repository = new ContractsRepository(db),
      original = repository.locked.bind(repository);
    let transactions = 0;
    const error = new Error("Connection outcome unknown after commit");
    repository.locked = async <T>(
      bookingId: string,
      action: (tx: ContractTransaction) => Promise<T>,
    ) => {
      const result = await original(bookingId, action);
      if (++transactions === 2) throw error;
      return result;
    };
    const service = new ContractsService(repository, storage);
    const input = {
      filename: "contract.pdf",
      mimeType: "application/pdf" as const,
      dataBase64: Buffer.from(pdf).toString("base64"),
      idempotencyKey: randomUUID(),
    };
    await expect(
      service.upload({ id: ids.fm, role: roles.fm }, f.bookingId, input),
    ).rejects.toThrow(error.message);
    expect(objects.size).toBe(before + 1);
    const rows = await db
      .select()
      .from(bookingContracts)
      .where(eq(bookingContracts.bookingId, f.bookingId));
    expect(rows).toHaveLength(1);
    expect(objects.has(rows[0]?.objectKey ?? "")).toBe(true);
    const retry = await service.upload({ id: ids.fm, role: roles.fm }, f.bookingId, input);
    expect(retry.id).toBe(rows[0]?.id);
    expect(objects.size).toBe(before + 1);
  });

  test("failure after rental activation rolls back booking, rental, inventory and contract-use audit together", async () => {
    const f = await scenario(),
      id = (await upload(f.bookingId)).json().data.id;
    expect((await issue(f.bookingId, id)).statusCode).toBe(200);
    const repository = new InspectionsRepository(db),
      original = repository.activateRental.bind(repository);
    const error = new Error("Injected activation failure");
    const spy = spyOn(repository, "activateRental").mockImplementation(async (...args) => {
      await original(...args);
      throw error;
    });
    try {
      await expect(
        new InspectionsService(repository, undefined, storage).handover(f.inspectionId, 0, ids.fs),
      ).rejects.toThrow(error.message);
    } finally {
      spy.mockRestore();
    }
    expect(await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId))).toHaveLength(
      0,
    );
    expect((await db.select().from(bookings).where(eq(bookings.id, f.bookingId)))[0]?.status).toBe(
      "CONFIRMED",
    );
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId)))[0]?.status,
    ).toBe("RESERVED");
    expect(
      (
        await db
          .select()
          .from(handoverInspections)
          .where(eq(handoverInspections.id, f.inspectionId))
      )[0]?.contractId,
    ).toBeNull();
    const audits = await db
      .select()
      .from(bookingContractAudit)
      .where(eq(bookingContractAudit.bookingId, f.bookingId));
    expect(audits.some((row) => row.action === "CONTRACT_USED_FOR_HANDOVER")).toBe(false);
    expect((await handover(f.inspectionId)).statusCode).toBe(200);
  });

  test("missing or corrupted private object blocks issue/handover without partial inventory changes", async () => {
    const f = await scenario(),
      uploaded = await upload(f.bookingId),
      id = uploaded.json().data.id;
    failGet = true;
    try {
      expect((await issue(f.bookingId, id)).statusCode).toBe(503);
    } finally {
      failGet = false;
    }
    expect((await issue(f.bookingId, id)).statusCode).toBe(200);
    const [stored] = await db.select().from(bookingContracts).where(eq(bookingContracts.id, id));
    if (!stored) throw new Error("Missing fixture contract");
    const original = objects.get(stored.objectKey);
    objects.set(stored.objectKey, new Uint8Array([1, 2, 3]));
    expect((await handover(f.inspectionId)).statusCode).toBe(422);
    expect(await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId))).toHaveLength(
      0,
    );
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId)))[0]?.status,
    ).toBe("RESERVED");
    if (original) objects.set(stored.objectKey, original);
  });

  test("handover binds current issued version atomically; retry and owner rental PDF access remain authorized", async () => {
    const f = await scenario(),
      r = await upload(f.bookingId),
      id = r.json().data.id;
    expect((await issue(f.bookingId, id)).statusCode).toBe(200);
    expect((await handover(f.inspectionId, "otherFs")).statusCode).toBe(403);
    const results = await Promise.all([handover(f.inspectionId), handover(f.inspectionId)]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    const active = await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId));
    expect(active).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(handoverInspections)
          .where(eq(handoverInspections.id, f.inspectionId))
      )[0]?.contractId,
    ).toBe(id);
    expect(
      (await api("owner", "GET", `/rentals/${active[0]?.id}/contracts`)).json().data[0]
        .usedForHandover,
    ).toBe(true);
    const file = await api(
      "owner",
      "GET",
      `/bookings/${f.bookingId}/contracts/${id}/pdf?download=true`,
    );
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(file.headers["cache-control"]).toBe("private, no-store");
    expect(file.headers["content-disposition"]).toContain("attachment");
    expect(file.rawPayload).toEqual(Buffer.from(pdf));
    expect((await api("other", "GET", `/rentals/${active[0]?.id}/contracts`)).statusCode).toBe(404);
    expect(
      (await api("other", "GET", `/bookings/${f.bookingId}/contracts/${id}/pdf`)).statusCode,
    ).toBe(404);
    expect((await upload(f.bookingId)).statusCode).toBe(409);
    // No provider re-read is required to acknowledge a previously committed handover.
    failGet = true;
    try {
      expect((await handover(f.inspectionId)).statusCode).toBe(200);
    } finally {
      failGet = false;
    }
  });
});
