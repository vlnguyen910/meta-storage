import {
  CreateInspectionInputSchema,
  InspectionListQuerySchema,
  UpdateInspectionInputSchema,
  UserRole,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { FacilityTasksRepository } from "../facility-tasks/facility-tasks.repository";
import { MediaAssetsRepository } from "../media-assets/media-assets.repository";
import { MediaAssetsService } from "../media-assets/media-assets.service";
import { INSPECTIONS_API_MESSAGES as m } from "./inspections.messages";
import { InspectionsRepository } from "./inspections.repository";
import { InspectionsService } from "./inspections.service";

const inspectionParams = z.object({ id: z.string().uuid() });
const bookingParams = z.object({ bookingId: z.string().uuid() });

export const inspectionsRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const assignmentRepository = new FacilityAssignmentsRepository(app.db);
  const tasks = new FacilityTasksRepository(app.db, assignmentRepository);
  const assignments = new FacilityAssignmentsService(
    assignmentRepository,
    new FacilitiesRepository(app.db),
  );
  const media = new MediaAssetsService(new MediaAssetsRepository(app.db));
  const service = new InspectionsService(
    new InspectionsRepository(app.db),
    tasks,
    assignments,
    media,
  );

  typed.get(
    "/inspections/bookings/:bookingId",
    {
      preHandler: [requireRole(UserRole.FACILITY_STAFF)],
      schema: {
        tags: ["Inspections"],
        summary: m.bookingHistorySummary,
        params: bookingParams,
      },
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return successResponse(
        await service.historyForBooking(request.params.bookingId, {
          id: user.id,
          role: user.role as UserRole,
        }),
      );
    },
  );

  typed.post(
    "/inspections/bookings/:bookingId",
    {
      preHandler: [requireRole(UserRole.FACILITY_STAFF)],
      schema: {
        tags: ["Inspections"],
        summary: m.startBookingSummary,
        params: bookingParams,
      },
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return successResponse(
        await service.startForBooking(request.params.bookingId, {
          id: user.id,
          role: user.role as UserRole,
        }),
      );
    },
  );

  typed.get(
    "/inspections/staff",
    {
      preHandler: [requireRole(UserRole.FACILITY_STAFF)],
      schema: {
        tags: ["Inspections"],
        summary: m.staffListSummary,
        querystring: InspectionListQuerySchema,
      },
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return successResponse(
        await service.listForStaff(request.query, { id: user.id, role: user.role as UserRole }),
      );
    },
  );

  typed.get(
    "/inspections/facility",
    {
      preHandler: [requireRole(UserRole.FACILITY_MANAGER)],
      schema: {
        tags: ["Inspections"],
        summary: m.facilityListSummary,
        querystring: InspectionListQuerySchema,
      },
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return successResponse(
        await service.listForFacility(request.query, { id: user.id, role: user.role as UserRole }),
      );
    },
  );

  typed.post(
    "/inspections",
    {
      preHandler: [requireRole(UserRole.FACILITY_STAFF)],
      schema: {
        tags: ["Inspections"],
        summary: m.createSummary,
        body: CreateInspectionInputSchema,
      },
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(
          successResponse(
            await service.create(request.body, { id: user.id, role: user.role as UserRole }),
          ),
        );
    },
  );

  typed.get(
    "/inspections/:id",
    {
      preHandler: [requireRole(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER)],
      schema: { tags: ["Inspections"], summary: m.detailSummary, params: inspectionParams },
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return successResponse(
        await service.get(request.params.id, { id: user.id, role: user.role as UserRole }),
      );
    },
  );

  typed.patch(
    "/inspections/:id",
    {
      preHandler: [requireRole(UserRole.FACILITY_STAFF)],
      schema: {
        tags: ["Inspections"],
        summary: m.updateSummary,
        params: inspectionParams,
        body: UpdateInspectionInputSchema,
      },
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return successResponse(
        await service.update(request.params.id, request.body, {
          id: user.id,
          role: user.role as UserRole,
        }),
      );
    },
  );
};
