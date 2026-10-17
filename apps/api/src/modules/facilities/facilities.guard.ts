import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { BadRequestError, UnauthorizedError } from "../../common/errors/app-error";
import { requireAuth } from "../auth/auth.guard";
import { getFacilityAccessScope, requireAssignedFacility } from "./facilities.access";
import type { FacilityContext, RequireFacilityAccessOptions } from "./facilities.guard.types";
import { FACILITY_MESSAGES } from "./facilities.messages";
import { FacilityAssignmentsRepository } from "./facility-assignments.repository";

const facilityContextPluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("facilityContext", null);
};

export const facilityContextPlugin = fp(facilityContextPluginCallback, {
  name: "facility-context-plugin",
});

export function getFacilityContext(request: FastifyRequest): FacilityContext {
  if (!request.facilityContext) {
    throw new UnauthorizedError(FACILITY_MESSAGES.loginRequired);
  }
  return request.facilityContext;
}

export function requireFacilityAccess(options: RequireFacilityAccessOptions = {}) {
  return async function requireFacilityAccessPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    await requireAuth(request, reply);

    const currentUser = request.user;
    if (!currentUser) {
      throw new UnauthorizedError(FACILITY_MESSAGES.loginRequired);
    }

    const params = (request.params ?? {}) as Record<string, string | undefined>;
    const facilityId = options.resolveFacilityId?.(request) ?? params.facilityId ?? params.id;

    if (!facilityId) {
      throw new BadRequestError(FACILITY_MESSAGES.facilityIdRequired);
    }

    const scope = getFacilityAccessScope(currentUser);
    const assignmentsRepository = new FacilityAssignmentsRepository(request.server.db);
    await requireAssignedFacility(
      assignmentsRepository,
      facilityId,
      scope,
      options.allowedFacilityRoles,
    );

    request.facilityContext = {
      facilityId,
      scope,
    };
  };
}
