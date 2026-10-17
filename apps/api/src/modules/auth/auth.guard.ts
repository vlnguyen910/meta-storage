import type { Role } from "@metastorage/database";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { UnauthorizedError } from "../../common/errors/app-error";
import { auth } from "./auth";
import { assertActiveUser, assertUserHasRole } from "./auth.authorization";
import { AUTH_MESSAGES } from "./auth.messages";

const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("session", null);
};

export const authPlugin = fp(authPluginCallback, {
  name: "auth-plugin",
});

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const sessionData = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!sessionData) {
    throw new UnauthorizedError(AUTH_MESSAGES.loginRequired);
  }

  assertActiveUser(sessionData.user);
  request.user = sessionData.user;
  request.session = sessionData.session;
}

export async function optionalAuth(request: FastifyRequest) {
  const sessionData = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!sessionData) return;
  assertActiveUser(sessionData.user);
  request.user = sessionData.user;
  request.session = sessionData.session;
}

export function requireRole(...allowedRoles: Role[]) {
  return async function requireRolePreHandler(request: FastifyRequest, reply: FastifyReply) {
    await requireAuth(request, reply);
    // requireAuth always sets the user when it resolves.
    if (!request.user) {
      throw new UnauthorizedError(AUTH_MESSAGES.loginRequired);
    }
    assertUserHasRole(request.user, allowedRoles);
  };
}
