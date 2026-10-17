import {
  InspectionDraftInputSchema,
  InspectionPhotoInputSchema,
  InspectionVersionInputSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth } from "../auth/auth.guard";
import { assertAssignedStaff, assertFlowReadAccess } from "../check-ins/check-in-access";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { InspectionsRepository } from "./inspections.repository";
import { InspectionsService } from "./inspections.service";

const bookingParams = z.object({ bookingId: z.string().uuid() });
const inspectionParams = z.object({ inspectionId: z.string().uuid() });
const photoParams = inspectionParams.extend({ photoId: z.string().uuid() });

function actorId(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user.id;
}

export const inspectionsRoutes: FastifyPluginAsync = async (app) => {
  const service = new InspectionsService(new InspectionsRepository(app.db));
  const facilities = new FacilityAssignmentsRepository(app.db);
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const guard = async (
    request: Parameters<typeof requireAuth>[0],
    reply: Parameters<typeof requireAuth>[1],
  ) => {
    await requireAuth(request, reply);
    const user = request.user;
    if (!user) throw new UnauthorizedError();
    const params = request.params as { bookingId?: string; inspectionId?: string };
    const facilityId = params.bookingId
      ? await service.facilityForBooking(params.bookingId)
      : (await service.record(params.inspectionId ?? "")).facilityId;
    await requireAssignedFacility(facilities, facilityId, getFacilityAccessScope(user), [
      "FACILITY_STAFF",
      "FACILITY_MANAGER",
    ]);
    const bookingId =
      params.bookingId ?? (await service.record(params.inspectionId ?? "")).bookingId;
    const booking = await service.booking(bookingId);
    if (request.method === "GET") assertFlowReadAccess(user, booking.assignedStaffId);
    else assertAssignedStaff(user, booking.assignedStaffId);
  };
  typed.get(
    "/bookings/:bookingId/inspections",
    { schema: { params: bookingParams }, preHandler: [guard] },
    async (req) => successResponse(await service.history(req.params.bookingId)),
  );
  typed.post(
    "/bookings/:bookingId/inspections",
    { schema: { params: bookingParams }, preHandler: [guard] },
    async (req) => successResponse(await service.start(req.params.bookingId, actorId(req))),
  );
  typed.get(
    "/inspections/:inspectionId",
    { schema: { params: inspectionParams }, preHandler: [guard] },
    async (req) => successResponse(await service.get(req.params.inspectionId)),
  );
  typed.patch(
    "/inspections/:inspectionId",
    { schema: { params: inspectionParams, body: InspectionDraftInputSchema }, preHandler: [guard] },
    async (req) =>
      successResponse(await service.save(req.params.inspectionId, req.body, actorId(req))),
  );
  typed.post(
    "/inspections/:inspectionId/photos",
    {
      bodyLimit: 5 * 1024 * 1024,
      schema: { params: inspectionParams, body: InspectionPhotoInputSchema },
      preHandler: [guard],
    },
    async (req) =>
      successResponse(await service.upload(req.params.inspectionId, req.body, actorId(req))),
  );
  typed.get(
    "/inspections/:inspectionId/photos/:photoId",
    { schema: { params: photoParams }, preHandler: [guard] },
    async (req, reply) => {
      reply.header("Cache-Control", "private, no-store");
      return successResponse(await service.photo(req.params.inspectionId, req.params.photoId));
    },
  );
  typed.delete(
    "/inspections/:inspectionId/photos/:photoId",
    { schema: { params: photoParams, body: InspectionVersionInputSchema }, preHandler: [guard] },
    async (req) =>
      successResponse(
        await service.removePhoto(
          req.params.inspectionId,
          req.params.photoId,
          req.body.version,
          actorId(req),
        ),
      ),
  );
  typed.post(
    "/inspections/:inspectionId/handover",
    {
      schema: { params: inspectionParams, body: InspectionVersionInputSchema },
      preHandler: [guard],
    },
    async (req) =>
      successResponse(
        await service.handover(req.params.inspectionId, req.body.version, actorId(req)),
      ),
  );
  typed.post(
    "/inspections/:inspectionId/complete",
    {
      schema: { params: inspectionParams, body: InspectionVersionInputSchema },
      preHandler: [guard],
    },
    async (req) =>
      successResponse(
        await service.complete(req.params.inspectionId, req.body.version, actorId(req)),
      ),
  );
};
