import type { FacilityAssignmentRole } from "@metastorage/contracts";
import type { FastifyRequest } from "fastify";
import type { FacilityScope } from "./facilities.access";

export interface FacilityContext {
  facilityId: string;
  scope: FacilityScope;
}

export interface RequireFacilityAccessOptions {
  allowedFacilityRoles?: readonly FacilityAssignmentRole[];
  resolveFacilityId?: (request: FastifyRequest) => string | undefined;
}
