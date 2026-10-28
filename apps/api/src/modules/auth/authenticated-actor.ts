import { UserRoleSchema } from "@metastorage/contracts";
import type { User } from "@metastorage/database";
import type { FastifyRequest } from "fastify";
import { UnauthorizedError } from "../../common/errors/app-error";

export type AuthenticatedActor = Pick<User, "id" | "role"> & { facilityId?: string };

export function getAuthenticatedActor(
  request: FastifyRequest,
  facilityId?: string,
): AuthenticatedActor {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: UserRoleSchema.parse(request.user.role), facilityId };
}
