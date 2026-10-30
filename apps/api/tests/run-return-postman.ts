import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

type Scenario = {
  name: string;
  deduction: number;
  facilityId: string;
  rentalId: string;
  unitId: string;
  paymentId: string;
  unitTypeId: string;
  slotId: string;
};
type Fixture = {
  baseUrl: string;
  actors: Record<string, { id: string; email: string }>;
  date: string;
  slotId: string;
  scenarios: Scenario[];
};

const root = resolve(import.meta.dirname, "../../..");
const output = resolve(root, "postman/reports/return-settlement");
const readyPath = "/tmp/metastorage-return-postman-ready.json";
const password = "local-return-postman-123";

async function serve() {
  const { db, queryClient, ...schema } = await import("@metastorage/database");
  const { hashPassword } = await import("better-auth/crypto");
  const { buildApp } = await import("../src/app");
  const { setSystemTime } = await import("bun:test");
  const actors: Record<string, { id: string; email: string }> = {};
  for (const [name, role] of Object.entries({
    customer: "CUSTOMER",
    staff: "FACILITY_STAFF",
    manager: "FACILITY_MANAGER",
    bom: "BUSINESS_OPERATION_MANAGER",
    outsider: "CUSTOMER",
    unassigned: "FACILITY_STAFF",
  })) {
    const id = randomUUID(),
      email = `${name}-${id}@example.test`;
    await db
      .insert(schema.users)
      .values({ id, email, name, role: role as never, status: "ACTIVE", emailVerified: true });
    await db.insert(schema.accounts).values({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: await hashPassword(password),
    });
    actors[name] = { id, email };
  }
  const { staff, manager, customer } = actors;
  if (!staff || !manager || !customer) throw new Error("Missing fixture actors");
  for (const [key, value] of Object.entries({
    DEPOSIT_MONTHS: 1,
    OPENING_HOUR: 8,
    CLOSING_HOUR: 20,
    RENEWAL_NOTICE_DAYS: 7,
  })) {
    await db
      .insert(schema.systemSettings)
      .values({ key: key as never, value, version: 1, description: "Postman isolated test" });
  }
  const date = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const slotId = randomUUID();
  await db
    .insert(schema.checkInSlots)
    .values({ id: slotId, name: "Postman return", startTime: "09:00", endTime: "10:00" });
  const scenarios = [];
  const facilityId = randomUUID();
  await db
    .insert(schema.facilities)
    .values({ id: facilityId, code: "POSTMAN", name: "Postman", address: "Synthetic fixture" });
  await db.insert(schema.facilityAssignments).values([
    { facilityId, userId: staff.id, role: "FACILITY_STAFF" },
    { facilityId, userId: manager.id, role: "FACILITY_MANAGER" },
  ]);
  let hour = 9;
  for (const [name, deduction] of Object.entries({ surplus: 50000, equal: 100000, debt: 150000 })) {
    const scenarioSlot = randomUUID();
    await db
      .insert(schema.checkInSlots)
      .values({ id: scenarioSlot, name, startTime: `${hour}:00`, endTime: `${++hour}:00` });
    const unitTypeId = randomUUID(),
      unitId = randomUUID(),
      bookingId = randomUUID(),
      rentalId = randomUUID(),
      paymentId = randomUUID();
    await db.insert(schema.unitTypes).values({
      id: unitTypeId,
      facilityId,
      code: name,
      name,
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      monthlyPrice: 100000,
    });
    await db
      .insert(schema.storageUnits)
      .values({ id: unitId, facilityId, unitTypeId, code: name, status: "OCCUPIED" });
    await db.insert(schema.bookings).values({
      id: bookingId,
      userId: customer.id,
      facilityId,
      unitTypeId,
      requestedMonths: 2,
      checkInDate: date,
      checkInSlotId: slotId,
      rentalEndAt: new Date(Date.now() + 60 * 86400000),
      monthlyRateSnapshot: "100000",
      rentalFeeAmount: "200000",
      depositAmount: "100000",
      totalAmount: "300000",
      status: "CHECKED_IN",
      contactPhone: "0901234567",
    });
    await db.insert(schema.rentals).values({
      id: rentalId,
      bookingId,
      userId: customer.id,
      storageUnitId: unitId,
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 60 * 86400000),
    });
    await db.insert(schema.payments).values({
      id: paymentId,
      bookingId,
      totalAmount: "300000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date(),
      provider: "sepay",
      paymentCode: randomUUID().replaceAll("-", ""),
      providerPaymentId: randomUUID(),
      holdTokenHash: "test-hold",
      idempotencyKey: randomUUID(),
    });
    scenarios.push({
      name,
      deduction,
      facilityId,
      rentalId,
      unitId,
      paymentId,
      unitTypeId,
      slotId: scenarioSlot,
    });
  }
  const app = buildApp();
  await app.listen({ host: "127.0.0.1", port: 0 });
  process.on("message", async (message: { advance?: string }) => {
    if (message.advance) {
      setSystemTime(new Date(message.advance));
      await writeFile(`${readyPath}.advanced`, "ready");
    }
  });
  process.on("SIGTERM", async () => {
    await app.close();
    await queryClient.end();
    process.exit(0);
  });
  await writeFile(
    readyPath,
    JSON.stringify({ baseUrl: app.listeningOrigin, actors, date, slotId, scenarios }),
  );
}

async function run() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const name = `metastorage_inspection_test_postman_${suffix}`;
  const adminUrl = "postgres://postgres:postgres@127.0.0.1:5433/postgres";
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = adminUrl;
  const { queryClient } = await import("@metastorage/database");
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: adminUrl.replace(/postgres$/, name),
    DOCKER_DATABASE_URL: "",
    LOG_LEVEL: "silent",
    REDIS_URL: "redis://127.0.0.1:6379/13",
    TRUSTED_PROXY_CIDRS: "127.0.0.1",
    CORS_ORIGIN: "http://localhost:3000",
    AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
    BETTER_AUTH_SECRET: "postman-local-only-auth-secret-32-characters",
    BETTER_AUTH_URL: "http://localhost:4000/api/auth",
    BOOKING_MAGIC_LINK_SECRET: "postman-local-only-booking-secret-32-characters",
    QR_TOKEN_SECRET: "postman-local-only-qr-secret-32-characters",
    PUBLIC_APP_URL: "http://localhost:3000",
    WEB_URL: "http://localhost:3000",
    RESEND_API_KEY: "re_postman_local_only",
    RESEND_FROM_EMAIL: "Test <test@example.test>",
    CLOUDINARY_CLOUD_NAME: "local-test",
    CLOUDINARY_API_KEY: "local-test",
    CLOUDINARY_API_SECRET: "local-test",
    PAYMENT_PROVIDER: "mock",
    CI: "true",
  };
  let server: ReturnType<typeof Bun.spawn> | undefined;
  await mkdir(output, { recursive: true });
  async function command(args: string[], log: string) {
    const child = Bun.spawn(args, { cwd: root, env, stdout: Bun.file(log), stderr: "pipe" });
    const error = await new Response(child.stderr).text();
    const code = await child.exited;
    await writeFile(`${log}.stderr`, error);
    return code;
  }
  try {
    await queryClient.unsafe(`CREATE DATABASE "${name}"`);
    if (
      await command(
        ["bun", "run", "--filter", "@metastorage/database", "db:migrate"],
        `${output}/migrate.log`,
      )
    )
      throw new Error("Migration failed");
    await writeFile(readyPath, "");
    await writeFile(`${readyPath}.advanced`, "");
    await writeFile(`${output}/server.log`, "");
    await writeFile(`${output}/server.stderr`, "");
    server = Bun.spawn(["bun", import.meta.path, "--serve"], {
      cwd: root,
      env,
      stdout: Bun.file(`${output}/server.log`),
      stderr: Bun.file(`${output}/server.stderr`),
      ipc() {},
    });
    let fixture: Fixture | undefined;
    for (let attempt = 0; attempt < 300; attempt++) {
      try {
        fixture = JSON.parse(await readFile(readyPath, "utf8"));
        break;
      } catch {
        await Bun.sleep(100);
      }
    }
    if (!fixture) throw new Error("Test server failed to start; inspect server.stderr");
    const variables: Record<string, string> = {
      baseUrl: fixture.baseUrl,
      date: fixture.date,
      slotId: fixture.slotId,
      staffId: fixture.actors.staff.id,
    };
    for (const [actor, account] of Object.entries(fixture.actors) as [
      string,
      { email: string },
    ][]) {
      const response = await fetch(`${fixture.baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: account.email, password }),
      });
      if (!response.ok)
        throw new Error(`Login failed for ${actor}: ${response.status} ${await response.text()}`);
      const cookie = response.headers
        .getSetCookie()
        .find((value) => value.startsWith("metastorage-auth.session_token="));
      if (!cookie) throw new Error(`Missing session cookie: ${actor}`);
      variables[`${actor}Cookie`] = cookie.split(";")[0] ?? cookie;
      variables[`${actor}Email`] = account.email;
    }
    let order = 0;
    const schedule: unknown[] = [],
      flow: unknown[] = [];
    function request(
      target: unknown[],
      label: string,
      actor: string,
      method: string,
      path: string,
      status: number,
      body?: unknown,
      checks = "",
    ) {
      const itemName = `${String(++order).padStart(2, "0")} ${label}`;
      target.push({
        name: itemName,
        protocolProfileBehavior: { disableCookies: true },
        request: {
          method,
          header: [
            { key: "Content-Type", value: "application/json" },
            ...(actor ? [{ key: "Cookie", value: `{{${actor}Cookie}}` }] : []),
          ],
          url: `{{baseUrl}}/api${path}`,
          ...(body === undefined ? {} : { body: { mode: "raw", raw: JSON.stringify(body) } }),
        },
        event: [
          {
            listen: "test",
            script: {
              type: "text/javascript",
              exec: [
                `console.log("RESULT " + JSON.stringify({name: pm.info.requestName, code: pm.response.code, body: (() => { const body = pm.response.json(); if (body.token) body.token = "[redacted test token]"; return body; })()}));`,
                `pm.test("HTTP ${status}", () => pm.response.to.have.status(${status}));`,
                ...(checks ? [`const data = pm.response.json().data;`, checks] : []),
              ],
            },
          },
        ],
      });
    }
    for (const actor of ["customer", "staff", "manager", "bom"])
      request(schedule, `Login ${actor}`, "", "POST", "/auth/sign-in/email", 200, {
        email: variables[`${actor}Email`],
        password,
      });
    request(
      schedule,
      "BOM updates fee policy",
      "bom",
      "PUT",
      "/policy-violation-fees",
      200,
      {
        expectedVersion: 0,
        items: fixture.scenarios.map((s) => ({
          code: s.name.toUpperCase(),
          name: s.name,
          amount: s.deduction,
          isActive: true,
        })),
      },
      'pm.collectionVariables.set("policyVersion", data.version); pm.test("Three policy fees", () => pm.expect(data.items.length).eq(3));',
    );
    for (const s of fixture.scenarios) {
      Object.assign(variables, {
        [`${s.name}Rental`]: s.rentalId,
        [`${s.name}Facility`]: s.facilityId,
        [`${s.name}Unit`]: s.unitId,
        [`${s.name}Payment`]: s.paymentId,
        [`${s.name}Type`]: s.unitTypeId,
      });
      request(
        schedule,
        `${s.name}: Customer requests return`,
        "customer",
        "POST",
        "/appointments/",
        201,
        {
          appointmentType: "CHECK_OUT",
          rentalId: s.rentalId,
          scheduledDate: fixture.date,
          slotId: s.slotId,
        },
        `pm.collectionVariables.set("${s.name}Appointment", data.id);`,
      );
      // Phase two variables are persisted by reading the real DB after this run.
      request(
        schedule,
        `${s.name}: FM confirms and assigns Staff`,
        "manager",
        "PATCH",
        `/appointments/{{${s.name}Appointment}}`,
        200,
        { status: "CONFIRMED", assignedStaffId: fixture.actors.staff.id },
      );
    }
    const collectionPath = resolve(
      root,
      "postman/collections/return-settlement.postman_collection.json",
    );
    await mkdir(resolve(root, "postman/collections"), { recursive: true });
    async function saveCollection() {
      await writeFile(
        collectionPath,
        JSON.stringify(
          {
            info: {
              name: "Return settlement and debt",
              schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            },
            variable: Object.entries(variables).map(([key, value]) => ({ key, value })),
            item: [
              { name: "01 Schedule", item: schedule },
              { name: "02 Return and collect", item: flow },
            ],
          },
          null,
          2,
        ),
      );
    }
    await saveCollection();
    let exitCode = await command(
      ["postman", "collection", "run", collectionPath, "-i", "01 Schedule", "--no-report-events"],
      `${output}/schedule.log`,
    );
    if (exitCode) throw new Error(`Postman schedule failed: ${exitCode}`);
    const testDb = createRequire(resolve(root, "packages/database/package.json"))(
      "postgres",
    ).default(env.DATABASE_URL, { max: 1 });
    for (const s of fixture.scenarios) {
      const [appointment] =
        await testDb`select id from appointments where rental_id = ${s.rentalId}`;
      if (!appointment) throw new Error("Missing fixture appointment");
      const [task] =
        await testDb`select id from facility_tasks where reference_id = ${appointment.id}`;
      if (!task) throw new Error("Missing fixture task");
      variables[`${s.name}Appointment`] = appointment.id;
      variables[`${s.name}Task`] = task.id;
    }
    const [policy] = await testDb`select max(policy_version) version from policy_violation_fee`;
    if (!policy) throw new Error("Missing fixture policy");
    variables.policyVersion = String(policy.version);
    await testDb.end();
    server.send({ advance: `${fixture.date}T12:15:00+07:00` });
    for (
      let attempt = 0;
      attempt < 100 && !(await readFile(`${readyPath}.advanced`, "utf8"));
      attempt++
    )
      await Bun.sleep(50);
    for (const s of fixture.scenarios) {
      const prefix = s.name;
      request(
        flow,
        `${prefix}: Staff starts task`,
        "staff",
        "PATCH",
        `/facility-tasks/{{${prefix}Task}}`,
        200,
        { status: "IN_PROGRESS" },
      );
      request(
        flow,
        `${prefix}: Staff creates inspection`,
        "staff",
        "POST",
        "/inspections",
        201,
        { taskId: `{{${prefix}Task}}` },
        `pm.collectionVariables.set("${prefix}Inspection", data.id);`,
      );
      const results = ["ASSIGNED_UNIT", "DOOR_LOCK", "UNIT_CONDITION", "EXISTING_INVENTORY"].map(
        (itemCode) => ({
          itemCode,
          resultType: "PASS_FAIL",
          result: prefix === "surplus" ? "PASS" : "FAIL",
          note: prefix === "surplus" ? null : "Documented damage",
          photos: [],
        }),
      );
      const draft = {
        status: "IN_PROGRESS",
        condition: prefix === "surplus" ? "GOOD" : "MAJOR_DAMAGE",
        checklist: { results },
        violations: [{ code: prefix.toUpperCase(), note: "Policy fee" }],
        policyVersion: Number(variables.policyVersion),
      };
      request(
        flow,
        `${prefix}: Save inspection and applied fees`,
        "staff",
        "PATCH",
        `/inspections/{{${prefix}Inspection}}`,
        200,
        draft,
      );
      request(
        flow,
        `${prefix}: Read settlement estimate`,
        "staff",
        "GET",
        `/inspections/{{${prefix}Inspection}}`,
        200,
        undefined,
        `pm.test("Server estimate", () => { pm.expect(data.returnContext.deductionAmount).eq(${s.deduction}); pm.expect(data.returnContext.refundAmount).eq(${Math.max(0, 100000 - s.deduction)}); pm.expect(data.returnContext.debtAmount).eq(${Math.max(0, s.deduction - 100000)}); });`,
      );
      request(
        flow,
        `${prefix}: Reject missing settlement confirmation`,
        "staff",
        "PATCH",
        `/inspections/{{${prefix}Inspection}}`,
        409,
        { status: "PASSED" },
      );
      const complete = {
        status: "PASSED",
        settlement: {
          confirmed: true,
          deductionAmount: s.deduction,
          ...(prefix === "surplus"
            ? { refund: { method: "BANK_TRANSFER", reference: "POSTMAN-REFUND" } }
            : {}),
        },
      };
      request(
        flow,
        `${prefix}: Complete return and settlement`,
        "staff",
        "PATCH",
        `/inspections/{{${prefix}Inspection}}`,
        200,
        complete,
        'pm.test("Inspection finalized", () => pm.expect(data.status).eq("PASSED"));',
      );
      request(
        flow,
        `${prefix}: Replay completion`,
        "staff",
        "PATCH",
        `/inspections/{{${prefix}Inspection}}`,
        200,
        complete,
      );
      request(
        flow,
        `${prefix}: Reject changed completion`,
        "staff",
        "PATCH",
        `/inspections/{{${prefix}Inspection}}`,
        409,
        {
          status: "PASSED",
          settlement: { ...complete.settlement, deductionAmount: s.deduction + 1 },
        },
      );
      request(
        flow,
        `${prefix}: Customer reads closed Rental`,
        "customer",
        "GET",
        `/rentals/${s.rentalId}`,
        200,
        undefined,
        `pm.test("Closed Rental and immutable settlement", () => { pm.expect(data.status).eq("CLOSED"); pm.expect(Number(data.settlement.deductionAmount)).eq(${s.deduction}); });`,
      );
      request(
        flow,
        `${prefix}: FM verifies Unit status`,
        "manager",
        "GET",
        `/storage-units/?facilityId=${s.facilityId}&limit=100`,
        200,
        undefined,
        `pm.test("Unit after return", () => pm.expect(data.items.find(u => u.id === "${s.unitId}").status).eq("${prefix === "surplus" ? "AVAILABLE" : "MAINTENANCE"}"));`,
      );
      request(
        flow,
        `${prefix}: FM reads closed Rental`,
        "manager",
        "GET",
        `/rentals/facility/${s.facilityId}/${s.rentalId}`,
        200,
        undefined,
        'pm.test("FM settlement visible", () => pm.expect(data.settlement).not.eq(null));',
      );
      request(
        flow,
        `${prefix}: Customer reads payment history`,
        "customer",
        "GET",
        `/rentals/${s.rentalId}/payments`,
        200,
        undefined,
        `pm.test("Refund records", () => pm.expect(data.filter(p => p.type === "DEPOSIT_REFUND").length).eq(${prefix === "surplus" ? 1 : 0}));`,
      );
      request(
        flow,
        `${prefix}: FM reads payment history`,
        "manager",
        "GET",
        `/rentals/facility/${s.facilityId}/${s.rentalId}/payments`,
        200,
      );
      request(
        flow,
        `${prefix}: Source charge status preserved`,
        "customer",
        "GET",
        `/payments/${s.paymentId}/status`,
        200,
        undefined,
        'pm.test("Source CHARGE succeeded", () => { pm.expect(data.type).eq("CHARGE"); pm.expect(data.status).eq("SUCCEEDED"); });',
      );
      request(
        flow,
        `${prefix}: Staff lists Debt`,
        "staff",
        "GET",
        `/debts?rentalId=${s.rentalId}`,
        200,
        undefined,
        `pm.test("Debt count", () => pm.expect(data.total).eq(${prefix === "debt" ? 1 : 0})); ${prefix === "debt" ? 'pm.collectionVariables.set("debtId", data.items[0].id);' : ""}`,
      );
    }
    request(
      flow,
      "Customer reads own unpaid Debt",
      "customer",
      "GET",
      "/debts/{{debtId}}",
      200,
      undefined,
      'pm.test("UNPAID 50000", () => { pm.expect(data.status).eq("UNPAID"); pm.expect(Number(data.remainingAmount)).eq(50000); });',
    );
    request(
      flow,
      "FM lists unpaid Debt",
      "manager",
      "GET",
      "/debts?status=UNPAID",
      200,
      undefined,
      'pm.test("One unpaid debt", () => pm.expect(data.total).eq(1));',
    );
    request(flow, "Outsider cannot read Debt", "outsider", "GET", "/debts/{{debtId}}", 404);
    const payment = { amount: 20000, method: "CASH", idempotencyKey: randomUUID() };
    request(flow, "Anonymous cannot list Debt", "", "GET", "/debts", 401);
    request(
      flow,
      "FM cannot collect Debt",
      "manager",
      "POST",
      "/debts/{{debtId}}/payments",
      403,
      payment,
    );
    request(
      flow,
      "Unassigned Staff cannot collect Debt",
      "unassigned",
      "POST",
      "/debts/{{debtId}}/payments",
      403,
      payment,
    );
    request(
      flow,
      "Transfer requires reference",
      "staff",
      "POST",
      "/debts/{{debtId}}/payments",
      400,
      { ...payment, method: "BANK_TRANSFER" },
    );
    request(
      flow,
      "Staff collects partial payment",
      "staff",
      "POST",
      "/debts/{{debtId}}/payments",
      200,
      payment,
      'pm.test("PARTIALLY_PAID 30000 remaining", () => { pm.expect(data.status).eq("PARTIALLY_PAID"); pm.expect(Number(data.remainingAmount)).eq(30000); pm.expect(data.payments.length).eq(1); pm.collectionVariables.set("receiptId", data.payments[0].id); });',
    );
    request(
      flow,
      "FM filters partially paid Debt",
      "manager",
      "GET",
      "/debts?status=PARTIALLY_PAID",
      200,
      undefined,
      'pm.test("One partial Debt", () => pm.expect(data.total).eq(1));',
    );
    request(
      flow,
      "Debt pagination retains total beyond last page",
      "manager",
      "GET",
      "/debts?limit=1&offset=1",
      200,
      undefined,
      'pm.test("Empty page with total one", () => { pm.expect(data.items.length).eq(0); pm.expect(data.total).eq(1); });',
    );
    request(
      flow,
      "Replay partial receipt",
      "staff",
      "POST",
      "/debts/{{debtId}}/payments",
      200,
      payment,
      'pm.test("No duplicated receipt", () => pm.expect(data.payments.length).eq(1));',
    );
    request(
      flow,
      "Reject conflicting receipt key",
      "staff",
      "POST",
      "/debts/{{debtId}}/payments",
      409,
      { ...payment, amount: 20001 },
    );
    request(flow, "Reject overpayment", "staff", "POST", "/debts/{{debtId}}/payments", 409, {
      ...payment,
      amount: 30001,
      idempotencyKey: randomUUID(),
    });
    request(
      flow,
      "Staff collects final transfer",
      "staff",
      "POST",
      "/debts/{{debtId}}/payments",
      200,
      {
        amount: 30000,
        method: "BANK_TRANSFER",
        reference: "POSTMAN-DEBT-FINAL",
        idempotencyKey: randomUUID(),
      },
      'pm.test("PAID with two receipts", () => { pm.expect(data.status).eq("PAID"); pm.expect(Number(data.remainingAmount)).eq(0); pm.expect(data.payments.length).eq(2); });',
    );
    request(
      flow,
      "Customer reads debt receipt status",
      "customer",
      "GET",
      "/payments/{{receiptId}}/status",
      200,
      undefined,
      'pm.test("Debt receipt SUCCEEDED", () => { pm.expect(data.type).eq("DEBT_COLLECTION"); pm.expect(data.status).eq("SUCCEEDED"); });',
    );
    request(
      flow,
      "Customer payment history includes both receipts",
      "customer",
      "GET",
      "/rentals/{{debtRental}}/payments",
      200,
      undefined,
      'pm.test("Two debt receipts", () => pm.expect(data.filter(p => p.type === "DEBT_COLLECTION").length).eq(2));',
    );
    request(
      flow,
      "FM revenue includes debt cash",
      "manager",
      "GET",
      `/reports/revenue?facilityId={{debtFacility}}&unitTypeId={{debtType}}&from=${new Date().toISOString().slice(0, 10)}&to=${fixture.date}`,
      200,
      undefined,
      'pm.test("350000 cash received", () => pm.expect(Number(data.summary.cashReceived)).eq(350000));',
    );
    request(
      flow,
      "FM monthly revenue",
      "manager",
      "GET",
      `/reports/revenue/monthly?facilityId={{debtFacility}}&unitTypeId={{debtType}}&from=${new Date().toISOString().slice(0, 10)}&to=${fixture.date}`,
      200,
    );
    request(
      flow,
      "FM overview",
      "manager",
      "GET",
      `/reports/overview?facilityId={{debtFacility}}&unitTypeId={{debtType}}&from=${new Date().toISOString().slice(0, 10)}&to=${fixture.date}`,
      200,
    );
    request(
      flow,
      "BOM pending refund queue excludes completed refund",
      "bom",
      "GET",
      "/payments/refunds",
      200,
      undefined,
      'pm.test("No pending refunds", () => pm.expect(data.length).eq(0));',
    );
    await saveCollection();
    exitCode = await command(
      [
        "postman",
        "collection",
        "run",
        collectionPath,
        "-i",
        "02 Return and collect",
        "--no-report-events",
      ],
      `${output}/flow.log`,
    );
    // Keep runnable requests, never session credentials, in the committed collection.
    for (const key of Object.keys(variables)) if (key.endsWith("Cookie")) variables[key] = "";
    await saveCollection();
    const results = [];
    for (const filename of ["schedule.log", "flow.log"]) {
      const log = await readFile(`${output}/${filename}`, "utf8");
      const chunks = [...log.matchAll(/^ {2}\| (.*)$/gm)].map((match) => match[1]).join("");
      for (const match of chunks.matchAll(/'RESULT (\{.*?\})'/g))
        results.push(JSON.parse(match[1] ?? "{}"));
    }
    if (results.length !== order) throw new Error("Incomplete Postman execution evidence");
    await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(`Postman completed with exit code ${exitCode}. Reports: ${output}`);
    if (exitCode) process.exitCode = exitCode;
  } finally {
    const collectionPath = resolve(
      root,
      "postman/collections/return-settlement.postman_collection.json",
    );
    try {
      const collection = JSON.parse(await readFile(collectionPath, "utf8"));
      for (const variable of collection.variable)
        if (variable.key.endsWith("Cookie")) variable.value = "";
      await writeFile(collectionPath, JSON.stringify(collection, null, 2));
    } catch {
      /* A failed fixture setup may not have written the collection yet. */
    }
    if (server) {
      server.kill("SIGTERM");
      await server.exited;
    }
    await queryClient.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await queryClient.end();
  }
}

if (process.argv.includes("--serve")) await serve();
else await run();
