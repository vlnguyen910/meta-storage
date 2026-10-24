import {
  AssignPhysicalUnitBodySchema,
  AssignStaffBodySchema,
  BookingDraftInputSchema,
  BookingIdParamsSchema,
  BookingListQuerySchema,
  BookingMagicLinkInputSchema,
  BookingPaymentInputSchema,
  BookingPaymentParamsSchema,
  BookingTrackingParamsSchema,
  CustomerBookingPageQuerySchema,
  FacilityBookingsParamsSchema,
  PaymentStatusHeadersSchema,
  StaffTasksQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { optionalAuth, requireAuth, requireRole } from "../auth/auth.guard";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import { requireFacilityAccess } from "../facilities/facilities.guard";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { PAYMENT_MESSAGES } from "../payments/payments.messages";
import { createPaymentsService } from "../payments/payments.service";
import {
  privateTrackingResponse,
  requireTrackingOrigin,
  trackingSessionCookie,
  trackingSessionToken,
} from "./bookings.access";
import { BOOKING_MESSAGES } from "./bookings.messages";
import { createBookingsService } from "./bookings.service";
import { bookingSwaggerTransform } from "./bookings.swagger";
import { CheckInSlotsRepository } from "./check-in-slots.repository";
import { CheckInSlotsService } from "./check-in-slots.service";

export const bookingsRoutes: FastifyPluginAsync = async (fastify) => {
  const assignmentsRepository = new FacilityAssignmentsRepository(fastify.db);
  const checkInSlotsService = new CheckInSlotsService(new CheckInSlotsRepository(fastify.db));
  const service = createBookingsService(fastify);
  const paymentsService = createPaymentsService(fastify, service);

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/bookings/check-in-slots",
    { config: { swaggerTransform: bookingSwaggerTransform("slots") } },
    async (_request, reply) => reply.send(successResponse(await checkInSlotsService.list())),
  );

  typedApp.post(
    "/bookings/drafts",
    {
      config: { swaggerTransform: bookingSwaggerTransform("draft") },
      schema: { body: BookingDraftInputSchema },
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      return reply
        .status(201)
        .send(successResponse(await service.createDraft(request.body, request.user?.id)));
    },
  );

  typedApp.post(
    "/bookings/:bookingId/cancel",
    {
      onRequest: [privateTrackingResponse],
      preHandler: [optionalAuth],
      schema: {
        params: BookingPaymentParamsSchema,
        headers: PaymentStatusHeadersSchema,
        tags: ["Bookings"],
        summary: BOOKING_MESSAGES.cancellationSummary,
        description: BOOKING_MESSAGES.cancellationDescription,
      },
    },
    async (request, reply) =>
      reply.send(
        successResponse(
          await service.cancelBooking(request.params.bookingId, {
            checkoutAccessToken: request.headers["x-booking-access-token"],
            userId: request.user?.id,
          }),
        ),
      ),
  );

  typedApp.post(
    "/bookings/:bookingId/pay",
    {
      schema: {
        params: BookingPaymentParamsSchema,
        body: BookingPaymentInputSchema,
        tags: ["Payments"],
        summary: PAYMENT_MESSAGES.startSummary,
        description: PAYMENT_MESSAGES.startDescription,
        security: [],
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await paymentsService.startBookingPayment(request.params.bookingId, request.body),
          ),
        ),
  );

  typedApp.post(
    "/booking/magic-link/exchange",
    {
      config: { swaggerTransform: bookingSwaggerTransform("exchange") },
      schema: {
        body: BookingMagicLinkInputSchema,
      },
      onRequest: [privateTrackingResponse, requireTrackingOrigin],
    },
    async (request, reply) => {
      const result = await service.exchangeMagicLink(
        request.body.token,
        request.ip,
        trackingSessionToken(request),
      );
      return reply
        .header("Set-Cookie", trackingSessionCookie(result.sessionToken))
        .send(successResponse(result.session));
    },
  );
  typedApp.get(
    "/booking/tracking/:bookingCode",
    {
      config: { swaggerTransform: bookingSwaggerTransform("tracking") },
      schema: {
        params: BookingTrackingParamsSchema,
      },
      onRequest: [privateTrackingResponse],
    },
    async (request, reply) =>
      reply.send(
        successResponse(
          await service.getTrackingBooking(
            request.params.bookingCode,
            trackingSessionToken(request),
          ),
        ),
      ),
  );
  typedApp.post(
    "/booking/session/revoke",
    {
      config: { swaggerTransform: bookingSwaggerTransform("revoke") },
      onRequest: [privateTrackingResponse, requireTrackingOrigin],
    },
    async (request, reply) => {
      await service.revokeTrackingSession(trackingSessionToken(request));
      return reply.header("Set-Cookie", trackingSessionCookie("", true)).status(204).send();
    },
  );

  // GET /api/facilities/:facilityId/bookings - List bookings in facility (FM, Admin, BOM)
  typedApp.get(
    "/facilities/:facilityId/bookings",
    {
      config: { swaggerTransform: bookingSwaggerTransform("facility") },
      schema: {
        params: FacilityBookingsParamsSchema,
        querystring: BookingListQuerySchema,
      },
      preHandler: [
        requireFacilityAccess({
          allowedFacilityRoles: ["FACILITY_MANAGER"],
        }),
      ],
    },
    async (request, reply) => {
      const { facilityId } = request.params;
      const { status } = request.query;
      const bookings = await service.getFacilityBookings(facilityId, status);
      return reply.status(200).send(successResponse(bookings));
    },
  );

  // GET /api/bookings/assigned-to-me - List bookings assigned to the current user
  typedApp.get(
    "/bookings/assigned-to-me",
    {
      config: { swaggerTransform: bookingSwaggerTransform("tasks") },
      schema: {
        querystring: StaffTasksQuerySchema,
      },
      preHandler: [requireRole("FACILITY_STAFF")],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const tasks = await service.getStaffTasks(user.id, request.query);
      return reply.status(200).send(successResponse(tasks));
    },
  );

  typedApp.get(
    "/bookings/mine",
    {
      config: { swaggerTransform: bookingSwaggerTransform("customerList") },
      schema: { querystring: CustomerBookingPageQuerySchema },
      onRequest: [privateTrackingResponse],
      preHandler: [requireRole("CUSTOMER")],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.pageMine(user.id, request.query)));
    },
  );

  typedApp.get(
    "/bookings/mine/:id",
    {
      config: { swaggerTransform: bookingSwaggerTransform("customerDetail") },
      schema: { params: BookingIdParamsSchema },
      onRequest: [privateTrackingResponse],
      preHandler: [requireRole("CUSTOMER")],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.getMine(request.params.id, user.id)));
    },
  );

  // GET /api/bookings/:id - Get booking details
  typedApp.get(
    "/bookings/:id",
    {
      config: { swaggerTransform: bookingSwaggerTransform("detail") },
      schema: {
        params: BookingIdParamsSchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const booking = await service.getBookingById(id);

      // Verify facility scope access
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
        "FACILITY_STAFF",
      ]);

      return reply.status(200).send(successResponse(booking));
    },
  );

  // GET /api/bookings/:id/eligible-units - Get list of physical units available for assignment
  typedApp.get(
    "/bookings/:id/eligible-units",
    {
      config: { swaggerTransform: bookingSwaggerTransform("units") },
      schema: {
        params: BookingIdParamsSchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const booking = await service.getBookingById(id);

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const units = await service.getEligibleUnits(id);
      return reply.status(200).send(successResponse(units));
    },
  );

  // POST /api/bookings/:id/assign-unit - Facility Manager manually assigns a physical unit
  typedApp.post(
    "/bookings/:id/assign-unit",
    {
      config: { swaggerTransform: bookingSwaggerTransform("assignUnit") },
      schema: {
        params: BookingIdParamsSchema,
        body: AssignPhysicalUnitBodySchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { physicalUnitId, reason } = request.body;

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);

      const booking = await service.getBookingById(id);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const assignment = await service.assignPhysicalUnit(id, physicalUnitId, user.id, reason);
      return reply.status(200).send(successResponse(assignment));
    },
  );

  // POST /api/bookings/:id/assign-staff - Facility Manager assigns a staff member
  typedApp.post(
    "/bookings/:id/assign-staff",
    {
      config: { swaggerTransform: bookingSwaggerTransform("assignStaff") },
      schema: {
        params: BookingIdParamsSchema,
        body: AssignStaffBodySchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { staffId } = request.body;

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);

      const booking = await service.getBookingById(id);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const updatedBooking = await service.assignStaff(id, staffId);
      return reply.status(200).send(successResponse(updatedBooking));
    },
  );
};
