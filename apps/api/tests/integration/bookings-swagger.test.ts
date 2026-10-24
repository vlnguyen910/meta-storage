import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import {
  BookingDraftInputSchema,
  BookingListItemSchema,
  EligibleUnitSchema,
  PhysicalUnitAssignmentSchema,
} from "@metastorage/contracts";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { swaggerPlugin } from "../../src/common/plugins/swagger";
import { auth } from "../../src/modules/auth/auth";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { BookingsService } from "../../src/modules/bookings/bookings.service";
import { CheckInSlotsRepository } from "../../src/modules/bookings/check-in-slots.repository";

const app = Fastify();
const session = spyOn(auth.api, "getSession");
const createDraft = spyOn(BookingsService.prototype, "createDraft");

beforeAll(async () => {
  app.decorate("db", {});
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  setupErrorHandler(app);
  await app.register(swaggerPlugin);
  await app.register(bookingsRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  session.mockRestore();
  createDraft.mockRestore();
  await app.close();
});

describe("Booking Swagger contracts", () => {
  test.each([
    { slots: [] },
    {
      slots: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          name: "Morning",
          startTime: "09:00:00",
          endTime: "11:00:00",
        },
      ],
    },
  ])("returns the check-in slot list without a session: %j", async ({ slots }) => {
    const list = spyOn(CheckInSlotsRepository.prototype, "list").mockResolvedValueOnce(slots);
    try {
      session.mockClear();
      const response = await app.inject("/api/bookings/check-in-slots");
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: slots,
        timestamp: expect.any(String),
      });
      expect(session).not.toHaveBeenCalled();
      expect(list).toHaveBeenCalledTimes(1);
    } finally {
      list.mockRestore();
    }
  });

  test("documents the public check-in slot list", async () => {
    const spec = (await app.inject("/docs/json")).json();
    const operation = spec.paths["/api/bookings/check-in-slots"]?.get;
    expect(operation).toBeDefined();
    expect(operation.security).toEqual([]);
    expect(operation.responses[200]).toBeDefined();
  });

  test("keeps five seeded role logins available in the Swagger UI", async () => {
    const spec = (await app.inject("/docs/json")).json();
    const examples =
      spec.paths["/api/auth/sign-in/email"].post.requestBody.content["application/json"].examples;
    expect(Object.keys(examples)).toEqual([
      "CUSTOMER",
      "FACILITY_STAFF",
      "FACILITY_MANAGER",
      "BUSINESS_OPERATION_MANAGER",
      "SYSTEM_ADMIN",
    ]);
    const page = await app.inject("/docs/");
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("quick-login.js");
    const script = await app.inject("/docs/static/theme/quick-login.js");
    expect(script.statusCode).toBe(200);
    expect(script.body).toContain("/api/auth/sign-in/email");
    expect(script.body).toContain("/api/auth/me");
  });

  test("documents all booking routes with complete response schemas and numeric error examples", async () => {
    const response = await app.inject("/docs/json");
    expect(response.statusCode).toBe(200);
    const spec = response.json();
    const resolve = (schema: { $ref?: string }) =>
      schema.$ref ? spec.components.schemas[schema.$ref.split("/").at(-1) as string] : schema;
    const routes = [
      ["/api/bookings/drafts", "post", 201],
      ["/api/facilities/{facilityId}/bookings", "get", 200],
      ["/api/bookings/assigned-to-me", "get", 200],
      ["/api/bookings/mine", "get", 200],
      ["/api/bookings/mine/{id}", "get", 200],
      ["/api/bookings/{id}", "get", 200],
      ["/api/bookings/{id}/eligible-units", "get", 200],
      ["/api/bookings/{id}/assign-unit", "post", 200],
      ["/api/bookings/{id}/assign-staff", "post", 200],
    ] as const;
    for (const [path, method, status] of routes) {
      const operation = spec.paths[path][method];
      expect(operation.tags).toEqual(["Bookings"]);
      expect(operation.summary).toBeString();
      const schema = resolve(operation.responses[status].content["application/json"].schema);
      expect(schema.required).toContain("data");
      expect(schema.example.success).toBe(true);
      expect(schema.properties.data).toBeDefined();
      for (const [code, error] of Object.entries(operation.responses)) {
        if (Number(code) < 400) continue;
        const errorSchema = resolve(
          (error as { content: Record<string, { schema: object }> }).content["application/json"]
            .schema,
        );
        expect(errorSchema.example.error.code).toBe(Number(code));
        expect(errorSchema.properties.error.properties.code.type).toBe("integer");
      }
    }
    const data = (path: string, status = 200, method = "get") =>
      resolve(spec.paths[path][method].responses[status].content["application/json"].schema).example
        .data;
    const listItem = data("/api/facilities/{facilityId}/bookings")[0];
    expect(BookingListItemSchema.safeParse(listItem).success).toBe(true);
    expect(BookingListItemSchema.safeParse(data("/api/bookings/{id}")).success).toBe(true);
    expect(
      EligibleUnitSchema.array().safeParse(data("/api/bookings/{id}/eligible-units")).success,
    ).toBe(true);
    expect(
      PhysicalUnitAssignmentSchema.safeParse(data("/api/bookings/{id}/assign-unit", 200, "post"))
        .success,
    ).toBe(true);
    const assigned = data("/api/bookings/{id}/assign-staff", 200, "post");
    expect(BookingListItemSchema.safeParse(assigned).success).toBe(true);
    expect(assigned.assignedStaff.role).toBe("FACILITY_STAFF");
    const detail = resolve(
      resolve(
        spec.paths["/api/bookings/{id}"].get.responses[200].content["application/json"].schema,
      ).properties.data,
    );
    expect(Object.keys(detail.properties)).toEqual(expect.arrayContaining(Object.keys(listItem)));
  });

  test("the Swagger draft example can be submitted and preserves the complete response", async () => {
    const spec = (await app.inject("/docs/json")).json();
    const operation = spec.paths["/api/bookings/drafts"].post;
    const resolve = (schema: { $ref?: string }) =>
      schema.$ref ? spec.components.schemas[schema.$ref.split("/").at(-1) as string] : schema;
    const input = resolve(operation.requestBody.content["application/json"].schema).example;
    expect(BookingDraftInputSchema.safeParse(input).success).toBe(true);
    expect(Object.keys(input).sort()).toEqual([
      "checkInDate",
      "checkInSlotId",
      "durationMonths",
      "facilityId",
      "unitTypeId",
    ]);
    expect(operation.security).toEqual([{}, { sessionAuth: [] }]);
    const example = resolve(operation.responses[201].content["application/json"].schema).example;
    session.mockResolvedValueOnce(null);
    createDraft.mockResolvedValueOnce(example.data);
    const response = await app.inject({
      method: "POST",
      url: "/api/bookings/drafts",
      payload: input,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...example, timestamp: expect.any(String) });
    expect(createDraft).toHaveBeenCalledWith(input, undefined);
    expect(response.json().data.draftAccessToken).toHaveLength(64);
  });

  test.each([
    { checkInDate: undefined },
    { checkInSlotId: undefined },
    { checkInDate: "2031-02-30" },
    { checkInDate: "2031-02-01T00:00:00Z" },
    { checkInSlotId: "invalid" },
    { checkInDate: undefined, checkInSlotId: undefined, checkInAt: "2031-02-01T09:00:00+07:00" },
  ])(
    "rejects incomplete or invalid date/slot input before creating a draft: %j",
    async (invalid) => {
      createDraft.mockClear();
      const response = await app.inject({
        method: "POST",
        url: "/api/bookings/drafts",
        payload: {
          facilityId: "11111111-1111-4111-8111-111111111111",
          unitTypeId: "22222222-2222-4222-8222-222222222222",
          checkInDate: "2031-02-01",
          checkInSlotId: "77777777-7777-4777-8777-777777777777",
          durationMonths: 2,
          ...invalid,
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe(400);
      expect(createDraft).not.toHaveBeenCalled();
    },
  );
});
